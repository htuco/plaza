import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getGameModule } from "@/features";
import {
  applyGradoviAiSuggestions,
  getGradoviAiCandidates,
  getGradoviAiSuggestions,
} from "@/features/gradovi-i-sela/validation-server";
import type { GradoviState } from "@/features/gradovi-i-sela/types";
import { db, schema } from "@/lib/db/client";
import { broadcast } from "@/lib/realtime/server";
import { getRoomByCode } from "@/lib/rooms/server";
import { createClient } from "@/lib/supabase/server";

type PlayerSummary = {
  id: string;
  nickname: string;
  isHost: boolean;
};

function serializeGradoviSnapshot({
  state,
  playerId,
  players,
  updatedAt,
  warning,
}: {
  state: GradoviState;
  playerId: string;
  players: PlayerSummary[];
  updatedAt: Date;
  warning?: string;
}) {
  const gameModule = getGameModule("gradovi-i-sela");
  return {
    ok: true,
    gameId: "gradovi-i-sela",
    playerId,
    players,
    view: gameModule.redact(state, playerId),
    updatedAt: updatedAt.toISOString(),
    ...(warning ? { warning } : {}),
  };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ room: string }> },
) {
  const { room: code } = await params;
  const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.status !== "in_game" || room.gameId !== "gradovi-i-sela") {
    return NextResponse.json({ error: "Room is not in Gradovi i Sela." }, { status: 409 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = room.players.find((p) => p.anonId === user?.id);
  if (!me) return NextResponse.json({ error: "Player not in room." }, { status: 403 });
  if (!me.isHost) {
    return NextResponse.json({ error: "Only the host can run AI validation." }, { status: 403 });
  }

  const gameState = await db.query.gameStates.findFirst({
    where: eq(schema.gameStates.roomId, room.id),
  });
  if (!gameState || gameState.gameId !== "gradovi-i-sela") {
    return NextResponse.json({ error: "Game state not found." }, { status: 404 });
  }

  const state = gameState.state as GradoviState;
  if (state.phase !== "review") {
    return NextResponse.json(
      { error: "AI validation is only available during review." },
      { status: 409 },
    );
  }

  if (getGradoviAiCandidates(state).length === 0) {
    return NextResponse.json(
      serializeGradoviSnapshot({
        state,
        playerId: me.id,
        players: room.players.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          isHost: p.isHost,
        })),
        updatedAt: gameState.updatedAt,
      }),
    );
  }

  const players = room.players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    isHost: p.isHost,
  }));

  let suggestions: Awaited<ReturnType<typeof getGradoviAiSuggestions>>;
  try {
    suggestions = await getGradoviAiSuggestions(state);
  } catch (error) {
    console.error("Gradovi AI validation failed", error);
    return NextResponse.json(
      serializeGradoviSnapshot({
        state,
        playerId: me.id,
        players,
        updatedAt: gameState.updatedAt,
        warning: "AI validator is unavailable. Check Gemini API key or continue with host review.",
      }),
    );
  }

  if (suggestions.length === 0) {
    return NextResponse.json(
      serializeGradoviSnapshot({
        state,
        playerId: me.id,
        players,
        updatedAt: gameState.updatedAt,
        warning: "AI did not return usable suggestions. Continue with host review.",
      }),
    );
  }

  const savedAt = new Date();
  const nextState = await db.transaction(async (tx) => {
    const [currentGameState] = await tx
      .select()
      .from(schema.gameStates)
      .where(eq(schema.gameStates.roomId, room.id))
      .for("update")
      .limit(1);

    if (!currentGameState || currentGameState.gameId !== "gradovi-i-sela") return state;

    const currentState = currentGameState.state as GradoviState;
    const updatedState = applyGradoviAiSuggestions(currentState, suggestions);
    await tx
      .update(schema.gameStates)
      .set({ state: updatedState, updatedAt: savedAt })
      .where(eq(schema.gameStates.roomId, room.id));
    return updatedState;
  });

  await broadcast(room.code, "game-event", {
    gameId: "gradovi-i-sela",
    updatedAt: savedAt.toISOString(),
  });

  return NextResponse.json(
    serializeGradoviSnapshot({
      state: nextState,
      playerId: me.id,
      players,
      updatedAt: savedAt,
    }),
  );
}
