import type { ComponentType } from "react";
import type { GameId } from "@/lib/db/schema";

// Contract every game module implements. Keeps the hub agnostic of game internals.
export interface GameModule<TState = unknown, TIntent = unknown, TView = unknown> {
  id: GameId;
  displayName: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;

  // Server-authoritative reducer. Validates intent, returns next state (or throws on invalid).
  reduce(
    state: TState,
    intent: TIntent,
    ctx: { playerId: string; now: Date; playerIds: string[]; gradoviLetter?: string },
  ): TState;

  // Initial state for a fresh round; called by the room when the host starts the game.
  initialState(ctx: { playerIds: string[]; hostId: string }): TState;

  // Redact authoritative state to a per-player view. CRITICAL for secrets (impostor roles,
  // hidden answers). Server calls this per recipient before broadcasting.
  redact(state: TState, playerId: string): TView;

  // Client component rendered inside the room shell.
  ClientComponent: ComponentType<{ roomCode: string; playerId: string }>;
}

// Lightweight metadata for the catalog page — avoids importing client components on the server.
export interface GameMeta {
  id: GameId;
  displayName: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  availability: "playable" | "soon";
}

export const GAMES: readonly GameMeta[] = [
  {
    id: "imposteri",
    displayName: "Imposteri",
    tagline: "Find who doesn't know the secret word.",
    minPlayers: 3,
    maxPlayers: 12,
    availability: "playable",
  },
  {
    id: "alias",
    displayName: "Alias",
    tagline: "Explain the word — just never say it.",
    minPlayers: 4,
    maxPlayers: 16,
    availability: "playable",
  },
  {
    id: "gradovi-i-sela",
    displayName: "Gradovi i Sela",
    tagline: "A letter drops — race to fill the categories.",
    minPlayers: 2,
    maxPlayers: 12,
    availability: "playable",
  },
  {
    id: "asocijacije",
    displayName: "Asocijacije",
    tagline: "Crack the four columns and the final solution.",
    minPlayers: 2,
    maxPlayers: 12,
    availability: "playable",
  },
  {
    id: "guess-the-song",
    displayName: "Guess the Song",
    tagline: "Name the track before anyone else.",
    minPlayers: 2,
    maxPlayers: 12,
    availability: "playable",
  },
] as const;

export function getGameMeta(id: GameId): GameMeta | undefined {
  return GAMES.find((g) => g.id === id);
}

export function isGamePlayable(id: GameId): boolean {
  return getGameMeta(id)?.availability === "playable";
}
