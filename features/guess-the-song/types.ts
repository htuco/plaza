export type Phase = "lobby" | "playing" | "round-end" | "finished";

export interface SongRound {
  trackId: string;
  previewUrl: string; // iTunes preview (Spotify's preview_url is deprecated)
  acceptedTitles: string[]; // normalized
  acceptedArtists: string[]; // normalized
  startedAt: number; // epoch ms
}

export interface Submission {
  playerId: string;
  guess: string;
  submittedAt: number;
  matchedTitle: boolean;
  matchedArtist: boolean;
}

export interface GuessTheSongState {
  phase: Phase;
  roundIndex: number;
  currentRound: SongRound | null;
  submissions: Submission[];
  scores: Record<string, number>;
  hostId: string;
}

// Players never receive the accepted-answer lists — that's how cheats would resolve them.
export interface GuessTheSongView {
  phase: Phase;
  roundIndex: number;
  previewUrl: string | null;
  myGuess: string | null;
  scores: Record<string, number>;
  // After round end, surface the canonical answer; during play, null.
  reveal: { title: string; artist: string } | null;
}

export type GuessTheSongIntent =
  | { kind: "submit-guess"; guess: string }
  | { kind: "start-round" } // host
  | { kind: "end-round" } // host or auto-timer
  | { kind: "finish" }; // host
