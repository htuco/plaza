"use client";

import type { GameId } from "@/lib/db/schema";
import { usePreferences } from "./preferences-provider";
import { GameIcon } from "./game-icons";
import { LeaveRoomButton } from "./leave-room-button";
import { RoomCode } from "./room-code";
import { RoomTopBar } from "./room-shell";

// In-game top bar: game identity on the left, room code + exit on the right.
// Same 56px bar as the lobby, so switching from lobby to game never shifts the
// content underneath.
export function GameRoomHeader({
  gameId,
  roomCode,
  isHost = false,
}: {
  gameId: GameId;
  roomCode: string;
  isHost?: boolean;
}) {
  const { gameCopy } = usePreferences();

  return (
    <RoomTopBar>
      <h1 className="flex min-w-0 items-center gap-2.5">
        <GameIcon gameId={gameId} size={32} />
        <span className="truncate text-[0.94rem] font-semibold">
          {gameCopy(gameId).displayName}
        </span>
      </h1>
      <div className="flex shrink-0 items-center gap-2">
        <RoomCode code={roomCode} size="sm" />
        <LeaveRoomButton roomCode={roomCode} isHost={isHost} label="room.exit" />
      </div>
    </RoomTopBar>
  );
}
