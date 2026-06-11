import type { GameModule } from "@/features/registry";
import {
  COLUMN_BASE_POINTS,
  COLUMN_HIDDEN_BONUS,
  FINAL_BASE_POINTS,
  FINAL_COLUMN_BONUS,
} from "./types";
import type {
  AsocijacijeBoard,
  AsocijacijeIntent,
  AsocijacijeState,
  AsocijacijeView,
  Phase,
} from "./types";
import { ASOCIJACIJE_BOARDS, guessMatches } from "./boards";
import { AsocijacijeClient } from "./client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isAsocijacijeIntent(value: unknown): value is AsocijacijeIntent {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "reveal-hint":
      return typeof value.column === "number" && typeof value.field === "number";
    case "guess-column":
      return typeof value.column === "number" && typeof value.guess === "string";
    case "guess-final":
      return typeof value.guess === "string";
    case "start-game":
    case "reveal-all":
    case "play-again":
      return true;
    default:
      return false;
  }
}

function pickBoard(usedBoardIds: string[]): AsocijacijeBoard {
  const fresh = ASOCIJACIJE_BOARDS.filter((board) => !usedBoardIds.includes(board.id));
  const pool = fresh.length > 0 ? fresh : ASOCIJACIJE_BOARDS;
  const seed = pool[Math.floor(Math.random() * pool.length)];
  return {
    id: seed.id,
    columns: seed.columns.map((column) => ({
      hints: [...column.hints],
      solution: column.solution,
      aliases: [...(column.aliases ?? [])],
    })) as AsocijacijeBoard["columns"],
    finalSolution: seed.finalSolution,
    finalAliases: [...(seed.finalAliases ?? [])],
  };
}

function emptyReveals(): boolean[][] {
  return Array.from({ length: 4 }, () => [false, false, false, false]);
}

function normalizePhase(value: unknown): Phase {
  return value === "playing" || value === "finished" ? value : "setup";
}

function normalizeState(state: AsocijacijeState): AsocijacijeState {
  const stored = (state ?? {}) as Partial<AsocijacijeState>;
  const boardValid =
    isRecord(stored.board) &&
    Array.isArray(stored.board.columns) &&
    stored.board.columns.length === 4 &&
    typeof stored.board.finalSolution === "string" &&
    stored.board.finalSolution.length > 0;
  const usedBoardIds = Array.isArray(stored.usedBoardIds)
    ? stored.usedBoardIds.filter((id): id is string => typeof id === "string")
    : [];
  const board = boardValid ? (stored.board as AsocijacijeBoard) : pickBoard(usedBoardIds);

  const revealedHints = Array.isArray(stored.revealedHints)
    ? Array.from({ length: 4 }, (_, columnIndex) =>
        Array.from({ length: 4 }, (_, fieldIndex) =>
          Boolean(stored.revealedHints?.[columnIndex]?.[fieldIndex]),
        ),
      )
    : emptyReveals();

  const columnSolvedBy = Array.from({ length: 4 }, (_, index) => {
    const value = Array.isArray(stored.columnSolvedBy) ? stored.columnSolvedBy[index] : null;
    return typeof value === "string" ? value : null;
  });

  const scores = isRecord(stored.scores)
    ? Object.fromEntries(
        Object.entries(stored.scores).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === "number" && Number.isFinite(entry[1]),
        ),
      )
    : {};

  return {
    phase: normalizePhase(stored.phase),
    board: {
      ...board,
      columns: board.columns.map((column) => ({
        hints: Array.isArray(column.hints) ? column.hints.map(String) : ["", "", "", ""],
        solution: typeof column.solution === "string" ? column.solution : "",
        aliases: Array.isArray(column.aliases) ? column.aliases.map(String) : [],
      })) as AsocijacijeBoard["columns"],
      finalAliases: Array.isArray(board.finalAliases) ? board.finalAliases.map(String) : [],
    },
    usedBoardIds,
    revealedHints,
    columnSolvedBy,
    finalSolvedBy: typeof stored.finalSolvedBy === "string" ? stored.finalSolvedBy : null,
    scores,
    round: typeof stored.round === "number" && stored.round > 0 ? Math.floor(stored.round) : 1,
    hostId: typeof stored.hostId === "string" ? stored.hostId : "",
  };
}

function ensurePlayer(state: AsocijacijeState, playerId: string): AsocijacijeState {
  if (state.scores[playerId] !== undefined) return state;
  return { ...state, scores: { ...state.scores, [playerId]: 0 } };
}

function hiddenHintCount(state: AsocijacijeState, columnIndex: number): number {
  return state.revealedHints[columnIndex].filter((revealed) => !revealed).length;
}

function solveColumn(
  state: AsocijacijeState,
  columnIndex: number,
  playerId: string,
): AsocijacijeState {
  const points =
    COLUMN_BASE_POINTS + COLUMN_HIDDEN_BONUS * hiddenHintCount(state, columnIndex);
  return {
    ...state,
    revealedHints: state.revealedHints.map((column, index) =>
      index === columnIndex ? [true, true, true, true] : column,
    ),
    columnSolvedBy: state.columnSolvedBy.map((solver, index) =>
      index === columnIndex ? playerId : solver,
    ),
    scores: { ...state.scores, [playerId]: (state.scores[playerId] ?? 0) + points },
  };
}

