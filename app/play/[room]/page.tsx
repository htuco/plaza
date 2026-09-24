import { notFound, redirect } from "next/navigation";
import { getRoomByCode } from "@/lib/rooms/server";
import { getCurrentUserId } from "@/lib/supabase/server";
import { JoinLobbyForm } from "@/components/join-lobby-form";
import { RoomLobby } from "./room-lobby";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room: code } = await params;
  const [room, userId] = await Promise.all([getRoomByCode(code), getCurrentUserId()]);
  if (!room) notFound();
  if (room.status === "finished") redirect("/");
  const me = room.players.find((p) => p.anonId === userId) ?? null;

  // Arrived via a shared link but not seated yet — ask for a name only.
  // (Only while the room is still in the lobby; an in-flight game can't take walk-ins.)
  if (!me && room.status === "lobby") {
    return <JoinLobbyForm code={room.code} />;
  }

  return <RoomLobby room={room} me={me} />;
}
