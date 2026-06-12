"use client";

import type { CSSProperties } from "react";
import { usePreferences } from "@/components/preferences-provider";

// Demo seats — clearly sample data previewing a live table.
const DEMO_PLAYERS = [
  { name: "Hamza", host: true },
  { name: "Ajdin", host: false },
  { name: "Dženis", host: false },
];
const DEMO_OVERFLOW = 2;

/**
 * Player seats as physical round chips. They pop onto the tray staggered on
 * load and lift with a warm glow on hover — the host chip is gilded.
 */
export function PlayerTokens() {
  const { t } = usePreferences();

  return (
    <div className="plaza-tray__tokens">
      {DEMO_PLAYERS.map((player, index) => (
        <span
          key={player.name}
          className={`plaza-token ${player.host ? "plaza-token--host" : ""}`}
          style={{ "--token-i": index } as CSSProperties}
        >
          <span className="plaza-token__chip" aria-hidden="true">
            {player.host ? "★" : player.name.slice(0, 1)}
          </span>
          <span className="plaza-token__name">{player.name}</span>
          {player.host && <span className="plaza-token__host">{t("preview.host")}</span>}
        </span>
      ))}
      <span className="plaza-token" style={{ "--token-i": DEMO_PLAYERS.length } as CSSProperties}>
        <span className="plaza-token__chip plaza-token__chip--more">
          {t("preview.more", DEMO_OVERFLOW)}
        </span>
      </span>
    </div>
  );
}