function startBoard(state: AsocijacijeState): AsocijacijeState {
  const board = pickBoard(state.usedBoardIds);
  return {
    ...state,
    phase: "playing",
    board,
    usedBoardIds: [...state.usedBoardIds.filter((id) => id !== board.id), board.id],
    revealedHints: emptyReveals(),
    columnSolvedBy: [null, null, null, null],
    finalSolvedBy: null,
  };
}

export const asocijacijeModule: GameModule<
  AsocijacijeState,
  AsocijacijeIntent,
  AsocijacijeView
> = {
  id: "asocijacije",
  displayName: "Asocijacije",
  tagline: "Crack the four columns and the final solution.",
  minPlayers: 2,
  maxPlayers: 12,

  initialState: ({ playerIds, hostId }) => ({
    phase: "setup",
    board: pickBoard([]),
    usedBoardIds: [],
    revealedHints: emptyReveals(),
    columnSolvedBy: [null, null, null, null],
    finalSolvedBy: null,
    scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
    round: 1,
    hostId,
  }),

  reduce: (state, rawIntent, ctx) => {
    if (!isAsocijacijeIntent(rawIntent)) throw new Error("Invalid Asocijacije action.");
    const intent = rawIntent;
    const current = ensurePlayer(normalizeState(state), ctx.playerId);
    const isHost = ctx.playerId === current.hostId;

    if (intent.kind === "start-game") {
      if (!isHost) throw new Error("Only the host can start.");
      if (current.phase !== "setup") throw new Error("Game already started.");
      // Fresh board for the first run; initialState already reserved one but
      // re-picking keeps `usedBoardIds` consistent.
      return startBoard({ ...current, usedBoardIds: [] });
    }

    if (intent.kind === "play-again") {
      if (!isHost) throw new Error("Only the host can restart.");
      if (current.phase !== "finished") throw new Error("Game is not finished yet.");
      return startBoard({ ...current, round: current.round + 1 });
    }

    if (intent.kind === "reveal-all") {
      if (!isHost) throw new Error("Only the host can reveal the board.");
      if (current.phase !== "playing") throw new Error("Game is not running.");
      return {
        ...current,
        phase: "finished",
        revealedHints: Array.from({ length: 4 }, () => [true, true, true, true]),
      };
    }

    if (current.phase !== "playing") throw new Error("Game is not running.");

    if (intent.kind === "reveal-hint") {
      const column = Math.floor(intent.column);
      const field = Math.floor(intent.field);
      if (column < 0 || column > 3 || field < 0 || field > 3) throw new Error("Unknown field.");
      if (current.columnSolvedBy[column] !== null) throw new Error("Column is already solved.");
      if (current.revealedHints[column][field]) return current;
      return {
        ...current,
        revealedHints: current.revealedHints.map((hints, columnIndex) =>
          columnIndex === column
            ? hints.map((revealed, fieldIndex) => (fieldIndex === field ? true : revealed))
            : hints,
        ),
      };
    }

    if (intent.kind === "guess-column") {
      const column = Math.floor(intent.column);
      if (column < 0 || column > 3) throw new Error("Unknown field.");
      if (current.columnSolvedBy[column] !== null) throw new Error("Column is already solved.");
      const guess = intent.guess.trim();
      if (!guess) throw new Error("Wrong guess.");
      const target = current.board.columns[column];
      if (!guessMatches(guess, target.solution, target.aliases)) {
        throw new Error("Wrong guess.");
      }
      return solveColumn(current, column, ctx.playerId);
    }

    // guess-final
    if (current.finalSolvedBy !== null) throw new Error("Board is already solved.");
    const guess = intent.guess.trim();
    if (!guess) throw new Error("Wrong guess.");
    if (!guessMatches(guess, current.board.finalSolution, current.board.finalAliases)) {
      throw new Error("Wrong guess.");
    }
    const unsolvedColumns = current.columnSolvedBy.filter((solver) => solver === null).length;
    const points = FINAL_BASE_POINTS + FINAL_COLUMN_BONUS * unsolvedColumns;
    return {
      ...current,
      phase: "finished",
      finalSolvedBy: ctx.playerId,
      revealedHints: Array.from({ length: 4 }, () => [true, true, true, true]),
      scores: { ...current.scores, [ctx.playerId]: (current.scores[ctx.playerId] ?? 0) + points },
    };
  },

  redact: (state, playerId): AsocijacijeView => {
    const current = normalizeState(state);
    const finished = current.phase === "finished";
    return {
      phase: current.phase,
      columns: current.board.columns.map((column, columnIndex) => {
        const solved = current.columnSolvedBy[columnIndex] !== null;
        return {
          hints: column.hints.map((hint, fieldIndex) =>
            finished || current.revealedHints[columnIndex][fieldIndex] ? hint : null,
          ),
          solution: solved || finished ? column.solution : null,
          solvedBy: current.columnSolvedBy[columnIndex],
        };
      }),
      finalSolution: current.finalSolvedBy !== null || finished ? current.board.finalSolution : null,
      finalSolvedBy: current.finalSolvedBy,
      scores: current.scores,
      round: current.round,
      isHost: playerId === current.hostId,
    };
  },

  ClientComponent: AsocijacijeClient,
};
