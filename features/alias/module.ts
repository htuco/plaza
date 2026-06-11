import type { GameModule } from "@/features/registry";
import {
  ALIAS_TEAM_PRESETS,
  DEFAULT_ALIAS_SETTINGS,
  MAX_ALIAS_ROUNDS,
  MAX_ALIAS_TEAMS,
  MAX_TURN_DURATION_SECONDS,
  MIN_ALIAS_ROUNDS,
  MIN_TEAM_SIZE,
  MIN_TURN_DURATION_SECONDS,
} from "./types";
import type {
  AliasIntent,
  AliasSettings,
  AliasState,
  AliasTeam,
  AliasView,
  Phase,
  TurnWord,
  WordResult,
} from "./types";
import { ALL_ALIAS_WORDS } from "./words";
import { AliasClient } from "./client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isWordResult(value: unknown): value is WordResult {
  return value === "correct" || value === "skipped";
}

function isAliasIntent(value: unknown): value is AliasIntent {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "update-settings":
      return !value.settings || typeof value.settings === "object";
    case "assign-player":
      return (
        typeof value.playerId === "string" &&
        (typeof value.teamId === "string" || value.teamId === null)
      );
    case "set-team-count":
      return typeof value.count === "number";
    case "mark-word":
      return isWordResult(value.result);
    case "toggle-word":
      return typeof value.index === "number";
    case "auto-balance":
    case "start-game":
    case "start-turn":
    case "end-turn":
    case "confirm-turn":
    case "play-again":
      return true;
    default:
      return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function normalizePhase(value: unknown): Phase {
  return value === "turnIntro" ||
    value === "explaining" ||
    value === "turnReview" ||
    value === "finished"
    ? value
    : "setup";
}

function normalizeSettings(value: unknown): AliasSettings {
  const raw = isRecord(value) ? value : {};
  const duration =
    typeof raw.turnDurationSeconds === "number" && Number.isFinite(raw.turnDurationSeconds)
      ? Math.floor(raw.turnDurationSeconds)
      : DEFAULT_ALIAS_SETTINGS.turnDurationSeconds;
  const rounds =
    typeof raw.totalRounds === "number" && Number.isFinite(raw.totalRounds)
      ? Math.floor(raw.totalRounds)
      : DEFAULT_ALIAS_SETTINGS.totalRounds;
  return {
    turnDurationSeconds: clamp(duration, MIN_TURN_DURATION_SECONDS, MAX_TURN_DURATION_SECONDS),
    totalRounds: clamp(rounds, MIN_ALIAS_ROUNDS, MAX_ALIAS_ROUNDS),
    skipPenalty: raw.skipPenalty === true,
  };
}

function normalizeTeams(value: unknown): AliasTeam[] {
  const raw = Array.isArray(value) ? value : [];
  const teams: AliasTeam[] = [];
  for (const entry of raw.slice(0, MAX_ALIAS_TEAMS)) {
    if (!isRecord(entry)) continue;
    const preset = ALIAS_TEAM_PRESETS[teams.length];
    teams.push({
      id: typeof entry.id === "string" ? entry.id : preset.id,
      name: typeof entry.name === "string" && entry.name ? entry.name : preset.name,
      playerIds: Array.isArray(entry.playerIds)
        ? entry.playerIds.filter((id): id is string => typeof id === "string")
        : [],
      score:
        typeof entry.score === "number" && Number.isFinite(entry.score)
          ? Math.round(entry.score)
          : 0,
    });
  }
  while (teams.length < 2) {
    const preset = ALIAS_TEAM_PRESETS[teams.length];
    teams.push({ id: preset.id, name: preset.name, playerIds: [], score: 0 });
  }
  return teams;
}

function normalizeTurnWords(value: unknown): TurnWord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is TurnWord =>
      isRecord(entry) && typeof entry.word === "string" && isWordResult(entry.result),
  );
}

