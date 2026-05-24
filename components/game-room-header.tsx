"use client";

import type { GameId } from "@/lib/db/schema";
import { usePreferences } from "./preferences-provider";

export function GameRoomHeader({
  gameId,
  roomCode,
}: {
  gameId: GameId;
  roomCode: string;
}) {
  const { gameCopy } = usePreferences();

  return (
    <header className="mb-4 flex items-baseline justify-between gap-4">
      <h1 className="min-w-0 truncate text-lg font-medium">{gameCopy(gameId).displayName}</h1>
      <span className="plaza-muted-2 font-mono text-xs tracking-widest">{roomCode}</span>
    </header>
  );
}
