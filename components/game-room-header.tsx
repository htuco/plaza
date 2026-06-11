"use client";

import type { GameId } from "@/lib/db/schema";
import { usePreferences } from "./preferences-provider";
import { GAME_ICONS } from "./game-icons";
import { LeaveRoomButton } from "./leave-room-button";
import { RoomCode } from "./room-code";

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
    <header className="mb-4 flex items-center justify-between gap-3">
      <h1 className="flex min-w-0 items-center gap-2.5 text-lg font-semibold">
        <span className="plaza-game-tile__icon shrink-0" aria-hidden="true">
          {GAME_ICONS[gameId]}
        </span>
        <span className="truncate">{gameCopy(gameId).displayName}</span>
      </h1>
      <div className="flex shrink-0 items-center gap-2">
        <RoomCode code={roomCode} size="sm" />
        <LeaveRoomButton roomCode={roomCode} isHost={isHost} />
      </div>
    </header>
  );
}
