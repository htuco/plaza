import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getGameModule } from "@/features";
import { db, schema } from "@/lib/db/client";
import { getRoomByCode } from "@/lib/rooms/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ room: string }> },
) {
  const { room: code } = await params;
  const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.status !== "in_game" || !room.gameId) {
    return NextResponse.json({ error: "Room is not in a game." }, { status: 409 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = room.players.find((p) => p.anonId === user?.id);
  if (!me) return NextResponse.json({ error: "Player not in room." }, { status: 403 });

  const gameState = await db.query.gameStates.findFirst({
    where: eq(schema.gameStates.roomId, room.id),
  });
  if (!gameState || gameState.gameId !== room.gameId) {
    return NextResponse.json({ error: "Game state not found." }, { status: 404 });
  }

  const gameModule = getGameModule(gameState.gameId);
  const view = gameModule.redact(gameState.state, me.id);

  return NextResponse.json({
    gameId: gameState.gameId,
    playerId: me.id,
    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isHost: p.isHost,
    })),
    view,
    updatedAt: gameState.updatedAt.toISOString(),
  });
}
