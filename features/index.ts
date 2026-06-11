import type { GameId } from "@/lib/db/schema";
import type { GameModule } from "./registry";
import { imposteriModule } from "./imposteri/module";
import { asocijacijeModule } from "./asocijacije/module";
import { gradoviModule } from "./gradovi-i-sela/module";
import { guessTheSongModule } from "./guess-the-song/module";
import { aliasModule } from "./alias/module";

// Central lookup. New games register here; the hub/registry stays generic.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modules: Record<GameId, GameModule<any, any, any>> = {
  imposteri: imposteriModule,
  asocijacije: asocijacijeModule,
  "gradovi-i-sela": gradoviModule,
  "guess-the-song": guessTheSongModule,
  alias: aliasModule,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGameModule(id: GameId): GameModule<any, any, any> {
  return modules[id];
}
