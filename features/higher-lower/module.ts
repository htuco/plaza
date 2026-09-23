import type { GameModule } from "@/features/registry";
import { buildDeck, HIGHER_LOWER_CATEGORIES } from "./items";
import {
  LIVES_OPTIONS,
  ROUND_OPTIONS,
  TIMER_OPTIONS,
  type CategoryChoice,
  type GuessDirection,
  type HigherLowerCard,
  type HigherLowerIntent,
  type HigherLowerItem,
  type HigherLowerSettings,
  type HigherLowerState,
  type HigherLowerView,
  type Phase,
  type PlayerState,
} from "./types";
import { HigherLowerClient } from "./client";

const DEFAULT_SETTINGS: HigherLowerSettings = {
  category: "miks",
  rounds: 15,
  lives: 3,
  timerSeconds: 12,
};

const BASE_POINTS = 100;
const SPEED_BONUS_MAX = 50;
const REVEAL_SECONDS = 3.5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isCategoryChoice(value: unknown): value is CategoryChoice {
  return value === "miks" || HIGHER_LOWER_CATEGORIES.includes(value as never);
}

function pick<T extends number>(options: readonly T[], value: unknown, fallback: number): number {
  return options.includes(value as T) ? (value as number) : fallback;
}

function isHigherLowerIntent(value: unknown): value is HigherLowerIntent {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "guess":
      return value.direction === "higher" || value.direction === "lower";
    case "update-settings":
      return isRecord(value.settings);
    case "start-game":
    case "advance":
    case "play-again":
      return true;
    default:
      return false;
  }
}

function normalizeSettings(value: unknown): HigherLowerSettings {
  const stored = isRecord(value) ? value : {};
  return {
    category: isCategoryChoice(stored.category) ? stored.category : DEFAULT_SETTINGS.category,
    rounds: pick(ROUND_OPTIONS, stored.rounds, DEFAULT_SETTINGS.rounds),
    lives: pick(LIVES_OPTIONS, stored.lives, DEFAULT_SETTINGS.lives),
    timerSeconds: pick(TIMER_OPTIONS, stored.timerSeconds, DEFAULT_SETTINGS.timerSeconds),
  };
}

function freshPlayer(lives: number, spectator = false): PlayerState {
  return {
    score: 0,
    lives: spectator ? 0 : lives,
    streak: 0,
    bestStreak: 0,
    answer: null,
    answeredAt: null,
    lastResult: null,
    spectator,
  };
}

function setupState(hostId: string, playerIds: string[], settings = DEFAULT_SETTINGS): HigherLowerState {
  return {
    version: 2,
    phase: "setup",
    settings,
    items: [],
    round: 0,
    deadlineAt: null,
    revealAdvanceAt: null,
    players: Object.fromEntries(playerIds.map((id) => [id, freshPlayer(settings.lives)])),
    hostId,
  };
}

// State from before the overhaul (no `version`) falls back to a fresh setup
// instead of crashing the room.
function normalizeState(state: HigherLowerState, playerIds: string[]): HigherLowerState {
  const stored = (state ?? {}) as Partial<HigherLowerState>;
  const hostId = typeof stored.hostId === "string" ? stored.hostId : "";
  if (stored.version !== 2 || !isRecord(stored.players) || !Array.isArray(stored.items)) {
    return setupState(hostId, playerIds);
  }
  const phase: Phase =
    stored.phase === "guessing" || stored.phase === "reveal" || stored.phase === "finished"
      ? stored.phase
      : "setup";
  return {
    ...(stored as HigherLowerState),
    phase,
    settings: normalizeSettings(stored.settings),
    round: typeof stored.round === "number" ? stored.round : 0,
    deadlineAt: typeof stored.deadlineAt === "number" ? stored.deadlineAt : null,
    revealAdvanceAt: typeof stored.revealAdvanceAt === "number" ? stored.revealAdvanceAt : null,
    hostId,
  };
}

// Late joiners watch as spectators until the next game.
function ensurePlayers(state: HigherLowerState, playerIds: string[]): HigherLowerState {
  const missing = playerIds.filter((id) => !state.players[id]);
  if (missing.length === 0) return state;
  const players = { ...state.players };
  for (const id of missing) {
    players[id] = freshPlayer(state.settings.lives, state.phase !== "setup");
  }
  return { ...state, players };
}

