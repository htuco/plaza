"use client";

import { GAME_ICONS } from "@/components/game-icons";
import { usePreferences } from "@/components/preferences-provider";
import { GAMES } from "@/features/registry";
import type { GameId } from "@/lib/db/schema";

const GAME_CARD_TONES: Record<GameId, string> = {
  imposteri: "plaza-game-card--mask",
  alias: "plaza-game-card--voice",
  "gradovi-i-sela": "plaza-game-card--paper",
  asocijacije: "plaza-game-card--puzzle",
  "guess-the-song": "plaza-game-card--music",
};

const FEATURED_ID: GameId = "alias";
const ROOM_CODE = ["A", "B", "C", "D", "E"];

// Demo lobby — clearly fake sample data that previews the room experience.
const DEMO_PLAYERS = [
  { name: "Hamza", host: true },
  { name: "Ajdin", host: false },
  { name: "Dženis", host: false },
];
const DEMO_OVERFLOW = 2;

/**
 * Hero sidebar "Live Game Table" — a decorative, non-interactive preview of
 * what a Plaza room looks like once friends are in: a featured game, a demo
 * lobby with player pills, a shareable room code, a faint activity feed, and
 * a compact rail of the other games. Supports the left-hand CTA; never
 * competes with it. All data here is fake/sample by design.
 */
export function LiveTablePreview() {
  const { gameCopy, t } = usePreferences();
  const otherGames = GAMES.filter((game) => game.id !== FEATURED_ID);

  return (
    <aside className="plaza-table-preview p-4 sm:p-5" aria-label={t("preview.eyebrow")}>
      <div className="plaza-table-preview__header">
        <span className="plaza-table-preview__live" aria-hidden="true" />
        <span className="plaza-table-preview__eyebrow">{t("preview.eyebrow")}</span>
      </div>

      {/* Featured game — the visual anchor of the panel. */}
      <article className={`plaza-feature-card ${GAME_CARD_TONES[FEATURED_ID]} mt-3 p-4`}>
        <div className="flex items-start gap-3.5">
          <span className="plaza-game-card__icon shrink-0" aria-hidden="true">
            {GAME_ICONS[FEATURED_ID]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="plaza-display truncate text-xl font-extrabold">
                {gameCopy(FEATURED_ID).displayName}
              </h3>
              <span className="plaza-status-valid shrink-0 rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold">
                {t("preview.status.ready")}
              </span>
            </div>
            <p className="plaza-feature-card__desc mt-1.5 text-sm leading-snug">
              {t("preview.alias.tagline")}
            </p>
            <p className="plaza-feature-card__meta mt-2 text-xs font-semibold">
              {t("preview.alias.meta")}
            </p>
          </div>
        </div>
      </article>

      {/* Demo lobby — player pills with a host badge and online dots. */}
      <section className="mt-4">
        <p className="plaza-table-preview__label mb-2">{t("preview.atTable")}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {DEMO_PLAYERS.map((player) => (
            <span key={player.name} className="plaza-preview-pill">
              <span className="plaza-preview-pill__dot" aria-hidden="true" />
              <span className="font-semibold">{player.name}</span>
              {player.host && <span className="plaza-preview-pill__host">{t("preview.host")}</span>}
            </span>
          ))}
          <span className="plaza-preview-pill plaza-preview-pill--more">
            {t("preview.more", DEMO_OVERFLOW)}
          </span>
        </div>
      </section>

      {/* Shareable room code. */}
      <section className="plaza-preview-code mt-4 p-3.5">
        <div>
          <p className="plaza-table-preview__label">{t("preview.roomCode")}</p>
          <div className="plaza-preview-code__digits mt-1.5">
            {ROOM_CODE.map((char, index) => (
              <span key={`${char}-${index}`} className="plaza-preview-code__digit">
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

      {/* Decorative activity feed — sample, not real data. */}
      <ul className="plaza-preview-feed mt-4" aria-hidden="true">
        {[
          t("preview.activity.created"),
          t("preview.activity.joined"),
          t("preview.activity.picked"),
        ].map((line, index) => (
          <li key={line} className="plaza-preview-feed__row" style={{ "--feed-i": index } as React.CSSProperties}>
            <span className="plaza-preview-feed__dot" />
            <span className="truncate">{line}</span>
          </li>
        ))}
      </ul>

      {/* Other games — compact chips, deliberately quieter than the feature. */}
      <section className="mt-4">
        <p className="plaza-table-preview__label mb-2">{t("preview.moreGames")}</p>
        <div className="flex flex-wrap gap-1.5">
          {otherGames.map((game) => (
            <span key={game.id} className={`plaza-preview-chip ${GAME_CARD_TONES[game.id]}`}>
              <span aria-hidden="true">{GAME_ICONS[game.id]}</span>
              <span className="truncate font-semibold">{gameCopy(game.id).displayName}</span>
            </span>
          ))}
        </div>
      </section>
    </aside>
  );
}