function normalizeState(state: AliasState): AliasState {
  const stored = (state ?? {}) as Partial<AliasState>;
  const teams = normalizeTeams(stored.teams);
  const deck =
    Array.isArray(stored.deck) && stored.deck.length > 0
      ? stored.deck.filter((word): word is string => typeof word === "string")
      : shuffle(ALL_ALIAS_WORDS);
  const cursorRaw = isRecord(stored.explainerCursor) ? stored.explainerCursor : {};

  return {
    phase: normalizePhase(stored.phase),
    settings: normalizeSettings(stored.settings),
    teams,
    round: typeof stored.round === "number" && stored.round > 0 ? Math.floor(stored.round) : 1,
    turnTeamIndex:
      typeof stored.turnTeamIndex === "number"
        ? clamp(Math.floor(stored.turnTeamIndex), 0, teams.length - 1)
        : 0,
    explainerCursor: Object.fromEntries(
      teams.map((team) => {
        const value = cursorRaw[team.id];
        return [team.id, typeof value === "number" && value >= 0 ? Math.floor(value) : 0];
      }),
    ),
    activeExplainerId:
      typeof stored.activeExplainerId === "string" ? stored.activeExplainerId : null,
    deck,
    deckIndex:
      typeof stored.deckIndex === "number"
        ? clamp(Math.floor(stored.deckIndex), 0, deck.length)
        : 0,
    turnWords: normalizeTurnWords(stored.turnWords),
    turnDeadlineAt: typeof stored.turnDeadlineAt === "number" ? stored.turnDeadlineAt : null,
    hostId: typeof stored.hostId === "string" ? stored.hostId : "",
  };
}

// Drop players who left the room from every team; keep order stable.
function sanitizeTeams(teams: AliasTeam[], playerIds: string[]): AliasTeam[] {
  const present = new Set(playerIds);
  return teams.map((team) => ({
    ...team,
    playerIds: team.playerIds.filter((id) => present.has(id)),
  }));
}

function activeTeam(state: AliasState): AliasTeam | null {
  return state.teams[state.turnTeamIndex] ?? null;
}

function pickExplainer(team: AliasTeam, cursor: number): string | null {
  if (team.playerIds.length === 0) return null;
  return team.playerIds[cursor % team.playerIds.length];
}

// Top up the deck when it runs dry mid-session (repeats only after the full pool is spent).
function ensureWordAvailable(state: AliasState): AliasState {
  if (state.deckIndex < state.deck.length) return state;
  return { ...state, deck: [...state.deck, ...shuffle(ALL_ALIAS_WORDS)] };
}

function beginTurnIntro(state: AliasState): AliasState {
  const team = activeTeam(state);
  const cursor = team ? state.explainerCursor[team.id] ?? 0 : 0;
  return {
    ...state,
    phase: "turnIntro",
    activeExplainerId: team ? pickExplainer(team, cursor) : null,
    turnWords: [],
    turnDeadlineAt: null,
  };
}

function finishTurn(state: AliasState): AliasState {
  const team = activeTeam(state);
  if (!team) return { ...state, phase: "finished", turnDeadlineAt: null };

  const correct = state.turnWords.filter((w) => w.result === "correct").length;
  const skipped = state.turnWords.filter((w) => w.result === "skipped").length;
  const delta = correct - (state.settings.skipPenalty ? skipped : 0);

  const teams = state.teams.map((t) =>
    t.id === team.id ? { ...t, score: t.score + delta } : t,
  );
  const explainerCursor = {
    ...state.explainerCursor,
    [team.id]: (state.explainerCursor[team.id] ?? 0) + 1,
  };

  const isLastTeamOfRound = state.turnTeamIndex >= state.teams.length - 1;
  const nextRound = isLastTeamOfRound ? state.round + 1 : state.round;
  if (isLastTeamOfRound && nextRound > state.settings.totalRounds) {
    return {
      ...state,
      teams,
      explainerCursor,
      phase: "finished",
      activeExplainerId: null,
      turnDeadlineAt: null,
    };
  }

  return beginTurnIntro({
    ...state,
    teams,
    explainerCursor,
    round: nextRound,
    turnTeamIndex: isLastTeamOfRound ? 0 : state.turnTeamIndex + 1,
  });
}

function canDriveTurn(state: AliasState, playerId: string): boolean {
  return playerId === state.activeExplainerId || playerId === state.hostId;
}

function winnerTeamIds(state: AliasState): string[] {
  if (state.phase !== "finished" || state.teams.length === 0) return [];
  const top = Math.max(...state.teams.map((team) => team.score));
  return state.teams.filter((team) => team.score === top).map((team) => team.id);
}

