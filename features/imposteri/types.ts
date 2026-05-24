export type Phase = "reveal" | "clues" | "vote" | "result";
export type Role = "crew" | "impostor";

export interface ImposteriRoundResult {
  ejectedPlayerId: string | null;
  tiedPlayerIds: string[];
  crewWon: boolean;
  impostorIds: string[];
  secretWord: string;
  category: string;
  voteCounts: Record<string, number>;
  timedOut: boolean;
}

// Authoritative server state. Never sent to clients as-is — roles + secret are redacted from impostors.
export interface ImposteriState {
  phase: Phase;
  category: string;
  secretWord: string;
  impostorHint: string;
  roles: Record<string, Role>;
  startPlayerId: string | null;
  votes: Record<string, string>;
  voteDeadlineAt: string | null;
  scores: Record<string, number>;
  result: ImposteriRoundResult | null;
  round: number;
  hostId: string;
}

// Per-player redacted view. Crew sees the secret; impostor sees only the category + a vague hint.
export interface ImposteriView {
  phase: Phase;
  myRole: Role;
  category: string;
  secretWord: string | null;
  impostorHint: string | null;
  startPlayerId: string | null;
  myVote: string | null;
  votedPlayerIds: string[];
  votes: Record<string, string>;
  voteDeadlineAt: string | null;
  voteDurationSeconds: number;
  scores: Record<string, number>;
  result: ImposteriRoundResult | null;
  round: number;
  isHost: boolean;
  isInRound: boolean;
}

export type ImposteriIntent =
  | { kind: "advance-phase" } // host-only — reveal -> clues -> vote
  | { kind: "cast-vote"; targetId: string }
  | { kind: "resolve-vote" } // anyone can call after the deadline; server only resolves if expired
  | { kind: "start-round" }; // host-only

export const VOTE_DURATION_SECONDS = 10;
