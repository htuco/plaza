import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getGameModule } from "@/features";
import { normalizeSongState } from "@/features/guess-the-song/module";
import { SONG_SOURCE_PRESETS } from "@/features/guess-the-song/types";
import type { GuessTheSongState } from "@/features/guess-the-song/types";
import { collectTracksForTerms } from "@/lib/music/itunes";
import { db, schema } from "@/lib/db/client";
import { broadcast } from "@/lib/realtime/server";
import { getRoomByCode } from "@/lib/rooms/server";
import { createClient } from "@/lib/supabase/server";

const MAX_CUSTOM_QUERY_LENGTH = 60;

type StartBody = {
  presetId?: unknown;
  customQuery?: unknown;
};

// Host-only: fetch preview tracks from iTunes and start the first round.
// Track fetching is async so it can't live in the (sync) reducer — this route
// owns that step, mirroring the gradovi-ai pattern.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ room: string }> },
) {
  let body: StartBody = {};
  try {
    body = (await request.json()) as StartBody;
  } catch {
    // missing body is fine; validated below
  }

  const { room: code } = await params;
  const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.status !== "in_game" || room.gameId !== "guess-the-song") {
    return NextResponse.json({ error: "Room is not in Guess the Song." }, { status: 409 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = room.players.find((p) => p.anonId === user?.id);
  if (!me) return NextResponse.json({ error: "Player not in room." }, { status: 403 });

  // Resolve the song source before touching state.
  const preset =
    typeof body.presetId === "string"
      ? SONG_SOURCE_PRESETS.find((entry) => entry.id === body.presetId)
      : undefined;
  const customQuery =
    typeof body.customQuery === "string"
      ? body.customQuery.trim().slice(0, MAX_CUSTOM_QUERY_LENGTH)
      : "";
  if (!preset && !customQuery) {
    return NextResponse.json({ error: "Pick a music source first." }, { status: 400 });
  }
  const terms = preset ? [...preset.terms] : [customQuery];
  const label = preset ? preset.label : customQuery;

  let tracks: Awaited<ReturnType<typeof collectTracksForTerms>> = [];
  try {
    tracks = await collectTracksForTerms(terms);
  } catch {
    tracks = [];
  }

  const result = await db.transaction(async (tx) => {
    const [gameState] = await tx
      .select()
      .from(schema.gameStates)
      .where(eq(schema.gameStates.roomId, room.id))
      .for("update")
      .limit(1);
    if (!gameState || gameState.gameId !== "guess-the-song") {
      return { kind: "not-found" as const };
    }

    const current = normalizeSongState(gameState.state as GuessTheSongState);
    if (current.hostId !== me.id) return { kind: "forbidden" as const };
    if (current.phase !== "setup") return { kind: "wrong-phase" as const };
    if (tracks.length < 3) return { kind: "no-tracks" as const };

    const now = Date.now();
    const nextState: GuessTheSongState = {
      ...current,
      phase: "playing",
      playlistLabel: label,
      tracks: tracks.slice(0, Math.max(current.settings.totalRounds, 3)),
      roundIndex: 0,
      roundDeadlineAt: now + current.settings.guessDurationSeconds * 1000,
      progress: {},
      firstMatchPlayerId: null,
      roundPoints: {},
      scores: Object.fromEntries(room.players.map((p) => [p.id, 0])),
    };

    await tx
      .update(schema.gameStates)
      .set({ state: nextState, updatedAt: new Date() })
      .where(eq(schema.gameStates.roomId, room.id));
    return { kind: "ok" as const, nextState };
  });

  if (result.kind === "not-found") {
    return NextResponse.json({ error: "Game state not found." }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ error: "Only the host can start." }, { status: 403 });
  }
  if (result.kind === "wrong-phase") {
    return NextResponse.json({ error: "Game already started." }, { status: 409 });
  }
  if (result.kind === "no-tracks") {
    return NextResponse.json(
      { error: "No playable previews found for that source. Try another one." },
      { status: 502 },
    );
  }

  await broadcast(room.code, "game-event", {
    gameId: "guess-the-song",
    updatedAt: new Date().toISOString(),
  });

  const gameModule = getGameModule("guess-the-song");
  return NextResponse.json({
    ok: true,
    gameId: "guess-the-song",
    playerId: me.id,
    players: room.players.map((p) => ({ id: p.id, nickname: p.nickname, isHost: p.isHost })),
    view: gameModule.redact(result.nextState, me.id),
    updatedAt: new Date().toISOString(),
  });
}
