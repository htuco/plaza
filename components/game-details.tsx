"use client";

import type { GameId } from "@/lib/db/schema";
import { usePreferences } from "./preferences-provider";

export function GameDetails({ gameId }: { gameId: GameId }) {
  const { gameDetails, t } = usePreferences();
  const details = gameDetails(gameId);

  return (
    <div className="plaza-divider border-t px-4 pb-4 pt-3 text-sm">
      <div className="grid gap-3">
        <section>
          <h4 className="plaza-label mb-2">{t("game.rules")}</h4>
          <ul className="grid gap-1.5">
            {details.rules.map((rule) => (
              <li key={rule} className="plaza-muted flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--plaza-accent)]" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="plaza-label mb-2">{t("game.example")}</h4>
          <p className="plaza-subtle rounded-lg px-3 py-2 text-[var(--foreground)]">
            {details.example}
          </p>
        </section>
      </div>
    </div>
  );
}
