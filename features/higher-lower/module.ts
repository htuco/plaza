import type { GameModule } from "@/features/registry";
import { randomCategory, shuffledRoundItems } from "./items";
import type {
  HigherLowerIntent,
  HigherLowerRevealedItem,
  HigherLowerRoundItem,
  HigherLowerState,
  HigherLowerView,
  PlayerProgress,
  Phase,
} from "./types";
import { HigherLowerClient } from "./client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isHigherLowerIntent(value: unknown): value is HigherLowerIntent {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "guess":
      return value.direction === "higher" || value.direction === "lower";
    case "start-game":
    case "play-again":
      return true;
    default:
      return false;
  }
}

function normalizePhase(value: unknown): Phase {
  return value === "playing" || value === "finished" ? value : "setup";
}

function normalizeItems(value: unknown): HigherLowerRoundItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is HigherLowerRoundItem =>
      isRecord(entry) &&
      typeof entry.id === "string" &&
      typeof entry.label === "string" &&
      typeof entry.value === "number" &&
      typeof entry.unit === "string",
  );
}

function normalizeProgress(value: unknown): Record<string, PlayerProgress> {
  if (!isRecord(value)) return {};
  const result: Record<string, PlayerProgress> = {};
  for (const [playerId, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    result[playerId] = {
      position: typeof entry.position === "number" && entry.position >= 0 ? Math.floor(entry.position) : 0,
      alive: entry.alive !== false,
    };
  }
  return result;
}

function normalizeState(state: HigherLowerState): HigherLowerState {
  const stored = (state ?? {}) as Partial<HigherLowerState>;
  return {
    phase: normalizePhase(stored.phase),
    category:
      stored.category === "internet" || stored.category === "trivia" || stored.category === "regional"
        ? stored.category
        : null,
    items: normalizeItems(stored.items),
    progress: normalizeProgress(stored.progress),
    hostId: typeof stored.hostId === "string" ? stored.hostId : "",
  };
}

function ensurePlayers(state: HigherLowerState, playerIds: string[]): HigherLowerState {
  const progress = { ...state.progress };
  let changed = false;
  for (const id of playerIds) {
    if (!progress[id]) {
      progress[id] = { position: 0, alive: true };
      changed = true;
    }
  }
  return changed ? { ...state, progress } : state;
}

function startRound(state: HigherLowerState, playerIds: string[]): HigherLowerState {
  const category = randomCategory();
  const items = shuffledRoundItems(category);
  return {
    ...state,
    phase: "playing",
    category,
    items,
    progress: Object.fromEntries(playerIds.map((id) => [id, { position: 0, alive: true }])),
  };
}

function allOut(state: HigherLowerState): boolean {
  const entries = Object.values(state.progress);
  return entries.length > 0 && entries.every((entry) => !entry.alive);
}

function winnerPlayerIds(state: HigherLowerState): string[] {
  if (state.phase !== "finished") return [];
  const entries = Object.entries(state.progress);
  if (entries.length === 0) return [];
  const top = Math.max(...entries.map(([, progress]) => progress.position));
  return entries.filter(([, progress]) => progress.position === top).map(([id]) => id);
}

export const higherLowerModule: GameModule<HigherLowerState, HigherLowerIntent, HigherLowerView> = {
  id: "higher-lower",
  displayName: "Veće ili Manje",
  tagline: "Pogodi veće ili manje prije nego što pogriješiš.",
  minPlayers: 1,
  maxPlayers: 8,

  initialState: ({ playerIds, hostId }) => ({
    phase: "setup",
    category: null,
    items: [],
    progress: Object.fromEntries(playerIds.map((id) => [id, { position: 0, alive: true }])),
    hostId,
  }),

  reduce: (state, rawIntent, ctx) => {
    if (!isHigherLowerIntent(rawIntent)) throw new Error("Invalid Higher or Lower action.");
    const intent = rawIntent;
    const current = ensurePlayers(normalizeState(state), ctx.playerIds);
    const isHost = ctx.playerId === current.hostId;

    if (intent.kind === "start-game") {
      if (!isHost) throw new Error("Only the host can start.");
      if (current.phase !== "setup") throw new Error("Game already started.");
      return startRound(current, ctx.playerIds);
    }

    if (intent.kind === "play-again") {
      if (!isHost) throw new Error("Only the host can restart.");
      if (current.phase !== "finished") throw new Error("Game is not finished yet.");
      return startRound(current, ctx.playerIds);
    }

    // guess
    if (current.phase !== "playing") throw new Error("Game is not running.");
    const myProgress = current.progress[ctx.playerId];
    if (!myProgress || !myProgress.alive) throw new Error("You are already out this round.");

    const currentItem = current.items[myProgress.position];
    const nextItem = current.items[myProgress.position + 1];
    if (!currentItem || !nextItem) {
      // Ran off the end of the deck — treat as surviving with the deck exhausted.
      return current;
    }

    const isHigher = nextItem.value >= currentItem.value;
    const guessedHigher = intent.direction === "higher";
    const correct = isHigher === guessedHigher;

    const nextProgress: PlayerProgress = correct
      ? { position: myProgress.position + 1, alive: true }
      : { position: myProgress.position, alive: false };

    const nextState: HigherLowerState = {
      ...current,
      progress: { ...current.progress, [ctx.playerId]: nextProgress },
    };

    return allOut(nextState) ? { ...nextState, phase: "finished" } : nextState;
  },

  redact: (state, playerId): HigherLowerView => {
    const current = normalizeState(state);
    const my = current.progress[playerId] ?? { position: 0, alive: true };

    const revealed: HigherLowerRevealedItem[] = current.items
      .slice(0, my.position + 1)
      .map((item) => ({ label: item.label, value: item.value, unit: item.unit }));

    const nextItem =
      my.alive && current.phase === "playing" ? current.items[my.position + 1] ?? null : null;

    return {
      phase: current.phase,
      category: current.category,
      revealed,
      nextLabel: nextItem?.label ?? null,
      nextUnit: nextItem?.unit ?? null,
      alive: my.alive,
      position: my.position,
      progress: Object.fromEntries(
        Object.entries(current.progress).map(([id, entry]) => [
          id,
          { position: entry.position, alive: entry.alive },
        ]),
      ),
      winnerPlayerIds: winnerPlayerIds(current),
      isHost: playerId === current.hostId,
    };
  },

  ClientComponent: HigherLowerClient,
};
