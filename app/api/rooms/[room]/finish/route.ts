import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { broadcast } from "@/lib/realtime/server";
import { getRoomByCode } from "@/lib/rooms/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ room: string }> },
) {
  const { room: code } = await params;
  const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = room.players.find((p) => p.anonId === user?.id);
  if (!me) return NextResponse.json({ error: "Player not in room." }, { status: 403 });
  if (!me.isHost) return NextResponse.json({ error: "Only the host can close the room." }, { status: 403 });

  await db
    .update(schema.rooms)
    .set({ status: "finished" })
    .where(eq(schema.rooms.id, room.id));

  await broadcast(room.code, "state", {
    status: "finished",
    gameId: room.gameId,
    target: "/",
  });

  return NextResponse.json({ ok: true, target: "/" });
}
