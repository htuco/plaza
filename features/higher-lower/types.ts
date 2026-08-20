export type Phase = "setup" | "playing" | "finished";

export type HigherLowerCategory = "internet" | "trivia" | "regional";

export type GuessDirection = "higher" | "lower";

// Authoritative per-player progress. `position` is the index of the last
// item this player has confirmed (revealed); a wrong guess freezes it.
export interface PlayerProgress {
  position: number;
  alive: boolean;
}

// Authoritative server state. `items` (and any value beyond a player's own
// `position`) is the secret — a player must never learn the value of an
// item they have not personally confirmed yet.
export interface HigherLowerState {
  phase: Phase;
  category: HigherLowerCategory | null;
  items: HigherLowerRoundItem[]; // shuffled order for this round
  progress: Record<string, PlayerProgress>;
  hostId: string;
}

export interface HigherLowerRoundItem {
  id: string;
  label: string;
  value: number;
  unit: string;
}

export interface HigherLowerRevealedItem {
  label: string;
  value: number;
  unit: string;
}

export interface HigherLowerPlayerView {
  position: number;
  alive: boolean;
}

export interface HigherLowerView {
  phase: Phase;
  category: HigherLowerCategory | null;
  // This player's own confirmed chain — index 0..position, real values.
  revealed: HigherLowerRevealedItem[];
  // Next item's label only (no value) — null once this player is out or the deck ends.
  nextLabel: string | null;
  nextUnit: string | null;
  alive: boolean;
  position: number;
  progress: Record<string, HigherLowerPlayerView>;
  winnerPlayerIds: string[];
  isHost: boolean;
}

export type HigherLowerIntent =
  | { kind: "start-game" } // host, setup -> playing
  | { kind: "guess"; direction: GuessDirection } // any alive player
  | { kind: "play-again" }; // host, finished -> setup
