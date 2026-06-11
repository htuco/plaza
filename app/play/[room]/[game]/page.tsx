import { notFound, redirect } from "next/navigation";
import { GameRoomHeader } from "@/components/game-room-header";
import { getRoomByCode } from "@/lib/rooms/server";
import { createClient } from "@/lib/supabase/server";
import { GAMES } from "@/features/registry";
import { getGameModule } from "@/features";
import type { GameId } from "@/lib/db/schema";

export default async function GamePage({
  params,
}: {
  params: Promise<{ room: string; game: string }>;
}) {
  const { room: code, game } = await params;

  if (!GAMES.some((g) => g.id === game)) notFound();
  const gameId = game as GameId;

  const room = await getRoomByCode(code);
  if (!room) notFound();
  if (room.status === "finished") redirect("/");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = room.players.find((p) => p.anonId === user?.id);
  if (!me) notFound();

  const gameModule = getGameModule(gameId);
  const Client = gameModule.ClientComponent;

  return (
    <div className="plaza-page flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-8 pt-14 sm:pt-8">
        <GameRoomHeader gameId={gameId} roomCode={room.code} isHost={me.isHost} />
        <Client roomCode={room.code} playerId={me.id} />
      </main>
    </div>
  );
}
