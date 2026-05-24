import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { roomChannelName, type RoomEvent } from "./channels";

// Server-authoritative broadcaster. Uses the service-role key so the writer is trusted.
export async function broadcast(
  roomCode: string,
  event: RoomEvent["type"],
  payload: unknown,
) {
  const supabase = await createServiceClient();
  const channel = supabase.channel(roomChannelName(roomCode));
  await channel.send({ type: "broadcast", event, payload });
  // Tear down so we don't leak channels per request.
  await supabase.removeChannel(channel);
}
