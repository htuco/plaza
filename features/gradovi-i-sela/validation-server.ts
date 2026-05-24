import "server-only";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { AnswerValidation, GradoviIntent, GradoviState } from "./types";

type ValidationSideEffectContext = {
  roomId: string;
  actorPlayerId: string;
  intent: unknown;
  nextState: unknown;
};
type AiCandidate = {
  key: string;
  playerId: string;
  category: string;
  answer: string;
};
type AiSuggestion = {
  key: string;
  valid: boolean;
  confidence: number;
  reason: string;
};

const GRADOVI_AI_SYSTEM_PROMPT = [
  "You are Plaza's advisory answer validator for Gradovi i Sela.",
  "Gradovi i Sela is a Bosnian/Croatian/Serbian Scattergories-style party game.",
  "Your job is to judge whether each answer is a real, specific example of its category.",
  "The app already checked empty answers, one-character answers, and starting-letter rules.",
  "Do not re-score duplicates. Do not decide final points. The host has final authority.",
  "Prefer local Balkan/Bosnian/Croatian/Serbian names, spellings, transliterations, and common dialect variants when they are recognizable.",
  "Be strict about the actual word or proper name. Diacritics can change identity and validity.",
  "Accept missing diacritics only when the submitted spelling is a common ASCII form of the same real answer.",
  "Reject added, changed, or invented diacritics/letters when they create a non-existent word or different proper name.",
  "Minor spelling mistakes are acceptable only if they do not change the identity of the answer.",
  "Be conservative with obscure, vague, generic, fictional, joke, or ambiguous answers.",
  "If you are unsure, return valid=false with confidence below the configured threshold so the app keeps it for host review.",
  "Write every reason in Bosnian/Croatian/Serbian Latin script.",
  "Keep every reason short, about 6-12 words, similar to: 'Beograd je stvaran grad.'",
  "Return only JSON. Do not include markdown, commentary, or extra keys.",
].join("\n");

const GRADOVI_AI_RESPONSE_SCHEMA =
  '{"results":[{"key":"same key from input","valid":true,"confidence":0.0,"reason":"short reason"}]}';

const GRADOVI_CATEGORY_CONTEXT: Record<string, string> = {
  Grad: "A city or town. Accept well-known municipalities and local city names.",
  Selo: "A village or small settlement. Accept local place names, not generic words.",
  Država: "A country or sovereign state. Accept common local names and recognizable exonyms.",
  Rijeka: "A river. Do not accept cities, lakes, seas, or people.",
  Biljka: "A plant, tree, flower, crop, herb, fruit, or vegetable by common name.",
  Životinja: "An animal species or common animal group. Do not accept fictional characters.",
  Ime: "A human first name. Accept common regional and international first names.",
  Stvar: "A concrete object, item, or thing. Reject vague fillers like 'thing' or 'something'.",
  "Marka automobila": "A car brand, manufacturer, or widely recognized car marque.",
  Planina: "A mountain or mountain range.",
  Sport: "A recognized sport or sport discipline.",
  Zanimanje: "A profession, occupation, role, or job title.",
  "Jelo ili piće": "A food, dish, ingredient commonly used as food, or drink.",
  "Film ili serija": "A movie, TV series, or widely known show title.",
  Pjesma: "A song title. Accept local and international songs if recognizable.",
  Klub: "A sports club or widely known organization called a club. Reject generic 'club'.",
  "Poznata osoba": "A real public or historically known person. Reject fictional characters.",
  Boja: "A color name or common shade name.",
};

function isGradoviIntent(value: unknown): value is GradoviIntent {
  return Boolean(value && typeof value === "object" && "kind" in value);
}

function normalizeAnswer(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("bs");
}

function readAnswer(state: GradoviState, playerId: string, category: string): string {
  return state.answers[playerId]?.[category]?.trim() ?? "";
}

function emptyRoundScores(playerIds: string[], categories: string[]) {
  return Object.fromEntries(
    playerIds.map((playerId) => [
      playerId,
      Object.fromEntries(categories.map((category) => [category, 0])),
    ]),
  );
}

function calculateRoundScores(state: GradoviState): GradoviState["roundScores"] {
  const playerIds = Object.keys(state.scores);
  const roundScores = emptyRoundScores(playerIds, state.categories);

  for (const category of state.categories) {
    const answersByValue = new Map<string, string[]>();

    for (const playerId of playerIds) {
      const answer = readAnswer(state, playerId, category);
      if (!answer || state.validations[playerId]?.[category]?.status !== "valid") continue;

      const normalized = normalizeAnswer(answer);
      const answerPlayers = answersByValue.get(normalized) ?? [];
      answerPlayers.push(playerId);
      answersByValue.set(normalized, answerPlayers);
    }

    for (const answerPlayers of answersByValue.values()) {
      const points = answerPlayers.length === 1 ? 10 : 5;
      for (const playerId of answerPlayers) {
        roundScores[playerId][category] = points;
      }
    }
  }

  return roundScores;
}

