export type Phase = "setup" | "playing" | "finished";

export const COLUMN_LABELS = ["A", "B", "C", "D"] as const;

// Scoring: solving a column is worth 2 + 2 points per still-hidden clue in it
// (max 10). The final solution is worth 10 + 4 per still-unsolved column (max 26).
export const COLUMN_BASE_POINTS = 2;
export const COLUMN_HIDDEN_BONUS = 2;
export const FINAL_BASE_POINTS = 10;
export const FINAL_COLUMN_BONUS = 4;

export interface AsocijacijeColumn {
  hints: string[]; // length 4
  solution: string;
  aliases: string[];
}

export interface AsocijacijeBoard {
  id: string;
  columns: [AsocijacijeColumn, AsocijacijeColumn, AsocijacijeColumn, AsocijacijeColumn];
  finalSolution: string;
  finalAliases: string[];
}

// Authoritative server state. The board is the secret — hidden clues and
// unsolved solutions must never reach a client.
export interface AsocijacijeState {
  phase: Phase;
  board: AsocijacijeBoard;
  usedBoardIds: string[];
  revealedHints: boolean[][]; // 4 columns × 4 fields
  columnSolvedBy: Array<string | null>; // playerId who solved each column
  finalSolvedBy: string | null;
  scores: Record<string, number>;
  round: number; // how many boards have been played this session (1-based)
  hostId: string;
}

export interface AsocijacijeView {
  phase: Phase;
  columns: Array<{
    hints: Array<string | null>; // null = still hidden
    solution: string | null; // null = unsolved (revealed when solved or finished)
    solvedBy: string | null;
  }>;
  finalSolution: string | null;
  finalSolvedBy: string | null;
  scores: Record<string, number>;
  round: number;
  isHost: boolean;
}

export type AsocijacijeIntent =
  | { kind: "start-game" } // host, setup -> playing
  | { kind: "reveal-hint"; column: number; field: number } // any player
  | { kind: "guess-column"; column: number; guess: string } // any player
  | { kind: "guess-final"; guess: string } // any player
  | { kind: "reveal-all" } // host — give up, reveal board, finish
  | { kind: "play-again" }; // host, finished -> playing with a fresh board
