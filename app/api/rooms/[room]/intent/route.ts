import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getGameModule } from "@/features";
import { GRADOVI_LETTERS } from "@/features/gradovi-i-sela/types";
import type { GradoviState } from "@/features/gradovi-i-sela/types";
import { db, schema } from "@/lib/db/client";
import { broadcast } from "@/lib/realtime/server";
import { getRoomByCode } from "@/lib/rooms/server";
import { createClient } from "@/lib/supabase/server";
import type { GameId } from "@/lib/db/schema";

type IntentBody = {
  gameId?: unknown;
  intent?: unknown;
};

type IntentResult =
  | { kind: "ok"; nextState: unknown; savedAt: Date }
  | { kind: "not-found" }
  | { kind: "invalid"; message: string };

async function readBody(request: Request): Promise<IntentBody | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return null;
    return body as IntentBody;
  } catch {
    return null;
  }
}

function shuffleLetters(): string[] {
  const result = [...GRADOVI_LETTERS];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function normalizeGlobalLetterQueue(value: unknown): string[] {
  const allowed = new Set<string>(GRADOVI_LETTERS);
  const seen = new Set<string>();
  const stored = Array.isArray(value)
    ? value.filter((letter): letter is string => {
        if (typeof letter !== "string" || !allowed.has(letter) || seen.has(letter)) return false;
        seen.add(letter);
        return true;
      })
    : [];

  if (stored.length === 0) return shuffleLetters();
  return [...stored, ...GRADOVI_LETTERS.filter((letter) => !seen.has(letter))];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ room: string }> },
) {
  const body = await readBody(request);
  if (!body || body.intent === undefined) {
    return NextResponse.json({ error: "Missing intent." }, { status: 400 });
  }

  const { room: code } = await params;
  const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.status !== "in_game" || !room.gameId) {
    return NextResponse.json({ error: "Room is not in a game." }, { status: 409 });
  }
  if (typeof body.gameId === "string" && body.gameId !== room.gameId) {
    return NextResponse.json({ error: "Wrong game for this room." }, { status: 409 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = room.players.find((p) => p.anonId === user?.id);
  if (!me) return NextResponse.json({ error: "Player not in room." }, { status: 403 });

  const gameModule = getGameModule(room.gameId);

  const result: IntentResult = await db.transaction(async (tx) => {
    const [gameState] = await tx
      .select()
      .from(schema.gameStates)
      .where(eq(schema.gameStates.roomId, room.id))
      .for("update")
      .limit(1);

    if (!gameState || gameState.gameId !== room.gameId) {
      return { kind: "not-found" };
    }

    const now = new Date();
    let gradoviLetter: string | undefined;
    let nextState: unknown;

    try {
      if (room.gameId === "gradovi-i-sela") {
        const { shouldReserveGradoviLetter } = await import("@/features/gradovi-i-sela/module");
        const shouldReserve = shouldReserveGradoviLetter(
          gameState.state as GradoviState,
          body.intent,
          {
            playerId: me.id,
            now,
          },
        );

        if (shouldReserve) {
          await tx
            .insert(schema.gradoviLetterRotation)
            .values({ key: "global", queue: shuffleLetters(), updatedAt: now })
            .onConflictDoNothing();

          const [rotation] = await tx
            .select()
            .from(schema.gradoviLetterRotation)
            .where(eq(schema.gradoviLetterRotation.key, "global"))
            .for("update")
            .limit(1);
          const [letter = GRADOVI_LETTERS[0], ...rest] = normalizeGlobalLetterQueue(
            rotation?.queue,
          );
          gradoviLetter = letter;

          await tx
            .update(schema.gradoviLetterRotation)
            .set({ queue: [...rest, letter], updatedAt: now })
            .where(eq(schema.gradoviLetterRotation.key, "global"));
        }
      }

      nextState = gameModule.reduce(gameState.state, body.intent, {
        playerId: me.id,
        now,
        playerIds: room.players.map((player) => player.id),
        gradoviLetter,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid intent.";
      return { kind: "invalid", message };
    }

    if (room.gameId === "gradovi-i-sela") {
      const { applyGradoviWordPoolValidation } = await import(
        "@/features/gradovi-i-sela/validation-server"
      );
      nextState = await applyGradoviWordPoolValidation(nextState);
    }

    await tx
      .update(schema.gameStates)
      .set({ state: nextState, updatedAt: now })
      .where(eq(schema.gameStates.roomId, room.id));

    return { kind: "ok", nextState, savedAt: now };
  });

  if (result.kind === "not-found") {
    return NextResponse.json({ error: "Game state not found." }, { status: 404 });
  }
  if (result.kind === "invalid") {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  if (room.gameId === "gradovi-i-sela") {
    const { persistGradoviValidationSideEffects } = await import(
      "@/features/gradovi-i-sela/validation-server"
    );
    try {
      await persistGradoviValidationSideEffects({
        roomId: room.id,
        actorPlayerId: me.id,
        intent: body.intent,
        nextState: result.nextState,
      });
    } catch (error) {
      console.error("Failed to persist Gradovi validation side effects", error);
    }
  }

  await broadcast(room.code, "game-event", {
    gameId: room.gameId satisfies GameId,
    updatedAt: result.savedAt.toISOString(),
  });

  return NextResponse.json({
    ok: true,
    gameId: room.gameId,
    playerId: me.id,
    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isHost: p.isHost,
    })),
    view: gameModule.redact(result.nextState, me.id),
    updatedAt: result.savedAt.toISOString(),
  });
}
