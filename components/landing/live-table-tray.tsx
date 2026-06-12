"use client";

import { useState, type CSSProperties } from "react";
import { GAME_ICONS } from "@/components/game-icons";
import { usePreferences } from "@/components/preferences-provider";
import { GameCardDeck } from "@/components/landing/game-card-deck";
import { InteractiveDice } from "@/components/landing/interactive-dice";
import { PlayerTokens } from "@/components/landing/player-tokens";
import { GAMES } from "@/features/registry";
import type { GameId } from "@/lib/db/schema";

const GAME_TONES: Record<GameId, string> = {
  imposteri: "plaza-game-card--mask",
  alias: "plaza-game-card--voice",
  "gradovi-i-sela": "plaza-game-card--paper",
  asocijacije: "plaza-game-card--puzzle",
  "guess-the-song": "plaza-game-card--music",
};

const ROOM_CODE = ["A", "B", "C", "D", "E"];

/**
 * The hero's right side: not a dashboard but a game tray sitting on the
 * table. A fanned deck of face-down cards reveals games on click and drives
 * the large featured card (which flips over per selection); below it sit
 * player chips, the demo room code as wooden tiles, and activity note slips.
 * The mini die in the corner is genuinely rollable.
 */
export function LiveTableTray() {
  const { gameCopy, t } = usePreferences();
  const [selected, setSelected] = useState<GameId>("alias");

  const meta = GAMES.find((game) => game.id === selected) ?? GAMES[0];
  const copy = gameCopy(meta.id);

  return (
    <aside className="plaza-tray p-4 sm:p-5" aria-label={t("preview.eyebrow")}>
      <div className="flex items-center justify-between gap-2">
        <div className="plaza-table-preview__header">
          <span className="plaza-table-preview__live" aria-hidden="true" />
          <span className="plaza-table-preview__eyebrow">{t("preview.eyebrow")}</span>
        </div>
        <InteractiveDice size="sm" className="plaza-tray__dice" />
      </div>

      {/* Face-down hand — flip a card to pick tonight's game. */}
      <GameCardDeck selected={selected} onSelect={setSelected} />
      <p className="plaza-tray__hint">{t("table.deckHint")}</p>

      {/* Featured game — flips over whenever the deck selection changes. */}
      <div className="plaza-tray__feature">
        <article
          key={meta.id}
          className={`plaza-feature-card plaza-feature-card--flip ${GAME_TONES[meta.id]} p-4`}
        >
          <div className="flex items-start gap-3.5">
            <span className="plaza-game-card__icon shrink-0" aria-hidden="true">
              {GAME_ICONS[meta.id]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="plaza-display truncate text-xl font-extrabold">
                  {copy.displayName}
                </h3>
                <span className="plaza-status-valid shrink-0 rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold">
                  {t("preview.status.ready")}
                </span>
              </div>
              <p className="plaza-feature-card__desc mt-1.5 text-sm leading-snug">
                {copy.tagline}
              </p>
              <p className="plaza-feature-card__meta mt-2 text-xs font-semibold">
                {t("home.players", meta.minPlayers, meta.maxPlayers)}
              </p>
            </div>
          </div>
        </article>
      </div>

      {/* Seats as physical chips. */}
      <section className="mt-4">
        <p className="plaza-table-preview__label mb-2">{t("preview.atTable")}</p>
        <PlayerTokens />
      </section>

      {/* Demo room code as scattered wooden tiles. */}
      <section className="plaza-preview-code mt-4 p-3.5">
        <div>
          <p className="plaza-table-preview__label">{t("preview.roomCode")}</p>
          <div className="plaza-preview-code__digits mt-1.5">
            {ROOM_CODE.map((char, index) => (
              <span
                key={`${char}-${index}`}
                className="plaza-preview-code__digit plaza-preview-code__digit--tile"
                style={{ "--tile-i": index } as CSSProperties}
              >
                {char}
              </span>
            ))}
          </div>
        </div>
        <span className="plaza-preview-code__hint" aria-hidden="true">
          {t("preview.copyHint")}
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        </span>
      </section>

      {/* Activity as small table-note slips — sample data by design. */}
      <ul className="plaza-preview-feed plaza-tray__notes mt-4" aria-hidden="true">
        {[
          t("preview.activity.created"),
          t("preview.activity.joined"),
          t("preview.activity.picked"),
        ].map((line, index) => (
          <li
            key={line}
            className="plaza-preview-feed__row plaza-tray__note"
            style={{ "--feed-i": index } as CSSProperties}
          >
            <span className="plaza-preview-feed__dot" />
            <span className="truncate">{line}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