export const aliasModule: GameModule<AliasState, AliasIntent, AliasView> = {
  id: "alias",
  displayName: "Alias",
  tagline: "Explain the word — just never say it.",
  minPlayers: 4,
  maxPlayers: 16,

  initialState: ({ playerIds, hostId }) => {
    // Pre-seed two teams with players split round-robin; host can reshuffle in setup.
    const teams: AliasTeam[] = [0, 1].map((index) => ({
      id: ALIAS_TEAM_PRESETS[index].id,
      name: ALIAS_TEAM_PRESETS[index].name,
      playerIds: playerIds.filter((_, playerIndex) => playerIndex % 2 === index),
      score: 0,
    }));
    return {
      phase: "setup",
      settings: { ...DEFAULT_ALIAS_SETTINGS },
      teams,
      round: 1,
      turnTeamIndex: 0,
      explainerCursor: Object.fromEntries(teams.map((team) => [team.id, 0])),
      activeExplainerId: null,
      deck: shuffle(ALL_ALIAS_WORDS),
      deckIndex: 0,
      turnWords: [],
      turnDeadlineAt: null,
      hostId,
    };
  },

  reduce: (state, rawIntent, ctx) => {
    if (!isAliasIntent(rawIntent)) throw new Error("Invalid Alias action.");
    const intent = rawIntent;
    const normalized = normalizeState(state);
    const current: AliasState = {
      ...normalized,
      teams: sanitizeTeams(normalized.teams, ctx.playerIds),
    };
    const isHost = ctx.playerId === current.hostId;
    const deadlinePassed =
      current.turnDeadlineAt !== null && ctx.now.getTime() >= current.turnDeadlineAt;

    if (intent.kind === "update-settings") {
      if (!isHost) throw new Error("Only the host can change settings.");
      if (current.phase !== "setup") throw new Error("Settings are locked after the game starts.");
      return {
        ...current,
        settings: normalizeSettings({ ...current.settings, ...intent.settings }),
      };
    }

    if (intent.kind === "set-team-count") {
      if (!isHost) throw new Error("Only the host can change teams.");
      if (current.phase !== "setup") throw new Error("Teams are locked after the game starts.");
      const count = clamp(Math.floor(intent.count), 2, MAX_ALIAS_TEAMS);
      const teams = current.teams.slice(0, count);
      while (teams.length < count) {
        const preset = ALIAS_TEAM_PRESETS[teams.length];
        teams.push({ id: preset.id, name: preset.name, playerIds: [], score: 0 });
      }
      return {
        ...current,
        teams,
        explainerCursor: Object.fromEntries(
          teams.map((team) => [team.id, current.explainerCursor[team.id] ?? 0]),
        ),
      };
    }

    if (intent.kind === "assign-player") {
      if (!isHost) throw new Error("Only the host can change teams.");
      if (current.phase !== "setup") throw new Error("Teams are locked after the game starts.");
      if (!ctx.playerIds.includes(intent.playerId)) throw new Error("Unknown player.");
      if (intent.teamId !== null && !current.teams.some((team) => team.id === intent.teamId)) {
        throw new Error("Unknown team.");
      }
      return {
        ...current,
        teams: current.teams.map((team) => {
          const without = team.playerIds.filter((id) => id !== intent.playerId);
          return team.id === intent.teamId
            ? { ...team, playerIds: [...without, intent.playerId] }
            : { ...team, playerIds: without };
        }),
      };
    }

    if (intent.kind === "auto-balance") {
      if (!isHost) throw new Error("Only the host can change teams.");
      if (current.phase !== "setup") throw new Error("Teams are locked after the game starts.");
      const pool = shuffle(ctx.playerIds);
      return {
        ...current,
        teams: current.teams.map((team, teamIndex) => ({
          ...team,
          playerIds: pool.filter((_, playerIndex) => playerIndex % current.teams.length === teamIndex),
        })),
      };
    }

    if (intent.kind === "start-game") {
      if (!isHost) throw new Error("Only the host can start.");
      if (current.phase !== "setup") throw new Error("Game already started.");
      const playable = current.teams.filter((team) => team.playerIds.length >= MIN_TEAM_SIZE);
      if (playable.length < 2 || playable.length !== current.teams.length) {
        throw new Error(`Each team needs at least ${MIN_TEAM_SIZE} players.`);
      }
      return beginTurnIntro({
        ...current,
        round: 1,
        turnTeamIndex: 0,
        explainerCursor: Object.fromEntries(current.teams.map((team) => [team.id, 0])),
      });
    }

    if (intent.kind === "start-turn") {
      if (current.phase !== "turnIntro") throw new Error("No turn to start right now.");
      // Re-pick in case the explainer left while we waited on the intro screen.
      const ready = beginTurnIntro(current);
      if (!ready.activeExplainerId) throw new Error("Active team has no players left.");
      if (ctx.playerId !== ready.activeExplainerId && !isHost) {
        throw new Error("Only the explainer can start the turn.");
      }
      const withWord = ensureWordAvailable(ready);
      return {
        ...withWord,
        phase: "explaining",
        turnWords: [],
        turnDeadlineAt: ctx.now.getTime() + current.settings.turnDurationSeconds * 1000,
      };
    }

    if (intent.kind === "mark-word") {
      if (current.phase !== "explaining") throw new Error("Turn is not running.");
      if (ctx.playerId !== current.activeExplainerId) {
        throw new Error("Only the explainer can mark words.");
      }
      if (deadlinePassed) {
        return { ...current, phase: "turnReview", turnDeadlineAt: null };
      }
      const word = current.deck[current.deckIndex];
      if (!word) return ensureWordAvailable(current);
      return ensureWordAvailable({
        ...current,
        deckIndex: current.deckIndex + 1,
        turnWords: [...current.turnWords, { word, result: intent.result }],
      });
    }

    if (intent.kind === "end-turn") {
      if (current.phase !== "explaining") throw new Error("Turn is not running.");
      if (!canDriveTurn(current, ctx.playerId) && !deadlinePassed) {
        throw new Error("The turn is still running.");
      }
      return { ...current, phase: "turnReview", turnDeadlineAt: null };
    }

    if (intent.kind === "toggle-word") {
      if (current.phase !== "turnReview") throw new Error("No turn to review.");
      if (!canDriveTurn(current, ctx.playerId)) {
        throw new Error("Only the explainer or host can adjust results.");
      }
      const index = Math.floor(intent.index);
      if (index < 0 || index >= current.turnWords.length) throw new Error("Unknown word.");
      return {
        ...current,
        turnWords: current.turnWords.map((entry, entryIndex) =>
          entryIndex === index
            ? { ...entry, result: entry.result === "correct" ? "skipped" : "correct" }
            : entry,
        ),
      };
    }

    if (intent.kind === "confirm-turn") {
      if (current.phase !== "turnReview") throw new Error("No turn to review.");
      if (!canDriveTurn(current, ctx.playerId)) {
        throw new Error("Only the explainer or host can confirm the turn.");
      }
      return finishTurn(current);
    }

    if (intent.kind === "play-again") {
      if (!isHost) throw new Error("Only the host can restart.");
      if (current.phase !== "finished") throw new Error("Game is not finished yet.");
      return {
        ...current,
        phase: "setup",
        teams: current.teams.map((team) => ({ ...team, score: 0 })),
        round: 1,
        turnTeamIndex: 0,
        explainerCursor: Object.fromEntries(current.teams.map((team) => [team.id, 0])),
        activeExplainerId: null,
        deck: shuffle(ALL_ALIAS_WORDS),
        deckIndex: 0,
        turnWords: [],
        turnDeadlineAt: null,
      };
    }

    throw new Error("Invalid Alias action.");
  },

  redact: (state, playerId): AliasView => {
    const current = normalizeState(state);
    const team = activeTeam(current);
    const isExplainer =
      current.activeExplainerId === playerId && current.phase === "explaining";
    const showTurnWords =
      current.phase === "turnReview" ||
      (current.phase === "explaining" && current.activeExplainerId === playerId);

    return {
      phase: current.phase,
      settings: current.settings,
      teams: current.teams.map((t) => ({
        id: t.id,
        name: t.name,
        playerIds: t.playerIds,
        score: t.score,
      })),
      round: current.round,
      turnTeamIndex: current.turnTeamIndex,
      activeTeamId: team?.id ?? null,
      activeExplainerId: current.activeExplainerId,
      myTeamId: current.teams.find((t) => t.playerIds.includes(playerId))?.id ?? null,
      isHost: playerId === current.hostId,
      isExplainer,
      currentWord: isExplainer ? current.deck[current.deckIndex] ?? null : null,
      turnDeadlineAt: current.turnDeadlineAt,
      turnCorrect: current.turnWords.filter((w) => w.result === "correct").length,
      turnSkipped: current.turnWords.filter((w) => w.result === "skipped").length,
      turnWords: showTurnWords ? current.turnWords : null,
      wordsRemaining: Math.max(0, current.deck.length - current.deckIndex),
      winnerTeamIds: winnerTeamIds(current),
    };
  },

  ClientComponent: AliasClient,
};
