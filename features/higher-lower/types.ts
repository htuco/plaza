export type Phase = "setup" | "guessing" | "reveal" | "finished";

// Topic filters only — every item is compared on the same metric
// (average monthly Google searches), so any two items are comparable.
export type HigherLowerCategory =
  | "poznati"
  | "sport"
  | "film-muzika"
  | "hrana"
  | "brendovi-tech"
  | "mjesta"
  | "historija-pojmovi"
  | "regional";

export type CategoryChoice = HigherLowerCategory | "miks";

export type GuessDirection = "higher" | "lower";

export const ROUND_OPTIONS = [10, 15, 20] as const;
export const LIVES_OPTIONS = [1, 3, 5] as const;
export const TIMER_OPTIONS = [8, 12, 20] as const;

export interface HigherLowerSettings {
  category: CategoryChoice;
  rounds: number;
  lives: number;
  timerSeconds: number;
}

export interface HigherLowerItem {
  id: string;
  label: string;
  category: HigherLowerCategory;
  searches: number;
}

export interface RoundResult {
  correct: boolean;
  points: number;
}

// Authoritative per-player state. `answer` is secret from other players
// until the round is revealed.
export interface PlayerState {
  score: number;
  lives: number;
  streak: number;
  bestStreak: number;
  answer: GuessDirection | null;
  answeredAt: number | null; // epoch ms, drives the speed bonus
  lastResult: RoundResult | null;
  spectator: boolean; // joined mid-game — watches until play-again
}

// Authoritative server state. `items[round]` (the next item) keeps its
// `searches` value secret until the reveal phase.
export interface HigherLowerState {
  version: 2;
  phase: Phase;
  settings: HigherLowerSettings;
  items: HigherLowerItem[];
  // 1-based. Current item = items[round - 1], guessed item = items[round].
  round: number;
  deadlineAt: number | null;
  revealAdvanceAt: number | null;
  players: Record<string, PlayerState>;
  hostId: string;
}

export interface HigherLowerCard {
  label: string;
  category: HigherLowerCategory;
  searches: number | null; // null = still hidden
}

export interface HigherLowerPlayerView {
  score: number;
  lives: number;
  streak: number;
  bestStreak: number;
  answered: boolean;
  // Only filled in during reveal / finished — never while guessing.
  answer: GuessDirection | null;
  lastResult: RoundResult | null;
  spectator: boolean;
}

export interface HigherLowerView {
  phase: Phase;
  settings: HigherLowerSettings;
  round: number;
  current: HigherLowerCard | null;
  next: HigherLowerCard | null;
  correctDirection: GuessDirection | null; // reveal / finished only
  deadlineAt: number | null;
  revealAdvanceAt: number | null;
  isLastRound: boolean;
  myAnswer: GuessDirection | null;
  players: Record<string, HigherLowerPlayerView>;
  winnerPlayerIds: string[];
  isHost: boolean;
}

export type HigherLowerIntent =
  | { kind: "update-settings"; settings: Partial<HigherLowerSettings> } // host, setup
  | { kind: "start-game" } // host, setup -> guessing
  | { kind: "guess"; direction: GuessDirection } // alive player, guessing
  | { kind: "advance" } // anyone past a deadline; host may skip the reveal
  | { kind: "play-again" }; // host, finished -> setup
