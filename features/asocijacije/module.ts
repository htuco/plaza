import type { GameModule } from "@/features/registry";
import type { AsocijacijeState, AsocijacijeIntent, AsocijacijeView } from "./types";
import { AsocijacijeClient } from "./client";

const EMPTY_BOARD = {
  columns: [
    { hints: ["", "", "", ""], solution: "" },
    { hints: ["", "", "", ""], solution: "" },
    { hints: ["", "", "", ""], solution: "" },
    { hints: ["", "", "", ""], solution: "" },
  ],
  finalSolution: "",
} as AsocijacijeState["board"];

export const asocijacijeModule: GameModule<AsocijacijeState, AsocijacijeIntent, AsocijacijeView> = {
  id: "asocijacije",
  displayName: "Asocijacije",
  tagline: "Crack the four columns and the final solution.",
  minPlayers: 2,
  maxPlayers: 12,

  initialState: ({ playerIds, hostId }) => ({
    phase: "playing",
    board: EMPTY_BOARD, // real impl pulls from asocijacije_boards table
    revealedHints: Array.from({ length: 4 }, () => [false, false, false, false]),
    solvedColumns: [false, false, false, false],
    finalSolved: false,
    scores: { A: 0, B: 0 },
    activeTeam: "A",
    teams: Object.fromEntries(playerIds.map((id, i) => [id, i % 2 === 0 ? "A" : "B"] as const)),
    hostId,
  }),

  reduce: (state) => state, // gameplay implemented in the next feature

  redact: (state, playerId): AsocijacijeView => {
    return {
      phase: state.phase,
      columns: state.board.columns.map((col, ci) => ({
        hints: col.hints.map((h, fi) => (state.revealedHints[ci][fi] ? h : null)),
        solution: state.solvedColumns[ci] ? col.solution : null,
      })),
      finalSolution: state.finalSolved ? state.board.finalSolution : null,
      scores: state.scores,
      activeTeam: state.activeTeam,
      myTeam: state.teams[playerId] ?? null,
    };
  },

  ClientComponent: AsocijacijeClient,
};
