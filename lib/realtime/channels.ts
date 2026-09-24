import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

// Thin wrapper around Supabase Realtime so the rest of the app talks to one shape.
// If we ever swap providers, only this file changes.

export function roomChannelName(roomCode: string): string {
  return `room:${roomCode.toUpperCase()}`;
}

export type RoomEvent =
  | { type: "state"; payload: unknown }
  | { type: "lobby-update"; payload: unknown }
  | { type: "game-event"; payload: unknown };

export function subscribeToRoom(
  supabase: SupabaseClient,
  roomCode: string,
  onEvent: (event: RoomEvent) => void,
): RealtimeChannel {
  const channel = supabase.channel(roomChannelName(roomCode), {
    config: { broadcast: { self: false } },
  });

  channel
    .on("broadcast", { event: "state" }, ({ payload }) => onEvent({ type: "state", payload }))
    .on("broadcast", { event: "lobby-update" }, ({ payload }) =>
      onEvent({ type: "lobby-update", payload }),
    )
    .on("broadcast", { event: "game-event" }, ({ payload }) =>
      onEvent({ type: "game-event", payload }),
    )
    .subscribe();

  return channel;
}

// Authoritative writer (server-side) broadcasts redacted events to all clients.
export async function broadcastToRoom(
  supabase: SupabaseClient,
  roomCode: string,
  event: RoomEvent["type"],
  payload: unknown,
) {
  const channel = supabase.channel(roomChannelName(roomCode));
  await channel.send({ type: "broadcast", event, payload });
}

// A `game-event` only says "state changed at updatedAt". Skip the refetch when our
// snapshot is already that fresh (e.g. we sent the intent and applied its response).
export function shouldRefetchGameEvent(
  payload: unknown,
  gameId: string,
  latestUpdatedAt: string | null | undefined,
): boolean {
  const { gameId: eventGameId, updatedAt } = (payload ?? {}) as {
    gameId?: unknown;
    updatedAt?: unknown;
  };
  if (eventGameId !== gameId) return false;
  if (typeof updatedAt !== "string" || !latestUpdatedAt) return true;
  // Both are Date#toISOString() output, so string order is time order.
  return updatedAt > latestUpdatedAt;
}

// Deadline nudges: every client races to tell the server "time's up". A random
// per-client delay lets the first nudge's broadcast land before the rest fire,
// so a phase change costs ~1 request instead of one per player.
export const DEADLINE_NUDGE_MAX_JITTER_MS = 400;

export function randomNudgeJitterMs(): number {
  return Math.floor(Math.random() * DEADLINE_NUDGE_MAX_JITTER_MS);
}
