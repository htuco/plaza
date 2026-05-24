import type { GameModule } from "@/features/registry";
import type { GuessTheSongState, GuessTheSongIntent, GuessTheSongView } from "./types";
import { GuessTheSongClient } from "./client";

export const guessTheSongModule: GameModule<
  GuessTheSongState,
  GuessTheSongIntent,
  GuessTheSongView
> = {
  id: "guess-the-song",
  displayName: "Guess the Song",
  tagline: "Name the track before anyone else.",
  minPlayers: 2,
  maxPlayers: 12,

  initialState: ({ playerIds, hostId }) => ({
    phase: "lobby",
    roundIndex: 0,
    currentRound: null,
    submissions: [],
    scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
    hostId,
  }),

  reduce: (state) => state,

  redact: (state, playerId): GuessTheSongView => {
    const myGuess = state.submissions.find((s) => s.playerId === playerId)?.guess ?? null;
    return {
      phase: state.phase,
      roundIndex: state.roundIndex,
      previewUrl: state.currentRound?.previewUrl ?? null,
      myGuess,
      scores: state.scores,
      // Reveal answer only when the round has ended. During play, accepted lists are server-only.
      reveal:
        state.phase === "round-end" && state.currentRound
          ? {
              title: state.currentRound.acceptedTitles[0] ?? "",
              artist: state.currentRound.acceptedArtists[0] ?? "",
            }
          : null,
    };
  },

  ClientComponent: GuessTheSongClient,
};
