"use client";

import { usePreferences } from "@/components/preferences-provider";

export function AsocijacijeClient({ roomCode }: { roomCode: string; playerId: string }) {
  const { gameCopy, t } = usePreferences();

  return (
    <div className="plaza-panel rounded-lg p-5">
      <h2 className="font-medium">{gameCopy("asocijacije").displayName}</h2>
      <p className="plaza-muted mt-1 text-sm">
        {t("placeholder.asocijacije", roomCode)}
      </p>
    </div>
  );
}
