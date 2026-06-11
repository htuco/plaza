import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { broadcast } from "@/lib/realtime/server";
import { getRoomByCode } from "@/lib/rooms/server";
import { createClient } from "@/lib/supabase/server";

// A player leaves the room. Removes their seat, transfers host if needed,
// closes the room when the last player walks out, and tells everyone else.
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
  // Already gone — treat as success so a stale client can just go home.
  if (!me) return NextResponse.json({ ok: true, left: true });

  const result = await db.transaction(async (tx) => {
    await tx.delete(schema.players).where(eq(schema.players.id, me.id));

    const remaining = await tx
      .select()
      .from(schema.players)
      .where(eq(schema.players.roomId, room.id))
      .orderBy(asc(schema.players.connectedAt));

    if (remaining.length === 0) {
      await tx
        .update(schema.rooms)
        .set({ status: "finished", hostPlayerId: null })
        .where(eq(schema.rooms.id, room.id));
      return { remaining, newHostId: null as string | null, roomClosed: true };
    }

    let newHostId: string | null = null;
    if (me.isHost) {
      const successor = remaining[0];
      newHostId = successor.id;
      await tx
        .update(schema.players)
        .set({ isHost: true })
        .where(eq(schema.players.id, successor.id));
      await tx
        .update(schema.rooms)
        .set({ hostPlayerId: successor.id })
        .where(eq(schema.rooms.id, room.id));

      // Every game module keeps `hostId` at the top level of its JSONB state.
      // Patch it so host-only intents keep working mid-game.
      const [gameState] = await tx
        .select()
        .from(schema.gameStates)
        .where(eq(schema.gameStates.roomId, room.id))
        .for("update")
        .limit(1);
      if (gameState && gameState.state && typeof gameState.state === "object") {
        await tx
          .update(schema.gameStates)
          .set({
            state: { ...(gameState.state as Record<string, unknown>), hostId: successor.id },
            updatedAt: new Date(),
          })
          .where(eq(schema.gameStates.roomId, room.id));
      }
    }

    return { remaining, newHostId, roomClosed: false };
  });

  if (result.roomClosed) {
    // Nobody left to notify, but broadcast anyway in case of stragglers mid-refresh.
    await broadcast(room.code, "state", { status: "finished", gameId: room.gameId, target: "/" });
    return NextResponse.json({ ok: true, left: true, roomClosed: true });
  }

  const newHost = result.newHostId;
  await broadcast(room.code, "lobby-update", {
    players: result.remaining.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isHost: newHost ? p.id === newHost : p.isHost,
      anonId: p.anonId,
    })),
    gameId: room.gameId,
    status: room.status,
  });

  // In-game clients refetch their redacted view on `game-event`.
  if (room.status === "in_game" && room.gameId) {
    await broadcast(room.code, "game-event", {
      gameId: room.gameId,
      updatedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, left: true, newHostId: result.newHostId });
}
