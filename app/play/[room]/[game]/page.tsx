import { notFound, redirect } from "next/navigation";
import { GameRoomHeader } from "@/components/game-room-header";
import { RoomScreen } from "@/components/room-shell";
import { getRoomByCode } from "@/lib/rooms/server";
import { createClient } from "@/lib/supabase/server";
import { GAMES } from "@/features/registry";
import { getGameModule } from "@/features";
import type { GameId } from "@/lib/db/schema";

// Games whose screen has two jobs at once — a board or a form plus the running
// standings — get the wider desktop shell and lay out in two panes. The rest
// stay a single focal column at every size.
const WIDE_SHELL_GAMES: readonly GameId[] = ["asocijacije", "gradovi-i-sela", "higher-lower"];

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

  // The room shell owns the top bar; each game client renders the body and,
  // where the screen has an action, its own bottom bar — so the primary action
  // always sits in the same place across games.
  return (
    <RoomScreen wide={WIDE_SHELL_GAMES.includes(gameId)}>
      <GameRoomHeader gameId={gameId} roomCode={room.code} isHost={me.isHost} />
      <Client roomCode={room.code} playerId={me.id} />
    </RoomScreen>
  );
}
