export type Phase = "setup" | "turnIntro" | "explaining" | "turnReview" | "finished";

export const MIN_TURN_DURATION_SECONDS = 30;
export const MAX_TURN_DURATION_SECONDS = 180;
export const MIN_ALIAS_ROUNDS = 1;
export const MAX_ALIAS_ROUNDS = 10;
export const MAX_ALIAS_TEAMS = 4;
export const MIN_TEAM_SIZE = 2;

export const DEFAULT_ALIAS_SETTINGS = {
  turnDurationSeconds: 60,
  totalRounds: 3,
  skipPenalty: false,
} as const;

// Team identity is positional (team-0, team-1, …); names/colors are presentation.
export const ALIAS_TEAM_PRESETS = [
  { id: "team-0", name: "Crveni" },
  { id: "team-1", name: "Plavi" },
  { id: "team-2", name: "Zeleni" },
  { id: "team-3", name: "Žuti" },
] as const;

export interface AliasSettings {
  turnDurationSeconds: number;
  totalRounds: number;
  skipPenalty: boolean;
}

export interface AliasTeam {
  id: string;
  name: string;
  playerIds: string[];
  score: number;
}

export type WordResult = "correct" | "skipped";

export interface TurnWord {
  word: string;
  result: WordResult;
}

// Authoritative server state. `deck` and the current word are secrets —
// only the active explainer may see the word, and only during their turn.
export interface AliasState {
  phase: Phase;
  settings: AliasSettings;
  teams: AliasTeam[];
  round: number; // 1-based, counts full passes over all teams
  turnTeamIndex: number; // whose turn within the round
  explainerCursor: Record<string, number>; // teamId -> rotation index
  activeExplainerId: string | null;
  deck: string[]; // shuffled; consumed from deckIndex onward
  deckIndex: number;
  turnWords: TurnWord[]; // words played in the current turn
  turnDeadlineAt: number | null; // epoch ms
  hostId: string;
}

export interface AliasView {
  phase: Phase;
  settings: AliasSettings;
  teams: Array<{ id: string; name: string; playerIds: string[]; score: number }>;
  round: number;
  turnTeamIndex: number;
  activeTeamId: string | null;
  activeExplainerId: string | null;
  myTeamId: string | null;
  isHost: boolean;
  isExplainer: boolean;
  // Secret word — non-null only for the active explainer during `explaining`.
  currentWord: string | null;
  turnDeadlineAt: number | null;
  turnCorrect: number;
  turnSkipped: number;
  // Full word list — explainer during the turn; everyone during `turnReview`.
  turnWords: TurnWord[] | null;
  wordsRemaining: number;
  winnerTeamIds: string[]; // non-empty when finished (ties possible)
}

export type AliasIntent =
  | { kind: "update-settings"; settings: Partial<AliasSettings> } // host, setup
  | { kind: "assign-player"; playerId: string; teamId: string | null } // host, setup
  | { kind: "set-team-count"; count: number } // host, setup
  | { kind: "auto-balance" } // host, setup
  | { kind: "start-game" } // host, setup -> turnIntro
  | { kind: "start-turn" } // explainer or host, turnIntro -> explaining
  | { kind: "mark-word"; result: WordResult } // explainer, explaining
  | { kind: "end-turn" } // explainer/host anytime, anyone after deadline
  | { kind: "toggle-word"; index: number } // explainer or host, turnReview
  | { kind: "confirm-turn" } // explainer or host, turnReview -> next turn / finished
  | { kind: "play-again" }; // host, finished -> setup (scores reset)