function readNumberEnv(name: string, fallback: number): number {
  const parsed = Number.parseFloat(process.env[name] ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function candidateKey(playerId: string, category: string): string {
  return `${playerId}::${category}`;
}

function isAiCandidate(state: GradoviState, playerId: string, category: string): boolean {
  const answer = readAnswer(state, playerId, category);
  if (!answer) return false;

  const validation = state.validations[playerId]?.[category];
  if (!validation) return false;
  if (validation.source === "host" || validation.source === "word-pool") return false;
  if (validation.source === "rule" && validation.status === "invalid") return false;
  return true;
}

export function getGradoviAiCandidates(state: GradoviState): AiCandidate[] {
  if (state.phase !== "review") return [];

  const maxCandidates = Math.max(1, Math.floor(readNumberEnv("GRADOVI_AI_MAX_CANDIDATES", 20)));
  const candidates: AiCandidate[] = [];

  for (const playerId of Object.keys(state.scores)) {
    for (const category of state.categories) {
      if (!isAiCandidate(state, playerId, category)) continue;
      candidates.push({
        key: candidateKey(playerId, category),
        playerId,
        category,
        answer: readAnswer(state, playerId, category),
      });
      if (candidates.length >= maxCandidates) return candidates;
    }
  }

  return candidates;
}

function parseAiSuggestions(value: unknown): AiSuggestion[] {
  const container = value && typeof value === "object" ? value as { results?: unknown } : {};
  const rows = Array.isArray(container.results) ? container.results : [];
  return rows
    .map((row): AiSuggestion | null => {
      if (!row || typeof row !== "object") return null;
      const raw = row as {
        key?: unknown;
        valid?: unknown;
        confidence?: unknown;
        reason?: unknown;
      };
      if (typeof raw.key !== "string" || typeof raw.valid !== "boolean") return null;
      const confidence =
        typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
          ? Math.max(0, Math.min(1, raw.confidence))
          : 0.5;
      const reason =
        typeof raw.reason === "string" && raw.reason.trim()
          ? raw.reason.replace(/\s+/g, " ").trim().slice(0, 110)
          : "AI suggestion.";
      return { key: raw.key, valid: raw.valid, confidence, reason };
    })
    .filter((row) => row !== null);
}

function parseJsonObject(value: string): unknown {
  const trimmed = value.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(unfenced);
}

function buildGradoviAiPrompt(state: GradoviState, candidates: AiCandidate[]): string {
  const selectedCategories = Array.from(new Set(candidates.map((candidate) => candidate.category)));
  const categoryGuide = Object.fromEntries(
    selectedCategories.map((category) => [
      category,
      GRADOVI_CATEGORY_CONTEXT[category] ?? "A real, specific answer for this category.",
    ]),
  );
  const extraContext = process.env.GRADOVI_AI_EXTRA_CONTEXT?.trim();
  const payload = {
    app: {
      name: "Plaza",
      game: "Gradovi i Sela",
      locale: "Bosnian/Croatian/Serbian",
      validationRole: "advisory-only",
      hostFinalAuthority: true,
    },
    round: {
      letter: state.letter,
      categories: state.categories,
      selectedCategoryGuide: categoryGuide,
    },
    policy: {
      alreadyCheckedByApp: [
        "empty answer",
        "one-character or too-short answer",
        "answer starts with the round letter",
      ],
      validMeans: [
        "real or widely recognizable",
        "specific enough for the category",
        "belongs to the submitted category",
      ],
      invalidMeans: [
        "wrong category",
        "generic filler",
        "obvious joke answer",
        "fictional answer in a real-person/category slot unless the category allows titles",
        "invented word or non-existent proper name",
        "changed diacritics or letters that alter the answer identity",
        "too ambiguous to trust",
      ],
      spelling: [
        "A submitted answer must stand on its own as written.",
        "Accept common no-diacritic forms only when they clearly refer to the same real answer.",
        "Reject spellings that add or change diacritics/letters into a different or non-existent word.",
        "Do not autocorrect a submitted answer into a valid different word.",
      ],
      confidence: {
        high: "0.85-1.0 when the answer is clearly valid or invalid",
        medium: "0.65-0.84 when likely but not certain",
        low: "below 0.65 when host should review",
      },
    },
    candidates: candidates.map(({ key, category, answer }) => ({ key, category, answer })),
  };

  return [
    "Use the following app/game context and validate each candidate answer.",
    "For every input candidate, return exactly one result with the same key.",
    "Keep reasons short, concrete, and in Bosnian/Croatian/Serbian Latin script.",
    `Required JSON shape: ${GRADOVI_AI_RESPONSE_SCHEMA}`,
    extraContext ? `Extra project context from env: ${extraContext}` : null,
    "",
    JSON.stringify(payload),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function getGradoviAiSuggestions(state: GradoviState): Promise<AiSuggestion[]> {
  const candidates = getGradoviAiCandidates(state);
  if (candidates.length === 0) return [];

  const prompt = buildGradoviAiPrompt(state, candidates);
  return getGeminiAiSuggestions(prompt);
}

async function getGeminiAiSuggestions(prompt: string): Promise<AiSuggestion[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: GRADOVI_AI_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini returned ${response.status}`);
    }

    const body = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: unknown }>;
        };
      }>;
    };
    const text = body.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text)
      .filter((part): part is string => typeof part === "string")
      .join("\n");

    if (!text) return [];
    return parseAiSuggestions(parseJsonObject(text));
  } finally {
    clearTimeout(timeout);
  }
}

export function applyGradoviAiSuggestions(
  state: GradoviState,
  suggestions: AiSuggestion[],
): GradoviState {
  if (state.phase !== "review" || suggestions.length === 0) return state;

  const threshold = readNumberEnv("GRADOVI_AI_CONFIDENCE_THRESHOLD", 0.65);
  const suggestionsByKey = new Map(suggestions.map((suggestion) => [suggestion.key, suggestion]));
  const validations = { ...state.validations };

  for (const playerId of Object.keys(state.scores)) {
    for (const category of state.categories) {
      if (!isAiCandidate(state, playerId, category)) continue;

      const suggestion = suggestionsByKey.get(candidateKey(playerId, category));
      if (!suggestion) continue;

      const existing = validations[playerId]?.[category];
      const status =
        suggestion.confidence >= threshold
          ? suggestion.valid
            ? "valid"
            : "invalid"
          : "needs-review";

      validations[playerId] = {
        ...(validations[playerId] ?? {}),
        [category]: {
          status,
          source: "ai",
          reason: `AI ${Math.round(suggestion.confidence * 100)}%: ${suggestion.reason}`,
          reports: existing?.reports ?? [],
        },
      };
    }
  }

  const updated = { ...state, validations };
  return { ...updated, roundScores: calculateRoundScores(updated) };
}

export async function applyGradoviWordPoolValidation(nextState: unknown): Promise<unknown> {
  const state = nextState as GradoviState;
  if (state.phase !== "review") return nextState;

  const lookups = Object.keys(state.scores).flatMap((playerId) =>
    state.categories
      .map((category) => {
        const answer = readAnswer(state, playerId, category);
        return answer
          ? {
              playerId,
              category,
              normalizedAnswer: normalizeAnswer(answer),
            }
          : null;
      })
      .filter((lookup) => lookup !== null),
  );
  const normalizedAnswers = Array.from(new Set(lookups.map((lookup) => lookup.normalizedAnswer)));
  if (normalizedAnswers.length === 0) return nextState;

  const words = await db
    .select()
    .from(schema.gradoviWords)
    .where(inArray(schema.gradoviWords.normalizedAnswer, normalizedAnswers));
  const wordsByKey = new Map(words.map((word) => [`${word.category}:${word.normalizedAnswer}`, word]));
  const validations = { ...state.validations };

  for (const lookup of lookups) {
    const word = wordsByKey.get(`${lookup.category}:${lookup.normalizedAnswer}`);
    if (!word || word.status === "pending") continue;

    const existing = validations[lookup.playerId]?.[lookup.category];
    if (existing?.source === "rule" && existing.status === "invalid") continue;
    validations[lookup.playerId] = {
      ...(validations[lookup.playerId] ?? {}),
      [lookup.category]: {
        status: word.status === "approved" ? "valid" : "invalid",
        source: "word-pool",
        reason:
          word.status === "approved"
            ? "Potvrđeno u bazi riječi."
            : "Odbijeno u bazi riječi.",
        reports: existing?.reports ?? [],
      } satisfies AnswerValidation,
    };
  }

  const updated = { ...state, validations };
  return { ...updated, roundScores: calculateRoundScores(updated) };
}

export async function persistGradoviValidationSideEffects({
  roomId,
  actorPlayerId,
  intent,
  nextState,
}: ValidationSideEffectContext) {
  if (!isGradoviIntent(intent)) return;
  const state = nextState as GradoviState;

  if (intent.kind === "report-answer") {
    const answer = readAnswer(state, intent.playerId, intent.category);
    if (!answer) return;

    await db.insert(schema.gradoviAnswerReports).values({
      roomId,
      round: state.round,
      category: intent.category,
      answer,
      normalizedAnswer: normalizeAnswer(answer),
      submittedByPlayerId: intent.playerId,
      reportedByPlayerId: actorPlayerId,
      reason: "Prijavljeno tokom pregleda runde.",
    });
    return;
  }

  if (intent.kind !== "review-answer") return;

  const answer = readAnswer(state, intent.playerId, intent.category);
  if (!answer) return;

  const normalizedAnswer = normalizeAnswer(answer);
  const status = intent.status === "valid" ? "approved" : "rejected";

  await db
    .insert(schema.gradoviWords)
    .values({
      category: intent.category,
      canonicalAnswer: answer,
      normalizedAnswer,
      status,
      source: "host",
      createdByPlayerId: actorPlayerId,
      reviewedByPlayerId: actorPlayerId,
      reviewedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.gradoviWords.category, schema.gradoviWords.normalizedAnswer],
      set: {
        canonicalAnswer: answer,
        status,
        source: "host",
        reviewedByPlayerId: actorPlayerId,
        reviewedAt: new Date(),
      },
    });
}
