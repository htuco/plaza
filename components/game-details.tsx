"use client";

import type { GameId } from "@/lib/db/schema";
import { usePreferences } from "./preferences-provider";

// Rules + a worked example for one game. Shown to guests while the host sets
// up (03) and under the host's selected row in the picker (02).
export function GameDetails({ gameId }: { gameId: GameId }) {
  const { gameDetails, t } = usePreferences();
  const details = gameDetails(gameId);

  return (
    <div className="grid gap-3.5 p-3.5 text-[0.81rem]">
      <section className="grid gap-2.5">
        <h4 className="rm-eyebrow">{t("game.rules")}</h4>
        <ul className="grid gap-2.5">
          {details.rules.map((rule) => (
            <li key={rule} className="plaza-muted flex gap-2.5 leading-relaxed">
              <span className="mt-[0.44rem] h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--plaza-accent)]" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-2">
        <h4 className="rm-eyebrow">{t("game.example")}</h4>
        <p className="plaza-subtle rounded-xl border border-[var(--plaza-line)] px-3.5 py-3 leading-relaxed">
          {details.example}
        </p>
      </section>
    </div>
  );
}
