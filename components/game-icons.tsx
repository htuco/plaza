import type { CSSProperties } from "react";
import type { GameId } from "@/lib/db/schema";

// One friendly glyph per game, used on catalog tiles and the lobby picker.
export const GAME_ICONS: Record<GameId, string> = {
  imposteri: "🎭",
  alias: "🗣️",
  "gradovi-i-sela": "✍️",
  asocijacije: "🧩",
  "guess-the-song": "🎧",
  "higher-lower": "📈",
};

// Per-game accent tones, shared with the landing catalog cards. They set
// `--game-tone`, which tints the icon tile and any accent that follows it.
export const GAME_TONES: Record<GameId, string> = {
  imposteri: "plaza-game-card--mask",
  alias: "plaza-game-card--voice",
  "gradovi-i-sela": "plaza-game-card--paper",
  asocijacije: "plaza-game-card--puzzle",
  "guess-the-song": "plaza-game-card--music",
  "higher-lower": "plaza-game-card--chart",
};

// Tinted icon tile. `size` is the design's tile scale in px: 32 in a top bar,
// 38 in the lobby picker, 44 on a rules header, 72 on an empty state.
export function GameIcon({
  gameId,
  size = 38,
  className = "",
}: {
  gameId: GameId;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`rm-game-icon ${GAME_TONES[gameId]} ${className}`}
      style={{ "--rm-icon": `${size / 16}rem` } as CSSProperties}
    >
      {GAME_ICONS[gameId]}
    </span>
  );
}
