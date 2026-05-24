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
