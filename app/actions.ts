"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { createRoom, joinRoom, getRoomByCode } from "@/lib/rooms/server";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/rooms/code";
import { broadcast } from "@/lib/realtime/server";
import { db, schema } from "@/lib/db/client";
import { GAMES, getGameMeta, isGamePlayable } from "@/features/registry";
import { getGameModule } from "@/features";
import type { GameId } from "@/lib/db/schema";

function sanitizeNickname(input: FormDataEntryValue | null): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().slice(0, 20);
  return trimmed.length >= 1 ? trimmed : null;
}

async function getAnonUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user.id;
  // Middleware should have signed us in already; fall back just in case.
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error("anonymous_auth_failed");
  return data.user.id;
}

// Build the public lobby payload (no secrets — just the player roster + selected game).
async function lobbyPayload(roomCode: string) {
  const room = await getRoomByCode(roomCode);
  if (!room) return null;
  return {
    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isHost: p.isHost,
      anonId: p.anonId,
    })),
    gameId: room.gameId,
    status: room.status,
  };
}

export async function createRoomAction(formData: FormData) {
  const nickname = sanitizeNickname(formData.get("nickname"));
  if (!nickname) return { error: "Pick a nickname (1–20 chars)." };

  const anonId = await getAnonUserId();
  const { room } = await createRoom({ hostAnonId: anonId, hostNickname: nickname });
  redirect(`/play/${room.code}`);
}

export async function joinRoomAction(formData: FormData) {
  const nickname = sanitizeNickname(formData.get("nickname"));
  if (!nickname) return { error: "Pick a nickname (1–20 chars)." };

  const rawCode = formData.get("code");
  if (typeof rawCode !== "string" || !isValidRoomCode(rawCode)) {
    return { error: "Room code is 5 letters/digits." };
  }
  const code = normalizeRoomCode(rawCode);

  const anonId = await getAnonUserId();
  const result = await joinRoom({ code, anonId, nickname });
  if ("error" in result) return { error: "Room not found." };

  // Tell everyone in the room the roster changed.
  const payload = await lobbyPayload(result.room.code);
  if (payload) await broadcast(result.room.code, "lobby-update", payload);

  redirect(`/play/${result.room.code}`);
}

// Host-only: set which game the room will play. Broadcasts to everyone in the lobby.
export async function selectGameAction(roomCode: string, gameId: GameId) {
  if (!GAMES.some((g) => g.id === gameId)) return { error: "Unknown game." };
  if (!isGamePlayable(gameId)) return { error: `${getGameMeta(gameId)?.displayName ?? "This game"} is coming soon.` };

  const code = normalizeRoomCode(roomCode);
  const room = await getRoomByCode(code);
  if (!room) return { error: "Room not found." };
  if (room.status !== "lobby") return { error: "Room is not in lobby." };

  const anonId = await getAnonUserId();
  const me = room.players.find((p) => p.anonId === anonId);
  if (!me?.isHost) return { error: "Only the host can pick a game." };

  await db.update(schema.rooms).set({ gameId }).where(eq(schema.rooms.id, room.id));

  const payload = await lobbyPayload(code);
  if (payload) await broadcast(code, "lobby-update", payload);
  return { ok: true as const };
}

// Host-only: initialize game state and broadcast `state` so every client redirects into the game.
export async function startGameAction(roomCode: string) {
  const code = normalizeRoomCode(roomCode);
  const room = await getRoomByCode(code);
  if (!room) return { error: "Room not found." };
  if (room.status !== "lobby") return { error: "Game already started." };
  if (!room.gameId) return { error: "Pick a game first." };
  if (!isGamePlayable(room.gameId)) {
    return { error: `${getGameMeta(room.gameId)?.displayName ?? "This game"} is coming soon.` };
  }

  const anonId = await getAnonUserId();
  const me = room.players.find((p) => p.anonId === anonId);
  if (!me?.isHost) return { error: "Only the host can start." };

  const gameModule = getGameModule(room.gameId);
  if (room.players.length < gameModule.minPlayers) {
    return { error: `Need at least ${gameModule.minPlayers} players.` };
  }

  const initial = gameModule.initialState({
    playerIds: room.players.map((p) => p.id),
    hostId: me.id,
  });

  await db
    .insert(schema.gameStates)
    .values({ roomId: room.id, gameId: room.gameId, state: initial })
    .onConflictDoUpdate({
      target: schema.gameStates.roomId,
      set: { gameId: room.gameId, state: initial, updatedAt: new Date() },
    });

  await db.update(schema.rooms).set({ status: "in_game" }).where(eq(schema.rooms.id, room.id));

  // Broadcast a `state` event with the target route; clients in the lobby navigate to it.
  await broadcast(code, "state", { gameId: room.gameId, status: "in_game" });
  return { ok: true as const };
}
