import type { GameModule } from "@/features/registry";
import {
  ARTIST_POINTS,
  CLIP_LENGTH_OPTIONS,
  COUNTDOWN_SECONDS,
  DEFAULT_CLIP_LENGTH_SECONDS,
  DEFAULT_SONG_SETTINGS,
  FIRST_MATCH_BONUS,
  MAX_GUESS_DURATION_SECONDS,
  MAX_SONG_ROUNDS,
  MIN_GUESS_DURATION_SECONDS,
  MIN_SONG_ROUNDS,
  PREVIEW_USABLE_SECONDS,
  ROUND_END_PAUSE_SECONDS,
  SPEED_BONUS_MAX,
  TITLE_POINTS,
  clipLengthMultiplier,
  suggestedGuessDuration,
} from "./types";
import type {
  AnswerMode,
  GuessTheSongIntent,
  GuessTheSongSettings,
  GuessTheSongState,
  GuessTheSongView,
  Phase,
  PlayerRoundProgress,
  SongTrack,
} from "./types";
import { GuessTheSongClient } from "./client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isGuessTheSongIntent(value: unknown): value is GuessTheSongIntent {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "update-settings":
      return !value.settings || typeof value.settings === "object";
    case "submit-guess":
      return typeof value.guess === "string";
    case "end-round":
    case "resolve-countdown":
    case "next-round":
    case "play-again":
      return true;
    default:
      return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isAnswerMode(value: unknown): value is AnswerMode {
  return value === "title" || value === "artist" || value === "both";
}

function normalizeSettings(value: unknown): GuessTheSongSettings {
  const raw = isRecord(value) ? value : {};
  const rounds =
    typeof raw.totalRounds === "number" && Number.isFinite(raw.totalRounds)
      ? Math.floor(raw.totalRounds)
      : DEFAULT_SONG_SETTINGS.totalRounds;
  const duration =
    typeof raw.guessDurationSeconds === "number" && Number.isFinite(raw.guessDurationSeconds)
      ? Math.floor(raw.guessDurationSeconds)
      : DEFAULT_SONG_SETTINGS.guessDurationSeconds;
  const guessDurationSeconds = clamp(
    duration,
    MIN_GUESS_DURATION_SECONDS,
    MAX_GUESS_DURATION_SECONDS,
  );
  const requestedClip =
    typeof raw.clipLengthSeconds === "number" && Number.isFinite(raw.clipLengthSeconds)
      ? Math.floor(raw.clipLengthSeconds)
      : DEFAULT_CLIP_LENGTH_SECONDS;
  return {
    totalRounds: clamp(rounds, MIN_SONG_ROUNDS, MAX_SONG_ROUNDS),
    guessDurationSeconds,
    // Playing past the buzzer makes no sense, so a clip never outlasts the
    // guess window; snap to the nearest allowed option at or below the cap.
    clipLengthSeconds: nearestClipLength(requestedClip, guessDurationSeconds),
    answerMode: isAnswerMode(raw.answerMode) ? raw.answerMode : DEFAULT_SONG_SETTINGS.answerMode,
  };
}

function nearestClipLength(requested: number, guessDurationSeconds: number): number {
  const allowed = CLIP_LENGTH_OPTIONS.filter((option) => option <= guessDurationSeconds);
  const candidates = allowed.length > 0 ? allowed : [CLIP_LENGTH_OPTIONS[0]];
  return candidates.reduce((best, option) =>
    Math.abs(option - requested) < Math.abs(best - requested) ? option : best,
  );
}

function normalizePhase(value: unknown): Phase {
  return value === "countdown" ||
    value === "playing" ||
    value === "round-end" ||
    value === "finished"
    ? value
    : "setup";
}

function normalizeTracks(value: unknown): SongTrack[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is SongTrack =>
      isRecord(entry) &&
      typeof entry.trackId === "string" &&
      typeof entry.title === "string" &&
      typeof entry.artist === "string" &&
      typeof entry.previewUrl === "string",
  );
}

function normalizeProgress(value: unknown): Record<string, PlayerRoundProgress> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
      .map(([playerId, progress]) => [
        playerId,
        {
          titleMatched: progress.titleMatched === true,
          artistMatched: progress.artistMatched === true,
        },
      ]),
  );
}

function normalizeNumberMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
}

export function normalizeSongState(state: GuessTheSongState): GuessTheSongState {
  const stored = (state ?? {}) as Partial<GuessTheSongState>;
  return {
    phase: normalizePhase(stored.phase),
    settings: normalizeSettings(stored.settings),
    playlistLabel: typeof stored.playlistLabel === "string" ? stored.playlistLabel : null,
    tracks: normalizeTracks(stored.tracks),
    roundIndex:
      typeof stored.roundIndex === "number" && stored.roundIndex >= 0
        ? Math.floor(stored.roundIndex)
        : 0,
    clipStartSeconds:
      typeof stored.clipStartSeconds === "number" && stored.clipStartSeconds >= 0
        ? stored.clipStartSeconds
        : 0,
    playbackStartAt: typeof stored.playbackStartAt === "number" ? stored.playbackStartAt : null,
    roundDeadlineAt: typeof stored.roundDeadlineAt === "number" ? stored.roundDeadlineAt : null,
    roundEndAdvanceAt:
      typeof stored.roundEndAdvanceAt === "number" ? stored.roundEndAdvanceAt : null,
    progress: normalizeProgress(stored.progress),
    firstMatchPlayerId:
      typeof stored.firstMatchPlayerId === "string" ? stored.firstMatchPlayerId : null,
    roundPoints: normalizeNumberMap(stored.roundPoints),
    scores: normalizeNumberMap(stored.scores),
    hostId: typeof stored.hostId === "string" ? stored.hostId : "",
  };
}

