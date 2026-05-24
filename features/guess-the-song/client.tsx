"use client";

import { usePreferences } from "@/components/preferences-provider";

export function GuessTheSongClient({ roomCode }: { roomCode: string; playerId: string }) {
  const { gameCopy, t } = usePreferences();

  return (
    <div className="plaza-panel rounded-lg p-5">
      <h2 className="font-medium">{gameCopy("guess-the-song").displayName}</h2>
      <p className="plaza-muted mt-1 text-sm">
        {t("placeholder.guessTheSong", roomCode)}
      </p>
    </div>
  );
}
