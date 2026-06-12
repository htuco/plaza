"use client";

import { useState, type CSSProperties } from "react";
import { GAME_ICONS } from "@/components/game-icons";
import { usePreferences } from "@/components/preferences-provider";
import { GAMES } from "@/features/registry";
import type { GameId } from "@/lib/db/schema";

const GAME_TONES: Record<GameId, string> = {
  imposteri: "plaza-game-card--mask",
  alias: "plaza-game-card--voice",
  "gradovi-i-sela": "plaza-game-card--paper",
  asocijacije: "plaza-game-card--puzzle",
  "guess-the-song": "plaza-game-card--music",
};

/**
 * A fanned hand of five cards, dealt onto the tray on load. Cards rest
 * face-down (espresso Plaza back) and flip over on click to reveal a game;
 * the revealed game becomes the tray's featured card. Flipped cards stay
 * face-up, like cards turned over on a real table.
 */
export function GameCardDeck({
  selected,
  onSelect,
}: {
  selected: GameId | null;
  onSelect: (id: GameId) => void;
}) {
  const { gameCopy, t } = usePreferences();
  const [revealed, setRevealed] = useState<ReadonlySet<GameId>>(
    () => new Set(selected ? [selected] : []),
  );

  return (
    <div className="plaza-deck">
      {GAMES.map((game, index) => {
        const isRevealed = revealed.has(game.id);
        const isSelected = selected === game.id;
        return (
          <button
            key={game.id}
            type="button"
            className={`plaza-deck__card ${GAME_TONES[game.id]} ${
              isSelected ? "plaza-deck__card--selected" : ""
            }`}
            style={{ "--deck-i": index } as CSSProperties}
            data-revealed={isRevealed}
            aria-pressed={isSelected}
            aria-label={
              isRevealed ? gameCopy(game.id).displayName : t("table.revealCard")
            }
            onClick={() => {
              setRevealed((prev) => new Set(prev).add(game.id));
              onSelect(game.id);
            }}
          >
            <span className="plaza-deck__flip">
              <span className="plaza-deck__side plaza-deck__back-side" aria-hidden="true">
                <span className="plaza-deck__monogram">P</span>
              </span>
              <span className="plaza-deck__side plaza-deck__face" aria-hidden={!isRevealed}>
                <span className="plaza-deck__corner" aria-hidden="true">
                  {GAME_ICONS[game.id]}
                </span>
                <span className="plaza-deck__icon" aria-hidden="true">
                  {GAME_ICONS[game.id]}
                </span>
                <span className="plaza-deck__name">{gameCopy(game.id).displayName}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