// Loose guess matching: case/diacritic-insensitive, ignores "(feat …)" suffixes
// and punctuation; accepts exact match or containment for longer answers.
function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\bfeat\.?.*$/i, " ")
    .replace(/-\s*(single|remastered|live|radio edit).*/i, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replaceAll("đ", "dj")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Exact match only (after normalizing case/diacritics/punctuation) — no typo
// tolerance, so a different/longer word never gets credit for a real answer.
export function guessMatchesAnswer(guess: string, answer: string): boolean {
  const normalizedGuess = normalizeForMatch(guess);
  const normalizedAnswer = normalizeForMatch(answer);
  if (!normalizedGuess || !normalizedAnswer) return false;
  if (normalizedGuess === normalizedAnswer) return true;

  // Multi-word answers (e.g. "bohemian rhapsody"): also accept a guess that
  // exactly matches just one significant word of the title, so players
  // don't have to type the whole thing.
  const answerWords = normalizedAnswer.split(" ").filter((w) => w.length >= 3);
  return answerWords.length > 1 && answerWords.includes(normalizedGuess);
}

function effectiveRounds(state: GuessTheSongState): number {
  if (state.tracks.length === 0) return state.settings.totalRounds;
  return Math.min(state.settings.totalRounds, state.tracks.length);
}

function currentTrack(state: GuessTheSongState): SongTrack | null {
  return state.tracks[state.roundIndex] ?? null;
}

function playerDone(state: GuessTheSongState, progress: PlayerRoundProgress): boolean {
  if (state.settings.answerMode === "title") return progress.titleMatched;
  if (state.settings.answerMode === "artist") return progress.artistMatched;
  return progress.titleMatched && progress.artistMatched;
}

// Answer early, keep more of the bonus. Uses the server-held deadline and the
// server's clock — a client-reported timestamp would be trivially forgeable.
function speedBonus(state: GuessTheSongState, now: number): number {
  if (state.roundDeadlineAt === null) return 0;
  const windowMs = state.settings.guessDurationSeconds * 1000;
  if (windowMs <= 0) return 0;
  const remainingFraction = clamp((state.roundDeadlineAt - now) / windowMs, 0, 1);
  return Math.round(SPEED_BONUS_MAX * remainingFraction);
}

function endRound(state: GuessTheSongState, now: number): GuessTheSongState {
  return {
    ...state,
    phase: "round-end",
    roundDeadlineAt: null,
    roundEndAdvanceAt: now + ROUND_END_PAUSE_SECONDS * 1000,
  };
}

// A short clip taken from 0:00 every round would always be the same intro, so
// the server picks where in the preview it starts. It lives in state (not on
// each client) so every device plays the identical segment.
export function pickClipStart(clipLengthSeconds: number): number {
  const room = PREVIEW_USABLE_SECONDS - clipLengthSeconds;
  if (room <= 0) return 0;
  return Math.floor(Math.random() * room);
}

// Every round (including the first) opens with a shared 3-2-1 countdown so
// playback starts at the same instant on every device.
function startCountdown(state: GuessTheSongState, roundIndex: number, now: number): GuessTheSongState {
  return {
    ...state,
    phase: "countdown",
    roundIndex,
    clipStartSeconds: pickClipStart(state.settings.clipLengthSeconds),
    playbackStartAt: now + COUNTDOWN_SECONDS * 1000,
    roundDeadlineAt: null,
    roundEndAdvanceAt: null,
    progress: {},
    firstMatchPlayerId: null,
    roundPoints: {},
  };
}

export const guessTheSongModule: GameModule<
  GuessTheSongState,
  GuessTheSongIntent,
  GuessTheSongView
> = {
  id: "guess-the-song",
  displayName: "Guess the Song",
  tagline: "Name the track before anyone else.",
  minPlayers: 2,
  maxPlayers: 12,

  initialState: ({ playerIds, hostId }) => ({
    phase: "setup",
    settings: { ...DEFAULT_SONG_SETTINGS },
    playlistLabel: null,
    tracks: [],
    roundIndex: 0,
    clipStartSeconds: 0,
    playbackStartAt: null,
    roundDeadlineAt: null,
    roundEndAdvanceAt: null,
    progress: {},
    firstMatchPlayerId: null,
    roundPoints: {},
    scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
    hostId,
  }),

  reduce: (state, rawIntent, ctx) => {
    if (!isGuessTheSongIntent(rawIntent)) throw new Error("Invalid Guess the Song action.");
    const intent = rawIntent;
    const current = normalizeSongState(state);
    const isHost = ctx.playerId === current.hostId;
    const deadlinePassed =
      current.roundDeadlineAt !== null && ctx.now.getTime() >= current.roundDeadlineAt;

    if (intent.kind === "update-settings") {
      if (!isHost) throw new Error("Only the host can change settings.");
      if (current.phase !== "setup") throw new Error("Settings are locked after the game starts.");
      const requested = intent.settings ?? {};
      // Changing the clip retunes the guess window to suit it, unless the host
      // set both at once — otherwise a 2s clip keeps a 50s countdown of dead air.
      const retuned =
        requested.clipLengthSeconds !== undefined && requested.guessDurationSeconds === undefined
          ? { guessDurationSeconds: suggestedGuessDuration(requested.clipLengthSeconds) }
          : {};
      return {
        ...current,
        settings: normalizeSettings({ ...current.settings, ...requested, ...retuned }),
      };
    }

    if (intent.kind === "submit-guess") {
      if (current.phase !== "playing") throw new Error("Round is not running.");
      if (deadlinePassed) return endRound(current, ctx.now.getTime());
      const track = currentTrack(current);
      if (!track) throw new Error("Round is not running.");

      const progress = current.progress[ctx.playerId] ?? {
        titleMatched: false,
        artistMatched: false,
      };
      if (playerDone(current, progress)) throw new Error("You already guessed this one.");

      const wantTitle = current.settings.answerMode !== "artist";
      const wantArtist = current.settings.answerMode !== "title";
      const hitTitle =
        wantTitle && !progress.titleMatched && guessMatchesAnswer(intent.guess, track.title);
      const hitArtist =
        wantArtist && !progress.artistMatched && guessMatchesAnswer(intent.guess, track.artist);
      if (!hitTitle && !hitArtist) throw new Error("Wrong guess.");

      let points = (hitTitle ? TITLE_POINTS : 0) + (hitArtist ? ARTIST_POINTS : 0);
      points += speedBonus(current, ctx.now.getTime());
      let firstMatchPlayerId = current.firstMatchPlayerId;
      if (firstMatchPlayerId === null) {
        firstMatchPlayerId = ctx.playerId;
        points += FIRST_MATCH_BONUS;
      }
      // Shorter clip = harder round = bigger payout.
      points = Math.round(points * clipLengthMultiplier(current.settings.clipLengthSeconds));

      const nextProgress: Record<string, PlayerRoundProgress> = {
        ...current.progress,
        [ctx.playerId]: {
          titleMatched: progress.titleMatched || hitTitle,
          artistMatched: progress.artistMatched || hitArtist,
        },
      };

      const next: GuessTheSongState = {
        ...current,
        progress: nextProgress,
        firstMatchPlayerId,
        roundPoints: {
          ...current.roundPoints,
          [ctx.playerId]: (current.roundPoints[ctx.playerId] ?? 0) + points,
        },
        scores: {
          ...current.scores,
          [ctx.playerId]: (current.scores[ctx.playerId] ?? 0) + points,
        },
      };

      const everyoneDone = ctx.playerIds.every((playerId) =>
        playerDone(next, next.progress[playerId] ?? { titleMatched: false, artistMatched: false }),
      );
      return everyoneDone ? endRound(next, ctx.now.getTime()) : next;
    }

    if (intent.kind === "end-round") {
      if (current.phase !== "playing") throw new Error("Round is not running.");
      if (!isHost && !deadlinePassed) throw new Error("The round is still running.");
      return endRound(current, ctx.now.getTime());
    }

    if (intent.kind === "resolve-countdown") {
      if (current.phase !== "countdown") throw new Error("No countdown is running.");
      const startPassed =
        current.playbackStartAt !== null && ctx.now.getTime() >= current.playbackStartAt;
      if (!startPassed) throw new Error("Countdown is still running.");
      return {
        ...current,
        phase: "playing",
        roundDeadlineAt: ctx.now.getTime() + current.settings.guessDurationSeconds * 1000,
      };
    }

    if (intent.kind === "next-round") {
      if (current.phase !== "round-end") throw new Error("Round is still running.");
      const advancePassed =
        current.roundEndAdvanceAt !== null && ctx.now.getTime() >= current.roundEndAdvanceAt;
      if (!isHost && !advancePassed) throw new Error("Still showing the answer.");
      const nextIndex = current.roundIndex + 1;
      if (nextIndex >= effectiveRounds(current)) {
        return {
          ...current,
          phase: "finished",
          playbackStartAt: null,
          roundDeadlineAt: null,
          roundEndAdvanceAt: null,
        };
      }
      return startCountdown(current, nextIndex, ctx.now.getTime());
    }

    // play-again
    if (!isHost) throw new Error("Only the host can restart.");
    if (current.phase !== "finished") throw new Error("Game is not finished yet.");
    return {
      ...current,
      phase: "setup",
      playlistLabel: null,
      tracks: [],
      roundIndex: 0,
      clipStartSeconds: 0,
      playbackStartAt: null,
      roundDeadlineAt: null,
      roundEndAdvanceAt: null,
      progress: {},
      firstMatchPlayerId: null,
      roundPoints: {},
      scores: Object.fromEntries(ctx.playerIds.map((id) => [id, 0])),
    };
  },

  redact: (state, playerId): GuessTheSongView => {
    const current = normalizeSongState(state);
    const track = currentTrack(current);
    const showReveal = current.phase === "round-end" || current.phase === "finished";

    return {
      phase: current.phase,
      settings: current.settings,
      playlistLabel: current.playlistLabel,
      roundIndex: current.roundIndex,
      effectiveRounds: effectiveRounds(current),
      previewUrl:
        track &&
        (current.phase === "countdown" ||
          current.phase === "playing" ||
          current.phase === "round-end")
          ? track.previewUrl
          : null,
      clipStartSeconds: current.clipStartSeconds,
      playbackStartAt: current.playbackStartAt,
      roundDeadlineAt: current.roundDeadlineAt,
      roundEndAdvanceAt: current.roundEndAdvanceAt,
      myProgress: current.progress[playerId] ?? { titleMatched: false, artistMatched: false },
      matchedPlayerIds: Object.entries(current.progress)
        .filter(([, progress]) => progress.titleMatched || progress.artistMatched)
        .map(([id]) => id),
      firstMatchPlayerId: current.firstMatchPlayerId,
      roundPoints: current.roundPoints,
      scores: current.scores,
      reveal:
        showReveal && track
          ? { title: track.title, artist: track.artist, artworkUrl: track.artworkUrl }
          : null,
      isHost: playerId === current.hostId,
    };
  },

  ClientComponent: GuessTheSongClient,
};
