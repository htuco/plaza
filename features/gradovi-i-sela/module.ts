import type { GameModule } from "@/features/registry";
import {
  ALL_GRADOVI_CATEGORIES,
  DEFAULT_GRADOVI_CATEGORIES,
  DEFAULT_GRADOVI_SETTINGS,
  GRADOVI_LETTERS,
  MAX_ROUND_DURATION_SECONDS,
  MAX_TOTAL_ROUNDS,
  MIN_ROUND_DURATION_SECONDS,
  MIN_TOTAL_ROUNDS,
  OPTIONAL_GRADOVI_CATEGORIES,
} from "./types";
import type {
  AnswerValidation,
  AnswerValidationStatus,
  GradoviIntent,
  GradoviSettings,
  GradoviState,
  GradoviView,
  Phase,
} from "./types";
import { GradoviClient } from "./client";

const MAX_ANSWER_LENGTH = 40;

function isGradoviIntent(value: unknown): value is GradoviIntent {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  const intent = value as {
    kind?: unknown;
    category?: unknown;
    playerId?: unknown;
    categories?: unknown;
    settings?: unknown;
    status?: unknown;
    value?: unknown;
  };

  if (intent.kind === "update-settings") {
    return !intent.settings || typeof intent.settings === "object";
  }
  if (intent.kind === "update-categories") {
    return (
      Array.isArray(intent.categories) &&
      intent.categories.every((category) => typeof category === "string")
    );
  }
  if (intent.kind === "set-answer") {
    return typeof intent.category === "string" && typeof intent.value === "string";
  }
  if (intent.kind === "review-answer") {
    return (
      typeof intent.playerId === "string" &&
      typeof intent.category === "string" &&
      (intent.status === "valid" || intent.status === "invalid")
    );
  }
  if (intent.kind === "report-answer") {
    return typeof intent.playerId === "string" && typeof intent.category === "string";
  }
  return (
    intent.kind === "submit" ||
    intent.kind === "start-round" ||
    intent.kind === "reveal" ||
    intent.kind === "lock-round"
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readPositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.floor(value);
}

function normalizePhase(value: unknown): Phase {
  if (
    value === "setup" ||
    value === "writing" ||
    value === "review" ||
    value === "reveal" ||
    value === "finished"
  ) {
    return value;
  }
  return value === "scored" ? "reveal" : "setup";
}

function normalizeSettings(value: unknown, minTotalRounds = MIN_TOTAL_ROUNDS): GradoviSettings {
  const raw =
    value && typeof value === "object"
      ? (value as Partial<GradoviSettings>)
      : DEFAULT_GRADOVI_SETTINGS;
  const duration = readPositiveInteger(raw.roundDurationSeconds);
  const totalRounds = readPositiveInteger(raw.totalRounds);

  return {
    roundDurationSeconds: clamp(
      duration ?? DEFAULT_GRADOVI_SETTINGS.roundDurationSeconds,
      MIN_ROUND_DURATION_SECONDS,
      MAX_ROUND_DURATION_SECONDS,
    ),
    totalRounds: clamp(
      totalRounds ?? DEFAULT_GRADOVI_SETTINGS.totalRounds,
      minTotalRounds,
      MAX_TOTAL_ROUNDS,
    ),
  };
}

function updateSettings(current: GradoviState, patch: Partial<GradoviSettings>): GradoviState {
  const minTotalRounds =
    current.phase === "setup" ? MIN_TOTAL_ROUNDS : Math.max(MIN_TOTAL_ROUNDS, current.round + 1);
  return {
    ...current,
    settings: normalizeSettings({ ...current.settings, ...patch }, minTotalRounds),
  };
}

function normalizeCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_GRADOVI_CATEGORIES];
  const requested = new Set(value.filter((category): category is string => typeof category === "string"));
  const allowed = new Set<string>(ALL_GRADOVI_CATEGORIES);
  return [
    ...DEFAULT_GRADOVI_CATEGORIES,
    ...OPTIONAL_GRADOVI_CATEGORIES.filter(
      (category) => requested.has(category) && allowed.has(category),
    ),
  ];
}