function isAlive(player: PlayerState): boolean {
  return !player.spectator && player.lives > 0;
}

function startGame(state: HigherLowerState, playerIds: string[], now: number): HigherLowerState {
  const items = buildDeck(state.settings.category, state.settings.rounds + 1);
  if (items.length < 2) throw new Error("Not enough items for this category.");
  return {
    ...state,
    phase: "guessing",
    items,
    round: 1,
    deadlineAt: now + state.settings.timerSeconds * 1000,
    revealAdvanceAt: null,
    players: Object.fromEntries(playerIds.map((id) => [id, freshPlayer(state.settings.lives)])),
  };
}

function totalRounds(state: HigherLowerState): number {
  return Math.min(state.settings.rounds, state.items.length - 1);
}

function correctDirection(state: HigherLowerState): GuessDirection | null {
  const current = state.items[state.round - 1];
  const next = state.items[state.round];
  if (!current || !next) return null;
  return next.searches > current.searches ? "higher" : "lower";
}

function streakMultiplier(streak: number): number {
  if (streak >= 6) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

// Score every alive player: missing or wrong answers cost a life.
function resolveRound(state: HigherLowerState, now: number): HigherLowerState {
  const correct = correctDirection(state);
  const durationMs = state.settings.timerSeconds * 1000;
  const players: Record<string, PlayerState> = {};
  for (const [id, player] of Object.entries(state.players)) {
    if (!isAlive(player)) {
      players[id] = { ...player, lastResult: null };
      continue;
    }
    if (player.answer !== null && player.answer === correct) {
      const streak = player.streak + 1;
      const remaining = Math.max(0, (state.deadlineAt ?? now) - (player.answeredAt ?? now));
      const bonus = Math.round(SPEED_BONUS_MAX * Math.min(1, remaining / durationMs));
      const points = Math.round((BASE_POINTS + bonus) * streakMultiplier(streak));
      players[id] = {
        ...player,
        score: player.score + points,
        streak,
        bestStreak: Math.max(player.bestStreak, streak),
        lastResult: { correct: true, points },
      };
    } else {
      players[id] = {
        ...player,
        lives: player.lives - 1,
        streak: 0,
        lastResult: { correct: false, points: 0 },
      };
    }
  }
  return {
    ...state,
    phase: "reveal",
    players,
    deadlineAt: null,
    revealAdvanceAt: now + REVEAL_SECONDS * 1000,
  };
}

function isGameOver(state: HigherLowerState): boolean {
  return (
    state.round >= totalRounds(state) || !Object.values(state.players).some((player) => isAlive(player))
  );
}

function nextRound(state: HigherLowerState, now: number): HigherLowerState {
  if (isGameOver(state)) {
    return { ...state, phase: "finished", deadlineAt: null, revealAdvanceAt: null };
  }
  const players = Object.fromEntries(
    Object.entries(state.players).map(([id, player]) => [id, { ...player, answer: null, answeredAt: null }]),
  );
  return {
    ...state,
    phase: "guessing",
    round: state.round + 1,
    players,
    deadlineAt: now + state.settings.timerSeconds * 1000,
    revealAdvanceAt: null,
  };
}

function winnerPlayerIds(state: HigherLowerState): string[] {
  if (state.phase !== "finished") return [];
  const entries = Object.entries(state.players).filter(([, player]) => !player.spectator);
  if (entries.length === 0) return [];
  const rank = (player: PlayerState) => player.score * 100 + player.lives;
  const top = Math.max(...entries.map(([, player]) => rank(player)));
  return entries.filter(([, player]) => rank(player) === top).map(([id]) => id);
}

function card(item: HigherLowerItem | undefined, showValue: boolean): HigherLowerCard | null {
  if (!item) return null;
  return { label: item.label, category: item.category, searches: showValue ? item.searches : null };
}

export const higherLowerModule: GameModule<HigherLowerState, HigherLowerIntent, HigherLowerView> = {
  id: "higher-lower",
  displayName: "Veće ili Manje",
  tagline: "Šta se više gugla? Pogodi prije nego što ostaneš bez života.",
  minPlayers: 1,
  maxPlayers: 8,

  initialState: ({ playerIds, hostId }) => setupState(hostId, playerIds),

  reduce: (state, rawIntent, ctx) => {
    if (!isHigherLowerIntent(rawIntent)) throw new Error("Invalid Higher or Lower action.");
    const intent = rawIntent;
    const now = ctx.now.getTime();
    const current = ensurePlayers(normalizeState(state, ctx.playerIds), ctx.playerIds);
    const isHost = ctx.playerId === current.hostId;

    switch (intent.kind) {
      case "update-settings": {
        if (!isHost) throw new Error("Only the host can change settings.");
        if (current.phase !== "setup") throw new Error("Game already started.");
        const settings = normalizeSettings({ ...current.settings, ...intent.settings });
        return setupState(current.hostId, ctx.playerIds, settings);
      }

      case "start-game": {
        if (!isHost) throw new Error("Only the host can start.");
        if (current.phase !== "setup") throw new Error("Game already started.");
        return startGame(current, ctx.playerIds, now);
      }

      case "play-again": {
        if (!isHost) throw new Error("Only the host can restart.");
        if (current.phase !== "finished") throw new Error("Game is not finished yet.");
        return setupState(current.hostId, ctx.playerIds, current.settings);
      }

      case "guess": {
        if (current.phase !== "guessing") throw new Error("Game is not running.");
        const me = current.players[ctx.playerId];
        if (!me || !isAlive(me)) throw new Error("You are already out this round.");
        if (me.answer !== null) throw new Error("You already answered.");
        if (current.deadlineAt !== null && now >= current.deadlineAt) {
          return resolveRound(current, now);
        }
        const next: HigherLowerState = {
          ...current,
          players: { ...current.players, [ctx.playerId]: { ...me, answer: intent.direction, answeredAt: now } },
        };
        // Resolve early once everyone still in the room and alive has answered.
        const waiting = ctx.playerIds.some((id) => {
          const player = next.players[id];
          return player && isAlive(player) && player.answer === null;
        });
        return waiting ? next : resolveRound(next, now);
      }

      case "advance": {
        if (current.phase === "guessing") {
          if (current.deadlineAt !== null && now < current.deadlineAt) {
            throw new Error("The round is still running.");
          }
          return resolveRound(current, now);
        }
        if (current.phase === "reveal") {
          const passed = current.revealAdvanceAt !== null && now >= current.revealAdvanceAt;
          if (!isHost && !passed) throw new Error("Still showing the answer.");
          return nextRound(current, now);
        }
        throw new Error("Game is not running.");
      }
    }
  },

  redact: (state, playerId): HigherLowerView => {
    const current = normalizeState(state, []);
    const showAnswers = current.phase === "reveal" || current.phase === "finished";
    const me = current.players[playerId];

    return {
      phase: current.phase,
      settings: current.settings,
      round: current.round,
      current: card(current.items[current.round - 1], true),
      // The next value is the secret — only sent once the round is revealed.
      next: card(current.items[current.round], showAnswers),
      correctDirection: showAnswers ? correctDirection(current) : null,
      deadlineAt: current.deadlineAt,
      revealAdvanceAt: current.revealAdvanceAt,
      isLastRound: current.phase !== "setup" && isGameOver(current),
      myAnswer: me?.answer ?? null,
      players: Object.fromEntries(
        Object.entries(current.players).map(([id, player]) => [
          id,
          {
            score: player.score,
            lives: player.lives,
            streak: player.streak,
            bestStreak: player.bestStreak,
            answered: player.answer !== null,
            // Other players' picks stay hidden while the round is open.
            answer: showAnswers || id === playerId ? player.answer : null,
            lastResult: showAnswers ? player.lastResult : null,
            spectator: player.spectator,
          },
        ]),
      ),
      winnerPlayerIds: winnerPlayerIds(current),
      isHost: playerId === current.hostId,
    };
  },

  ClientComponent: HigherLowerClient,
};
