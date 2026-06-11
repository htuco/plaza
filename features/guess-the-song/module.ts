import type { GameModule } from "@/features/registry";
import {
  ARTIST_POINTS,
  DEFAULT_SONG_SETTINGS,
  FIRST_MATCH_BONUS,
  MAX_GUESS_DURATION_SECONDS,
  MAX_SONG_ROUNDS,
  MIN_GUESS_DURATION_SECONDS,
  MIN_SONG_ROUNDS,
  TITLE_POINTS,
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
  return {
    totalRounds: clamp(rounds, MIN_SONG_ROUNDS, MAX_SONG_ROUNDS),
    guessDurationSeconds: clamp(
      duration,
      MIN_GUESS_DURATION_SECONDS,
      MAX_GUESS_DURATION_SECONDS,
    ),
    answerMode: isAnswerMode(raw.answerMode) ? raw.answerMode : DEFAULT_SONG_SETTINGS.answerMode,
  };
}

function normalizePhase(value: unknown): Phase {
  return value === "playing" || value === "round-end" || value === "finished" ? value : "setup";
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
    roundDeadlineAt: typeof stored.roundDeadlineAt === "number" ? stored.roundDeadlineAt : null,
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

export function guessMatchesAnswer(guess: string, answer: string): boolean {
  const normalizedGuess = normalizeForMatch(guess);
  const normalizedAnswer = normalizeForMatch(answer);
  if (!normalizedGuess || !normalizedAnswer) return false;
  if (normalizedGuess === normalizedAnswer) return true;
  // Containment for multi-word answers, so "bohemian rhapsody queen" still hits.
  if (normalizedAnswer.length >= 4 && normalizedGuess.includes(normalizedAnswer)) return true;
  if (normalizedGuess.length >= 4 && normalizedAnswer.includes(normalizedGuess)) {
    // Avoid 4-letter guesses matching inside long titles too eagerly.
    return normalizedGuess.length / normalizedAnswer.length >= 0.6;
  }
  return false;
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

function endRound(state: GuessTheSongState): GuessTheSongState {
  return { ...state, phase: "round-end", roundDeadlineAt: null };
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
    roundDeadlineAt: null,
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
      return {
        ...current,
        settings: normalizeSettings({ ...current.settings, ...intent.settings }),
      };
    }

    if (intent.kind === "submit-guess") {
      if (current.phase !== "playing") throw new Error("Round is not running.");
      if (deadlinePassed) return endRound(current);
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
      let firstMatchPlayerId = current.firstMatchPlayerId;
      if (firstMatchPlayerId === null) {
        firstMatchPlayerId = ctx.playerId;
        points += FIRST_MATCH_BONUS;
      }

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
      return everyoneDone ? endRound(next) : next;
    }

    if (intent.kind === "end-round") {
      if (current.phase !== "playing") throw new Error("Round is not running.");
      if (!isHost && !deadlinePassed) throw new Error("The round is still running.");
      return endRound(current);
    }

    if (intent.kind === "next-round") {
      if (!isHost) throw new Error("Only the host can advance the game.");
      if (current.phase !== "round-end") throw new Error("Round is still running.");
      const nextIndex = current.roundIndex + 1;
      if (nextIndex >= effectiveRounds(current)) {
        return { ...current, phase: "finished", roundDeadlineAt: null };
      }
      return {
        ...current,
        phase: "playing",
        roundIndex: nextIndex,
        roundDeadlineAt: ctx.now.getTime() + current.settings.guessDurationSeconds * 1000,
        progress: {},
        firstMatchPlayerId: null,
        roundPoints: {},
      };
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
      roundDeadlineAt: null,
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
        track && (current.phase === "playing" || current.phase === "round-end")
          ? track.previewUrl
          : null,
      roundDeadlineAt: current.roundDeadlineAt,
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