function updateCategories(current: GradoviState, categories: string[]): GradoviState {
  const nextCategories = normalizeCategories(categories);
  const playerIds = Object.keys(current.scores);
  return {
    ...current,
    categories: nextCategories,
    answers: emptyPlayerMap(playerIds, (playerId) =>
      Object.fromEntries(
        nextCategories.map((category) => [category, current.answers[playerId]?.[category] ?? ""]),
      ),
    ),
    validations: emptyValidations(playerIds, nextCategories),
    roundScores: emptyRoundScores(playerIds, nextCategories),
  };
}

function shuffleLetters(): string[] {
  const result = [...GRADOVI_LETTERS];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function normalizeLetterQueue(value: unknown, currentLetter: string): string[] {
  const allowed = new Set<string>(GRADOVI_LETTERS);
  const seen = new Set<string>();
  const stored = Array.isArray(value)
    ? value.filter((letter): letter is string => {
        if (typeof letter !== "string" || !allowed.has(letter) || seen.has(letter)) return false;
        seen.add(letter);
        return true;
      })
    : [];
  const queue =
    stored.length > 0
      ? [...stored, ...GRADOVI_LETTERS.filter((letter) => !seen.has(letter))]
      : shuffleLetters();

  if (!allowed.has(currentLetter)) return queue;
  return [...queue.filter((letter) => letter !== currentLetter), currentLetter];
}

function rotateLetter(queue: string[]): { letter: string; letterQueue: string[] } {
  const [letter = GRADOVI_LETTERS[0], ...rest] = normalizeLetterQueue(queue, "");
  return { letter, letterQueue: [...rest, letter] };
}

function isGradoviLetter(value: string | undefined): value is string {
  return value !== undefined && new Set<string>(GRADOVI_LETTERS).has(value);
}

function nextLetter(
  queue: string[],
  globalLetter: string | undefined,
): { letter: string; letterQueue: string[] } {
  if (isGradoviLetter(globalLetter)) {
    return {
      letter: globalLetter,
      letterQueue: normalizeLetterQueue(queue, globalLetter),
    };
  }
  return rotateLetter(queue);
}

function emptyPlayerMap<T>(playerIds: string[], value: (playerId: string) => T): Record<string, T> {
  return Object.fromEntries(playerIds.map((id) => [id, value(id)]));
}

function emptyRoundScores(playerIds: string[], categories: string[]) {
  return emptyPlayerMap(playerIds, () =>
    Object.fromEntries(categories.map((category) => [category, 0])),
  );
}

function defaultValidation(reason: string): AnswerValidation {
  return {
    status: "needs-review",
    source: "rule",
    reason,
    reports: [],
  };
}

function emptyValidations(playerIds: string[], categories: string[]) {
  return emptyPlayerMap(playerIds, () =>
    Object.fromEntries(categories.map((category) => [category, defaultValidation("Not reviewed.")])),
  );
}

function sanitizeAnswer(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_ANSWER_LENGTH);
}

function normalizeAnswer(value: string): string {
  return sanitizeAnswer(value).toLocaleLowerCase("bs");
}

function startsWithLetter(value: string, letter: string): boolean {
  return sanitizeAnswer(value).toLocaleUpperCase("bs").startsWith(letter);
}

