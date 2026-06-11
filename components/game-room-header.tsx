"use client";

import type { GameId } from "@/lib/db/schema";
import { usePreferences } from "./preferences-provider";
import { GAME_ICONS } from "./game-icons";
import { LeaveRoomButton } from "./leave-room-button";
import { RoomCode } from "./room-code";

// In-game shell header: game identity on the left, room code + leave on the
// right. Stays in normal flow so the fixed floating timers keep their spot.
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
    <header className="plaza-panel mb-4 flex items-center justify-between gap-3 px-3 py-2.5">
      <h1 className="flex min-w-0 items-center gap-2.5 text-lg font-bold">
        <span className="plaza-game-tile__icon shrink-0" aria-hidden="true">
          {GAME_ICONS[gameId]}
        </span>
        <span className="plaza-display truncate">{gameCopy(gameId).displayName}</span>
      </h1>
      <div className="flex shrink-0 items-center gap-2">
        <RoomCode code={roomCode} size="sm" />
        <LeaveRoomButton roomCode={roomCode} isHost={isHost} />
      </div>
    </header>
  );
}
