import { notFound, redirect } from "next/navigation";
import { getRoomByCode } from "@/lib/rooms/server";
import { createClient } from "@/lib/supabase/server";
import { RoomLobby } from "./room-lobby";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room: code } = await params;
  const room = await getRoomByCode(code);
  if (!room) notFound();
  if (room.status === "finished") redirect("/");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const me = room.players.find((p) => p.anonId === user?.id) ?? null;

  return <RoomLobby room={room} me={me} />;
}
