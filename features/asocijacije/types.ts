export type Phase = "playing" | "finished";

// Each column has 4 hidden hints + 1 column solution; 1 final solution ties the board together.
export interface AsocijacijeColumn {
  hints: string[]; // length 4
  solution: string;
}

export interface AsocijacijeBoard {
  columns: [AsocijacijeColumn, AsocijacijeColumn, AsocijacijeColumn, AsocijacijeColumn];
  finalSolution: string;
}

export interface AsocijacijeState {
  phase: Phase;
  board: AsocijacijeBoard; // server-only — never sent to clients raw
  revealedHints: boolean[][]; // 4 columns x 4 fields
  solvedColumns: boolean[]; // length 4
  finalSolved: boolean;
  scores: Record<"A" | "B", number>;
  activeTeam: "A" | "B";
  teams: Record<string, "A" | "B">;
  hostId: string;
}

// View hides unrevealed hints and unsolved column/final solutions.
export interface AsocijacijeView {
  phase: Phase;
  columns: Array<{
    hints: Array<string | null>;
    solution: string | null;
  }>;
  finalSolution: string | null;
  scores: Record<"A" | "B", number>;
  activeTeam: "A" | "B";
  myTeam: "A" | "B" | null;
}

export type AsocijacijeIntent =
  | { kind: "reveal-hint"; column: number; field: number }
  | { kind: "guess-column"; column: number; guess: string }
  | { kind: "guess-final"; guess: string };
