export const MIN_ROUND_DURATION_SECONDS = 30;
export const MAX_ROUND_DURATION_SECONDS = 600;
export const MIN_TOTAL_ROUNDS = 1;
export const MAX_TOTAL_ROUNDS = 20;
export const DEFAULT_GRADOVI_SETTINGS = {
  roundDurationSeconds: 120,
  totalRounds: 5,
} as const;
export const DEFAULT_GRADOVI_CATEGORIES = [
  "Grad",
  "Selo",
  "Država",
  "Rijeka",
  "Biljka",
  "Životinja",
  "Ime",
  "Stvar",
] as const;
export const OPTIONAL_GRADOVI_CATEGORIES = [
  "Marka automobila",
  "Planina",
  "Sport",
  "Zanimanje",
  "Jelo ili piće",
  "Film ili serija",
  "Pjesma",
  "Klub",
  "Poznata osoba",
  "Boja",
] as const;
export const ALL_GRADOVI_CATEGORIES = [
  ...DEFAULT_GRADOVI_CATEGORIES,
  ...OPTIONAL_GRADOVI_CATEGORIES,
] as const;
export const GRADOVI_LETTERS = [
  "A",
  "B",
  "C",
  "Č",
  "Ć",
  "D",
  "Đ",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "R",
  "S",
  "Š",
  "T",
  "U",
  "V",
  "Z",
  "Ž",
] as const;

export type Phase = "setup" | "writing" | "review" | "reveal" | "finished";

export type AnswerValidationStatus = "valid" | "invalid" | "needs-review";
export type AnswerValidationSource = "rule" | "host" | "word-pool" | "ai";

export interface GradoviSettings {
  roundDurationSeconds: number;
  totalRounds: number;
}

export interface AnswerValidation {
  status: AnswerValidationStatus;
  source: AnswerValidationSource;
  reason: string;
  reports: string[];
}

export interface GradoviState {
  phase: Phase;
  letter: string;
  letterQueue: string[];
  categories: string[];
  settings: GradoviSettings;
  // playerId -> category -> answer. Hidden from other players until reveal.
  answers: Record<string, Record<string, string>>;
  submitted: Record<string, boolean>;
  validations: Record<string, Record<string, AnswerValidation>>;
  scores: Record<string, number>;
  roundScores: Record<string, Record<string, number>>;
  round: number;
  deadlineAt: number | null; // epoch ms; client mirrors timer from server
  hostId: string;
}

// During `writing`: a player sees only their own answers.
// During `reveal`/`finished`: everyone sees everyone's answers.
export interface GradoviView {
  phase: Phase;
  letter: string;
  categories: string[];
  settings: GradoviSettings;
  myAnswers: Record<string, string>;
  allAnswers: Record<string, Record<string, string>> | null;
  submitted: Record<string, boolean>;
  validations: Record<string, Record<string, AnswerValidation>>;
  scores: Record<string, number>;
  roundScores: Record<string, Record<string, number>>;
  round: number;
  deadlineAt: number | null;
  isHost: boolean;
}

export type GradoviIntent =
  | { kind: "update-settings"; settings: Partial<GradoviSettings> }
  | { kind: "update-categories"; categories: string[] }
  | { kind: "set-answer"; category: string; value: string }
  | { kind: "submit" } // player marks themselves done
  | { kind: "start-round" } // host
  | { kind: "reveal" } // host
  | { kind: "review-answer"; playerId: string; category: string; status: "valid" | "invalid" }
  | { kind: "report-answer"; playerId: string; category: string }
  | { kind: "lock-round" }; // host
