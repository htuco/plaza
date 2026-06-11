import type { GameId } from "@/lib/db/schema";

// One friendly glyph per game, used on catalog tiles and the lobby picker.
export const GAME_ICONS: Record<GameId, string> = {
  imposteri: "🎭",
  alias: "🗣️",
  "gradovi-i-sela": "✍️",
  asocijacije: "🧩",
  "guess-the-song": "🎧",
};
