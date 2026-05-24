import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { generateRoomCode, normalizeRoomCode } from "./code";

const MAX_CODE_ATTEMPTS = 8;

export async function createRoom(opts: { hostAnonId: string; hostNickname: string }) {
  let code = generateRoomCode();
  let attempts = 0;

  // Collision-retry — the alphabet is small but codes are unique by constraint.
  while (attempts < MAX_CODE_ATTEMPTS) {
    const existing = await db.query.rooms.findFirst({ where: eq(schema.rooms.code, code) });
    if (!existing) break;
    code = generateRoomCode();
    attempts++;
  }

  const [room] = await db.insert(schema.rooms).values({ code }).returning();

  const [host] = await db
    .insert(schema.players)
    .values({
      roomId: room.id,
      anonId: opts.hostAnonId,
      nickname: opts.hostNickname,
      isHost: true,
    })
    .returning();

  await db
    .update(schema.rooms)
    .set({ hostPlayerId: host.id })
    .where(eq(schema.rooms.id, room.id));

  return { room: { ...room, hostPlayerId: host.id }, player: host };
}

export async function joinRoom(opts: { code: string; anonId: string; nickname: string }) {
  const code = normalizeRoomCode(opts.code);
  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.code, code) });
  if (!room) return { error: "not_found" as const };

  // If the same anon user rejoins, return their existing seat instead of duplicating.
  const existing = await db.query.players.findFirst({
    where: (p, { and, eq }) => and(eq(p.roomId, room.id), eq(p.anonId, opts.anonId)),
  });
  if (existing) return { room, player: existing };

  const [player] = await db
    .insert(schema.players)
    .values({
      roomId: room.id,
      anonId: opts.anonId,
      nickname: opts.nickname,
      isHost: false,
    })
    .returning();

  return { room, player };
}

export async function getRoomByCode(code: string) {
  const normalized = normalizeRoomCode(code);
  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.code, normalized) });
  if (!room) return null;

  const players = await db.query.players.findMany({
    where: eq(schema.players.roomId, room.id),
  });

  return { ...room, players };
}
