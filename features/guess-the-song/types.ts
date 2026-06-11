export type Phase = "setup" | "playing" | "round-end" | "finished";

export type AnswerMode = "title" | "artist" | "both";

export const MIN_SONG_ROUNDS = 3;
export const MAX_SONG_ROUNDS = 15;
export const MIN_GUESS_DURATION_SECONDS = 30;
export const MAX_GUESS_DURATION_SECONDS = 90;

export const DEFAULT_SONG_SETTINGS = {
  totalRounds: 8,
  guessDurationSeconds: 45,
  answerMode: "both" as AnswerMode,
};

export const TITLE_POINTS = 5;
export const ARTIST_POINTS = 5;
export const FIRST_MATCH_BONUS = 3;

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
  roundDeadlineAt: number | null; // epoch ms
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
  previewUrl: string | null; // current round clip (playing + round-end)
  roundDeadlineAt: number | null;
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
  | { kind: "next-round" } // host, round-end
  | { kind: "play-again" }; // host, finished -> setup
