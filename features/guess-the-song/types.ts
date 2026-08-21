export type Phase = "setup" | "countdown" | "playing" | "round-end" | "finished";

export type AnswerMode = "title" | "artist" | "both";

export const MIN_SONG_ROUNDS = 3;
export const MAX_SONG_ROUNDS = 15;
export const MIN_GUESS_DURATION_SECONDS = 10;
export const MAX_GUESS_DURATION_SECONDS = 90;
export const GUESS_DURATION_STEP_SECONDS = 5;

// iTunes previews are 30s. Treat a little less than that as usable so a clip
// starting near the end never runs off the tail of the file.
export const PREVIEW_USABLE_SECONDS = 28;

// Heardle's ladder, plus the full preview. Shorter is harder, and pays more.
export const CLIP_LENGTH_OPTIONS = [1, 2, 4, 7, 11, 16, 30] as const;
export const DEFAULT_CLIP_LENGTH_SECONDS = 11;

// Everyone sees the same 3-2-1 countdown before playback starts, and the same
// short pause on the solution before the game auto-advances to the next round.
export const COUNTDOWN_SECONDS = 3;
export const ROUND_END_PAUSE_SECONDS = 5;

export const DEFAULT_SONG_SETTINGS = {
  totalRounds: 8,
  guessDurationSeconds: 45,
  clipLengthSeconds: DEFAULT_CLIP_LENGTH_SECONDS,
  answerMode: "both" as AnswerMode,
};

export const TITLE_POINTS = 5;
export const ARTIST_POINTS = 5;
export const FIRST_MATCH_BONUS = 3;

// Answer early, score more: a correct guess is worth up to this much extra,
// scaled by how much of the guess window is still left when it lands.
export const SPEED_BONUS_MAX = 5;

// The shorter the clip the host picked, the more the whole round pays out.
// Keys are clip lengths in seconds; anything unlisted falls back to 1.
export const CLIP_LENGTH_MULTIPLIERS: Record<number, number> = {
  1: 3,
  2: 2.5,
  4: 2,
  7: 1.75,
  11: 1.5,
  16: 1.25,
  30: 1,
};

export function clipLengthMultiplier(clipLengthSeconds: number): number {
  return CLIP_LENGTH_MULTIPLIERS[clipLengthSeconds] ?? 1;
}

// A 2-second clip with a 50-second countdown is dead air. Picking a clip length
// retunes the guess window to match it; the host can still override afterwards.
export const SUGGESTED_GUESS_DURATION: Record<number, number> = {
  1: 15,
  2: 15,
  4: 20,
  7: 20,
  11: 25,
  16: 30,
  30: 45,
};

export function suggestedGuessDuration(clipLengthSeconds: number): number {
  return SUGGESTED_GUESS_DURATION[clipLengthSeconds] ?? DEFAULT_SONG_SETTINGS.guessDurationSeconds;
}

// Curated source presets — each maps to a handful of iTunes search terms.
export const SONG_SOURCE_PRESETS = [
  {
    id: "exyu",
    label: "Ex-Yu klasici",
    terms: ["bijelo dugme", "zdravko colic", "plavi orkestar", "crvena jabuka", "dino merlin"],
  },
  {
    id: "balkan",
    label: "Regionalni pop",
    terms: ["severina", "toni cetinski", "hari mata hari", "zeljko joksimovic", "magazin"],
  },
  {
    id: "pop",
    label: "Global pop",
    terms: ["taylor swift", "ed sheeran", "dua lipa", "bruno mars", "rihanna"],
  },
  {
    id: "rock",
    label: "Rock klasici",
    terms: ["queen", "nirvana", "guns n roses", "ac/dc", "bon jovi"],
  },
] as const;

export type SongSourcePresetId = (typeof SONG_SOURCE_PRESETS)[number]["id"];

export interface SongTrack {
  trackId: string;
  title: string;
  artist: string;
  previewUrl: string;
  artworkUrl: string | null;
}

export interface GuessTheSongSettings {
  totalRounds: number;
  guessDurationSeconds: number;
  clipLengthSeconds: number; // how much of the 30s preview plays
  answerMode: AnswerMode;
}

export interface PlayerRoundProgress {
  titleMatched: boolean;
  artistMatched: boolean;
}

// Authoritative server state. `tracks` (titles/artists) are the secret.
export interface GuessTheSongState {
  phase: Phase;
  settings: GuessTheSongSettings;
  playlistLabel: string | null;
  tracks: SongTrack[];
  roundIndex: number; // 0-based
  clipStartSeconds: number; // where in the 30s preview this round's clip begins
  playbackStartAt: number | null; // epoch ms; countdown target / playback start
  roundDeadlineAt: number | null; // epoch ms
  roundEndAdvanceAt: number | null; // epoch ms; auto-advance out of round-end
  progress: Record<string, PlayerRoundProgress>;
  firstMatchPlayerId: string | null;
  roundPoints: Record<string, number>;
  scores: Record<string, number>;
  hostId: string;
}

export interface GuessTheSongView {
  phase: Phase;
  settings: GuessTheSongSettings;
  playlistLabel: string | null;
  roundIndex: number;
  effectiveRounds: number; // min(settings.totalRounds, tracks available)
  previewUrl: string | null; // current round clip (countdown + playing + round-end)
  clipStartSeconds: number;
  playbackStartAt: number | null;
  roundDeadlineAt: number | null;
  roundEndAdvanceAt: number | null;
  myProgress: PlayerRoundProgress;
  matchedPlayerIds: string[]; // players with at least one match this round
  firstMatchPlayerId: string | null;
  roundPoints: Record<string, number>;
  scores: Record<string, number>;
  reveal: { title: string; artist: string; artworkUrl: string | null } | null;
  isHost: boolean;
}

export type GuessTheSongIntent =
  | { kind: "update-settings"; settings: Partial<GuessTheSongSettings> } // host, setup
  | { kind: "submit-guess"; guess: string } // playing
  | { kind: "end-round" } // host anytime; anyone after the deadline
  | { kind: "resolve-countdown" } // anyone, after playbackStartAt passes
  | { kind: "next-round" } // anyone, after roundEndAdvanceAt passes (or host early)
  | { kind: "play-again" }; // host, finished -> setup