function meaningfulCharacterCount(value: string): number {
  return sanitizeAnswer(value).match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

function ensurePlayer(state: GradoviState, playerId: string): GradoviState {
  if (state.scores[playerId] !== undefined) return state;
  return {
    ...state,
    answers: { ...state.answers, [playerId]: {} },
    submitted: { ...state.submitted, [playerId]: false },
    validations: {
      ...state.validations,
      [playerId]: Object.fromEntries(
        state.categories.map((category) => [
          category,
          defaultValidation("Joined after the round started."),
        ]),
      ),
    },
    scores: { ...state.scores, [playerId]: 0 },
    roundScores: {
      ...state.roundScores,
      [playerId]: Object.fromEntries(state.categories.map((category) => [category, 0])),
    },
  };
}

function normalizeValidation(value: AnswerValidation | undefined): AnswerValidation {
  return {
    status: value?.status ?? "needs-review",
    source: value?.source ?? "rule",
    reason: value?.reason ?? "Not reviewed.",
    reports: value?.reports ?? [],
  };
}

function normalizeState(state: GradoviState): GradoviState {
  const stored = state as Partial<GradoviState>;
  const categories = normalizeCategories(stored.categories);
  const storedAnswers = stored.answers ?? {};
  const storedSubmitted = stored.submitted ?? {};
  const storedValidations = stored.validations ?? {};
  const storedScores = stored.scores ?? {};
  const storedRoundScores = stored.roundScores ?? {};
  const playerIds = Array.from(
    new Set([
      ...Object.keys(storedAnswers),
      ...Object.keys(storedSubmitted),
      ...Object.keys(storedValidations),
      ...Object.keys(storedScores),
      ...Object.keys(storedRoundScores),
    ]),
  );

  return {
    phase: normalizePhase(stored.phase),
    letter: stored.letter ?? "",
    letterQueue: normalizeLetterQueue(stored.letterQueue, stored.letter ?? ""),
    categories,
    settings: normalizeSettings(stored.settings),
    answers: emptyPlayerMap(playerIds, (id) => storedAnswers[id] ?? {}),
    submitted: emptyPlayerMap(playerIds, (id) => Boolean(storedSubmitted[id])),
    validations: emptyPlayerMap(playerIds, (id) => {
      const playerValidations = storedValidations[id] ?? {};
      return Object.fromEntries(
        categories.map((category) => [
          category,
          normalizeValidation(playerValidations[category]),
        ]),
      );
    }),
    scores: emptyPlayerMap(playerIds, (id) => storedScores[id] ?? 0),
    roundScores: emptyPlayerMap(playerIds, (id) => ({
      ...Object.fromEntries(categories.map((category) => [category, 0])),
      ...(storedRoundScores[id] ?? {}),
    })),
    round: stored.round ?? 0,
    deadlineAt: typeof stored.deadlineAt === "number" ? stored.deadlineAt : null,
    hostId: stored.hostId ?? "",
  };
}

function startRound(
  state: GradoviState,
  now: Date,
  globalLetter: string | undefined,
): GradoviState {
  const playerIds = Object.keys(state.scores);
  const pickedLetter = nextLetter(state.letterQueue, globalLetter);
  return {
    ...state,
    phase: "writing",
    letter: pickedLetter.letter,
    letterQueue: pickedLetter.letterQueue,
    answers: emptyPlayerMap(playerIds, () => ({})),
    submitted: emptyPlayerMap(playerIds, () => false),
    validations: emptyValidations(playerIds, state.categories),
    roundScores: emptyRoundScores(playerIds, state.categories),
    round: state.round + 1,
    deadlineAt: now.getTime() + state.settings.roundDurationSeconds * 1000,
  };
}

export function shouldReserveGradoviLetter(
  state: GradoviState,
  rawIntent: unknown,
  ctx: { playerId: string; now: Date },
): boolean {
  if (!isGradoviIntent(rawIntent) || rawIntent.kind !== "start-round") return false;
  const current = ensurePlayer(normalizeState(state), ctx.playerId);
  const deadlinePassed =
    current.deadlineAt !== null && ctx.now.getTime() >= current.deadlineAt;

  if (ctx.playerId !== current.hostId) return false;
  if (current.phase === "finished" || current.phase === "review") return false;
  if (current.phase === "writing" && current.deadlineAt !== null && !deadlinePassed) {
    return false;
  }

  const ready = current.phase === "writing" ? prepareReview(current) : current;
  return ready.round < ready.settings.totalRounds;
}

function validateAnswer(answer: string, letter: string): AnswerValidation {
  if (!answer) {
    return { status: "invalid", source: "rule", reason: "Prazan odgovor.", reports: [] };
  }
  if (meaningfulCharacterCount(answer) < 2) {
    return { status: "invalid", source: "rule", reason: "Odgovor je prekratak.", reports: [] };
  }
  if (!startsWithLetter(answer, letter)) {
    return {
      status: "invalid",
      source: "rule",
      reason: `Ne počinje slovom ${letter}.`,
      reports: [],
    };
  }
  return {
    status: "valid",
    source: "rule",
    reason: "Počinje slovom runde.",
    reports: [],
  };
}

function buildValidations(state: GradoviState): GradoviState["validations"] {
  const playerIds = Object.keys(state.scores);
  return emptyPlayerMap(playerIds, (playerId) =>
    Object.fromEntries(
      state.categories.map((category) => [
        category,
        validateAnswer(state.answers[playerId]?.[category] ?? "", state.letter),
      ]),
    ),
  );
}

function calculateRoundScores(state: GradoviState): GradoviState["roundScores"] {
  const playerIds = Object.keys(state.scores);
  const roundScores = emptyRoundScores(playerIds, state.categories);

  for (const category of state.categories) {
    const answersByValue = new Map<string, string[]>();

    for (const playerId of playerIds) {
      const answer = state.answers[playerId]?.[category] ?? "";
      const validation = state.validations[playerId]?.[category];
      if (!answer || validation?.status !== "valid") continue;

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

function prepareReview(state: GradoviState): GradoviState {
  const playerIds = Object.keys(state.scores);
  const withValidations = {
    ...state,
    submitted: emptyPlayerMap(playerIds, () => true),
    validations: buildValidations(state),
    deadlineAt: null,
  };

  return {
    ...withValidations,
    phase: "review",
    roundScores: calculateRoundScores(withValidations),
  };
}

function allSubmitted(state: GradoviState): boolean {
  return Object.keys(state.scores).every((playerId) => state.submitted[playerId]);
}

function isKnownPlayer(state: GradoviState, playerId: string): boolean {
  return state.scores[playerId] !== undefined;
}

export const gradoviModule: GameModule<GradoviState, GradoviIntent, GradoviView> = {
  id: "gradovi-i-sela",
  displayName: "Gradovi i Sela",
  tagline: "A letter drops - race to fill the categories.",
  minPlayers: 2,
  maxPlayers: 12,

  initialState: ({ playerIds, hostId }) => ({
    phase: "setup",
    letter: "",
    letterQueue: shuffleLetters(),
    categories: [...DEFAULT_GRADOVI_CATEGORIES],
    settings: DEFAULT_GRADOVI_SETTINGS,
    answers: emptyPlayerMap(playerIds, () => ({})),
    submitted: emptyPlayerMap(playerIds, () => false),
    validations: emptyValidations(playerIds, [...DEFAULT_GRADOVI_CATEGORIES]),
    scores: emptyPlayerMap(playerIds, () => 0),
    roundScores: emptyRoundScores(playerIds, [...DEFAULT_GRADOVI_CATEGORIES]),
    round: 0,
    deadlineAt: null,
    hostId,
  }),

  reduce: (state, rawIntent, ctx) => {
    if (!isGradoviIntent(rawIntent)) throw new Error("Invalid Gradovi i Sela action.");
    const intent = rawIntent;
    const current = ensurePlayer(normalizeState(state), ctx.playerId);
    const deadlinePassed =
      current.deadlineAt !== null && ctx.now.getTime() >= current.deadlineAt;

    if (intent.kind === "update-settings") {
      if (ctx.playerId !== current.hostId) throw new Error("Only the host can change settings.");
      if (current.phase === "writing" || current.phase === "review") {
        throw new Error("Settings are locked during the round.");
      }
      if (current.phase === "finished") throw new Error("Game is already finished.");
      return updateSettings(current, intent.settings);
    }

    if (intent.kind === "update-categories") {
      if (ctx.playerId !== current.hostId) throw new Error("Only the host can change categories.");
      if (current.phase !== "setup") throw new Error("Categories are locked after the game starts.");
      return updateCategories(current, intent.categories);
    }

    if (intent.kind === "start-round") {
      if (ctx.playerId !== current.hostId) throw new Error("Only the host can start a round.");
      if (current.phase === "finished") throw new Error("Game is already finished.");
      if (current.phase === "review") throw new Error("Lock the current round first.");
      if (current.phase === "writing" && current.deadlineAt !== null && !deadlinePassed) {
        throw new Error("Reveal the current round first.");
      }
      const ready = current.phase === "writing" ? prepareReview(current) : current;
      if (ready.round >= ready.settings.totalRounds) {
        return { ...ready, phase: "finished", deadlineAt: null };
      }
      return startRound(ready, ctx.now, ctx.gradoviLetter);
    }

    if (intent.kind === "reveal") {
      if (current.phase !== "writing") return current;
      if (ctx.playerId !== current.hostId && !deadlinePassed) {
        throw new Error("Only the host can reveal before time runs out.");
      }
      return prepareReview(current);
    }

    if (intent.kind === "submit") {
      if (current.phase !== "writing") throw new Error("Round is not accepting answers.");
      if (deadlinePassed) return prepareReview(current);

      const next = {
        ...current,
        submitted: { ...current.submitted, [ctx.playerId]: true },
      };
      return allSubmitted(next) ? prepareReview(next) : next;
    }

    if (intent.kind === "review-answer") {
      if (ctx.playerId !== current.hostId) throw new Error("Only the host can review answers.");
      if (current.phase !== "review") throw new Error("Round is not in review.");
      if (!current.categories.includes(intent.category)) throw new Error("Unknown category.");
      if (!isKnownPlayer(current, intent.playerId)) throw new Error("Unknown player.");

      const next = {
        ...current,
        validations: {
          ...current.validations,
          [intent.playerId]: {
            ...(current.validations[intent.playerId] ?? {}),
            [intent.category]: {
              status: intent.status,
              source: "host",
              reason: intent.status === "valid" ? "Host prihvatio." : "Host odbio.",
              reports: current.validations[intent.playerId]?.[intent.category]?.reports ?? [],
            } satisfies AnswerValidation,
          },
        },
      };

      return { ...next, roundScores: calculateRoundScores(next) };
    }

    if (intent.kind === "report-answer") {
      if (current.phase !== "review") throw new Error("Round is not in review.");
      if (!current.categories.includes(intent.category)) throw new Error("Unknown category.");
      if (!isKnownPlayer(current, intent.playerId)) throw new Error("Unknown player.");

      const existing =
        current.validations[intent.playerId]?.[intent.category] ??
        defaultValidation("Prijavio igrač.");
      const reports = Array.from(new Set([...existing.reports, ctx.playerId]));
      const nextStatus: AnswerValidationStatus =
        existing.source === "host" ? existing.status : "needs-review";
      const next = {
        ...current,
        validations: {
          ...current.validations,
          [intent.playerId]: {
            ...(current.validations[intent.playerId] ?? {}),
            [intent.category]: {
              ...existing,
              status: nextStatus,
              reason: existing.source === "host" ? existing.reason : "Prijavio igrač.",
              reports,
            },
          },
        },
      };

      return { ...next, roundScores: calculateRoundScores(next) };
    }

    if (intent.kind === "lock-round") {
      if (ctx.playerId !== current.hostId) throw new Error("Only the host can lock the round.");
      if (current.phase !== "review") throw new Error("Round is not in review.");

      const scores = { ...current.scores };
      for (const playerId of Object.keys(scores)) {
        const roundTotal = Object.values(current.roundScores[playerId] ?? {}).reduce(
          (total, points) => total + points,
          0,
        );
        scores[playerId] += roundTotal;
      }

      return {
        ...current,
        scores,
        phase: current.round >= current.settings.totalRounds ? "finished" : "reveal",
        deadlineAt: null,
      };
    }

    if (current.phase !== "writing") throw new Error("Round is not accepting answers.");
    if (deadlinePassed) throw new Error("Time is up.");
    if (current.submitted[ctx.playerId]) throw new Error("Answers are already submitted.");
    if (!current.categories.includes(intent.category)) throw new Error("Unknown category.");

    return {
      ...current,
      answers: {
        ...current.answers,
        [ctx.playerId]: {
          ...(current.answers[ctx.playerId] ?? {}),
          [intent.category]: sanitizeAnswer(intent.value),
        },
      },
    };
  },

  redact: (state, playerId): GradoviView => {
    const current = normalizeState(state);
    return {
      phase: current.phase,
      letter: current.letter,
      categories: current.categories,
      settings: current.settings,
      myAnswers: current.answers[playerId] ?? {},
      allAnswers: current.phase === "writing" ? null : current.answers,
      submitted: current.submitted,
      validations: current.validations,
      scores: current.scores,
      roundScores: current.roundScores,
      round: current.round,
      deadlineAt: current.deadlineAt,
      isHost: playerId === current.hostId,
    };
  },

  ClientComponent: GradoviClient,
};
