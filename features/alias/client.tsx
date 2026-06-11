"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import { createClient } from "@/lib/supabase/client";
import { subscribeToRoom } from "@/lib/realtime/channels";
import {
  MAX_ALIAS_ROUNDS,
  MAX_ALIAS_TEAMS,
  MAX_TURN_DURATION_SECONDS,
  MIN_ALIAS_ROUNDS,
  MIN_TEAM_SIZE,
  MIN_TURN_DURATION_SECONDS,
} from "./types";
import type { AliasIntent, AliasView } from "./types";

const GAME_ID = "alias";

type PlayerSummary = {
  id: string;
  nickname: string;
  isHost: boolean;
};

type AliasSnapshot = {
  gameId: typeof GAME_ID;
  playerId: string;
  players: PlayerSummary[];
  view: AliasView;
  updatedAt: string;
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

function teamColorClass(teamId: string): string {
  const index = Number.parseInt(teamId.replace("team-", ""), 10);
  return `plaza-team-${Number.isFinite(index) ? Math.abs(index) % 4 : 0}`;
}

export function AliasClient({ roomCode, playerId }: { roomCode: string; playerId: string }) {
  const router = useRouter();
  const { localizeError, t } = usePreferences();
  const [snapshot, setSnapshot] = useState<AliasSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const endTurnAttempted = useRef<number | null>(null);

  const loadState = useCallback(async () => {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/state`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setError(localizeError(await readError(response)));
      return;
    }
    setSnapshot((await response.json()) as AliasSnapshot);
    setError(null);
  }, [localizeError, roomCode]);

  const sendIntent = useCallback(
    async (intent: AliasIntent) => {
      setIsSending(true);
      try {
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: GAME_ID, intent }),
        });
        if (!response.ok) {
          setError(localizeError(await readError(response)));
          return;
        }
        setSnapshot((await response.json()) as AliasSnapshot);
        setError(null);
      } finally {
        setIsSending(false);
      }
    },
    [localizeError, roomCode],
  );

  async function finishSession() {
    setIsSending(true);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/finish`, {
        method: "POST",
      });
      if (!response.ok) {
        setError(localizeError(await readError(response)));
        return;
      }
      router.replace("/");
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadState(), 0);
    return () => window.clearTimeout(timer);
  }, [loadState]);

  useEffect(() => {
    const supabase = createClient();
    const channel = subscribeToRoom(supabase, roomCode, (event) => {
      if (event.type === "state") {
        const payload = event.payload as { status?: unknown; target?: unknown };
        if (payload.status === "finished") {
          router.replace(typeof payload.target === "string" ? payload.target : "/");
        }
        return;
      }
      if (event.type === "game-event") {
        const payload = event.payload as { gameId?: unknown };
        if (payload.gameId === GAME_ID) void loadState();
      }
      if (event.type === "lobby-update") void loadState();
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadState, roomCode, router]);

  const view = snapshot?.view ?? null;

  useEffect(() => {
    if (view?.phase !== "explaining" || view.turnDeadlineAt === null) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [view?.phase, view?.turnDeadlineAt]);

  const remainingMs =
    view?.phase === "explaining" && view.turnDeadlineAt !== null
      ? Math.max(0, view.turnDeadlineAt - now)
      : null;

  // When time runs out, the explainer (and host as fallback) asks the server to close the turn.
  useEffect(() => {
    if (
      !view ||
      view.phase !== "explaining" ||
      view.turnDeadlineAt === null ||
      remainingMs === null ||
      remainingMs > 0
    ) {
      return;
    }
    if (!view.isExplainer && !view.isHost) return;
    if (endTurnAttempted.current === view.turnDeadlineAt) return;
    endTurnAttempted.current = view.turnDeadlineAt;
    void sendIntent({ kind: "end-turn" });
  }, [remainingMs, sendIntent, view]);

  const playersById = useMemo(
    () => new Map(snapshot?.players.map((player) => [player.id, player]) ?? []),
    [snapshot?.players],
  );

  if (!snapshot || !view) {
    return (
      <div className="plaza-panel rounded-xl p-5">
        <div className="plaza-skeleton h-5 w-32 rounded" />
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="plaza-skeleton h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const activeTeam = view.teams.find((team) => team.id === view.activeTeamId) ?? null;
  const explainer = view.activeExplainerId
    ? playersById.get(view.activeExplainerId) ?? null
    : null;
  const myTeam = view.teams.find((team) => team.id === view.myTeamId) ?? null;
  const iAmOnActiveTeam = view.myTeamId !== null && view.myTeamId === view.activeTeamId;
  const secondsLeft = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;
  const sortedTeams = [...view.teams].sort((a, b) => b.score - a.score);

  const scoreboard = (
    <section aria-label={t("alias.scoreboard")} className="grid gap-2">
      <h3 className="plaza-label">{t("alias.scoreboard")}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {sortedTeams.map((team) => (
          <div
            key={team.id}
            className={`plaza-team-card rounded-xl px-3.5 py-2.5 ${teamColorClass(team.id)} ${
              team.id === view.activeTeamId ? "plaza-team-card--active" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="plaza-team-dot" aria-hidden="true" />
                {team.name}
                {team.id === view.myTeamId && (
                  <span className="plaza-muted-2 text-xs font-normal">{t("gradovi.you")}</span>
                )}
              </span>
              <span className="font-mono text-lg font-bold tabular-nums">{team.score}</span>
            </div>
            <p className="plaza-muted mt-0.5 truncate text-xs">
              {team.playerIds.map((id) => playersById.get(id)?.nickname ?? "—").join(", ") ||
                t("alias.noPlayers")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="grid gap-4">
      <div className="plaza-panel rounded-xl">
        <div className="plaza-divider border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="plaza-label">
                {view.phase === "setup"
                  ? t("alias.phase.setup")
                  : t("alias.roundOf", view.round, view.settings.totalRounds)}
              </p>
              <h2 className="truncate text-lg font-semibold">
                {view.phase === "setup" && t("alias.setupTitle")}
                {view.phase === "turnIntro" && t("alias.turnIntroTitle")}
                {view.phase === "explaining" && t("alias.explainingTitle")}
                {view.phase === "turnReview" && t("alias.turnReviewTitle")}
                {view.phase === "finished" && t("alias.finishedTitle")}
              </h2>
            </div>
            {activeTeam && view.phase !== "setup" && view.phase !== "finished" && (
              <span
                className={`plaza-team-pill ${teamColorClass(activeTeam.id)} rounded-full px-3 py-1.5 text-xs font-semibold`}
              >
                <span className="plaza-team-dot" aria-hidden="true" /> {activeTeam.name}
              </span>
            )}
          </div>
        </div>

        {error && <div className="plaza-error border-b px-4 py-3 text-sm">{error}</div>}

        {/* ------------------------------------------------ setup */}
        {view.phase === "setup" && (
          <div className="grid gap-6 p-4">
            {view.isHost ? (
              <>
                <section className="grid gap-3">
                  <h3 className="plaza-label">{t("alias.settings")}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Stepper
                      label={t("alias.turnDuration")}
                      value={view.settings.turnDurationSeconds}
                      unit={t("gradovi.settings.seconds")}
                      step={15}
                      min={MIN_TURN_DURATION_SECONDS}
                      max={MAX_TURN_DURATION_SECONDS}
                      disabled={isSending}
                      onChange={(value) =>
                        void sendIntent({
                          kind: "update-settings",
                          settings: { turnDurationSeconds: value },
                        })
                      }
                    />
                    <Stepper
                      label={t("alias.rounds")}
                      value={view.settings.totalRounds}
                      step={1}
                      min={MIN_ALIAS_ROUNDS}
                      max={MAX_ALIAS_ROUNDS}
                      disabled={isSending}
                      onChange={(value) =>
                        void sendIntent({ kind: "update-settings", settings: { totalRounds: value } })
                      }
                    />
                  </div>
                  <label className="plaza-card flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl px-3.5 py-2.5">
                    <span className="text-sm font-medium">{t("alias.skipPenalty")}</span>
                    <input
                      type="checkbox"
                      checked={view.settings.skipPenalty}
                      disabled={isSending}
                      onChange={(event) =>
                        void sendIntent({
                          kind: "update-settings",
                          settings: { skipPenalty: event.target.checked },
                        })
                      }
                      className="h-5 w-5 accent-[var(--plaza-accent)]"
                    />
                  </label>
                </section>

                <section className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="plaza-label">{t("alias.teams")}</h3>
                    <div className="flex items-center gap-2">
                      <Stepper
                        compact
                        label={t("alias.teamCount")}
                        value={view.teams.length}
                        step={1}
                        min={2}
                        max={MAX_ALIAS_TEAMS}
                        disabled={isSending}
                        onChange={(value) => void sendIntent({ kind: "set-team-count", count: value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {snapshot.players.map((player) => {
                      const playerTeam = view.teams.find((team) =>
                        team.playerIds.includes(player.id),
                      );
                      return (
                        <div
                          key={player.id}
                          className="plaza-card flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5"
                        >
                          <span className="min-w-0 truncate text-sm font-medium">
                            {player.nickname}
                            {player.id === playerId && (
                              <span className="plaza-muted-2 ml-1.5 text-xs font-normal">
                                {t("gradovi.you")}
                              </span>
                            )}
                          </span>
                          <div className="flex gap-1" role="group" aria-label={t("alias.assignTeam", player.nickname)}>
                            {view.teams.map((team) => {
                              const selected = playerTeam?.id === team.id;
                              return (
                                <button
                                  key={team.id}
                                  type="button"
                                  aria-pressed={selected}
                                  disabled={isSending}
                                  onClick={() =>
                                    void sendIntent({
                                      kind: "assign-player",
                                      playerId: player.id,
                                      teamId: selected ? null : team.id,
                                    })
                                  }
                                  className={`plaza-team-toggle ${teamColorClass(team.id)} h-9 rounded-lg px-2.5 text-xs font-semibold ${
                                    selected ? "plaza-team-toggle--selected" : ""
                                  }`}
                                >
                                  {team.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => void sendIntent({ kind: "auto-balance" })}
                    className="plaza-button-secondary h-11 rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    {t("alias.autoBalance")}
                  </button>
                </section>

                <div className="grid gap-2">
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => void sendIntent({ kind: "start-game" })}
                    className="plaza-button h-12 rounded-xl text-base font-semibold disabled:opacity-50"
                  >
                    {t("alias.startGame")}
                  </button>
                  <p className="plaza-muted text-center text-xs">
                    {t("alias.teamRequirement", MIN_TEAM_SIZE)}
                  </p>
                </div>
              </>
            ) : (
              <div className="grid gap-4">
                <p className="plaza-muted text-sm">{t("alias.waitingForSetup")}</p>
                {scoreboard}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------ turn intro */}
        {view.phase === "turnIntro" && activeTeam && (
          <div className="grid gap-5 p-4">
            <div className={`plaza-turn-intro rounded-2xl px-5 py-7 text-center ${teamColorClass(activeTeam.id)}`}>
              <p className="plaza-label">{t("alias.upNext")}</p>
              <p className="mt-1 text-3xl font-bold">{activeTeam.name}</p>
              <div className="plaza-word-card__divider mx-auto my-3" />
              <p className="plaza-label">{t("alias.explains")}</p>
              <p className="mt-1 text-xl font-semibold">
                {explainer?.nickname ?? "—"}
                {explainer?.id === playerId && (
                  <span className="plaza-muted ml-2 text-sm font-normal">{t("alias.thatsYou")}</span>
                )}
              </p>
            </div>
            <p className="plaza-muted text-center text-sm">
              {view.activeExplainerId === playerId
                ? t("alias.explainerInstructions", view.settings.turnDurationSeconds)
                : iAmOnActiveTeam
                  ? t("alias.guesserInstructions")
                  : t("alias.spectatorInstructions", activeTeam.name)}
            </p>
            {(view.activeExplainerId === playerId || view.isHost) ? (
              <button
                type="button"
                disabled={isSending}
                onClick={() => void sendIntent({ kind: "start-turn" })}
                className="plaza-button h-13 rounded-xl text-base font-semibold disabled:opacity-50"
              >
                {t("alias.startTurn")}
              </button>
            ) : (
              <p className="plaza-muted text-center text-xs">
                {t("alias.waitingForExplainer", explainer?.nickname ?? "—")}
              </p>
            )}
            {scoreboard}
          </div>
        )}

        {/* ------------------------------------------------ explaining */}
        {view.phase === "explaining" && (
          <div className="grid gap-4 p-4">
            <div
              className={`plaza-alias-timer ${secondsLeft !== null && secondsLeft <= 10 ? "plaza-alias-timer--urgent" : ""}`}
              role="timer"
              aria-live="polite"
            >
              <span className="font-mono text-4xl font-bold tabular-nums">
                {secondsLeft ?? "–"}
              </span>
              <span className="plaza-label">{t("alias.seconds")}</span>
            </div>

            {view.isExplainer ? (
              <>
                <div className="plaza-word-card plaza-word-card--crew rounded-2xl px-5 py-8 text-center">
                  <p className="plaza-word-card__label">{t("alias.dontSayIt")}</p>
                  <p className="plaza-word-card__word">{view.currentWord ?? "…"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isSending || (remainingMs !== null && remainingMs <= 0)}
                    onClick={() => void sendIntent({ kind: "mark-word", result: "skipped" })}
                    className="plaza-action-skip h-16 rounded-2xl text-lg font-bold disabled:opacity-50"
                  >
                    {t("alias.skip")}
                    {view.settings.skipPenalty && <span className="block text-xs font-medium">-1</span>}
                  </button>
                  <button
                    type="button"
                    disabled={isSending || (remainingMs !== null && remainingMs <= 0)}
                    onClick={() => void sendIntent({ kind: "mark-word", result: "correct" })}
                    className="plaza-action-correct h-16 rounded-2xl text-lg font-bold disabled:opacity-50"
                  >
                    {t("alias.correct")}
                    <span className="block text-xs font-medium">+1</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="plaza-word-card rounded-2xl px-5 py-8 text-center">
                <p className="plaza-word-card__label">
                  {activeTeam?.name} · {explainer?.nickname ?? "—"}
                </p>
                <p className="plaza-word-card__hidden">
                  {iAmOnActiveTeam ? t("alias.guessOutLoud") : t("alias.watchAndWait")}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-4 text-sm" aria-live="polite">
              <span className="plaza-status-valid rounded-full px-3 py-1 font-semibold">
                ✓ {view.turnCorrect}
              </span>
              <span className="plaza-status-review rounded-full px-3 py-1 font-semibold">
                ↷ {view.turnSkipped}
              </span>
            </div>

            {(view.isExplainer || view.isHost) && (
              <button
                type="button"
                disabled={isSending}
                onClick={() => void sendIntent({ kind: "end-turn" })}
                className="plaza-ghost-button h-10 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {t("alias.endTurnEarly")}
              </button>
            )}
          </div>
        )}

        {/* ------------------------------------------------ turn review */}
        {view.phase === "turnReview" && (
          <div className="grid gap-4 p-4">
            <p className="plaza-muted text-sm">
              {view.activeExplainerId === playerId || view.isHost
                ? t("alias.reviewInstructionsEditor")
                : t("alias.reviewInstructions")}
            </p>
            {view.turnWords && view.turnWords.length > 0 ? (
              <ul className="grid gap-2">
                {view.turnWords.map((entry, index) => {
                  const editable = view.activeExplainerId === playerId || view.isHost;
                  const correct = entry.result === "correct";
                  return (
                    <li key={`${entry.word}-${index}`}>
                      <button
                        type="button"
                        disabled={!editable || isSending}
                        aria-pressed={correct}
                        onClick={() => void sendIntent({ kind: "toggle-word", index })}
                        className={`flex h-12 w-full items-center justify-between rounded-xl border px-3.5 text-sm font-medium transition-colors ${
                          correct
                            ? "border-[color-mix(in_srgb,var(--plaza-success)_45%,var(--plaza-line))] plaza-status-valid"
                            : "border-[var(--plaza-line)] plaza-status-review"
                        } ${editable ? "" : "cursor-default"}`}
                      >
                        <span className="min-w-0 truncate">{entry.word}</span>
                        <span className="shrink-0 font-mono text-xs font-bold">
                          {correct ? `+1` : view.settings.skipPenalty ? "-1" : "0"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="plaza-subtle rounded-xl px-4 py-6 text-center text-sm">
                {t("alias.noWordsPlayed")}
              </p>
            )}
            <div className="plaza-card flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold">
              <span>{activeTeam?.name}</span>
              <span className="font-mono text-lg">
                {view.turnCorrect - (view.settings.skipPenalty ? view.turnSkipped : 0) >= 0 ? "+" : ""}
                {view.turnCorrect - (view.settings.skipPenalty ? view.turnSkipped : 0)}
              </span>
            </div>
            {(view.activeExplainerId === playerId || view.isHost) ? (
              <button
                type="button"
                disabled={isSending}
                onClick={() => void sendIntent({ kind: "confirm-turn" })}
                className="plaza-button h-12 rounded-xl text-base font-semibold disabled:opacity-50"
              >
                {t("alias.confirmTurn")}
              </button>
            ) : (
              <p className="plaza-muted text-center text-xs">{t("alias.waitingConfirm")}</p>
            )}
            {scoreboard}
          </div>
        )}

        {/* ------------------------------------------------ finished */}
        {view.phase === "finished" && (
          <div className="grid gap-5 p-4">
            <div className="plaza-winner-card rounded-2xl px-5 py-8 text-center">
              <p className="plaza-label">{t("alias.winner")}</p>
              <p className="mt-2 text-3xl font-bold">
                {view.winnerTeamIds.length > 1
                  ? t("alias.tie")
                  : view.teams.find((team) => team.id === view.winnerTeamIds[0])?.name ?? "—"}
              </p>
              {view.winnerTeamIds.length === 1 && (
                <p className="plaza-muted mt-1 text-sm">
                  {view.teams
                    .find((team) => team.id === view.winnerTeamIds[0])
                    ?.playerIds.map((id) => playersById.get(id)?.nickname ?? "—")
                    .join(", ")}
                </p>
              )}
            </div>
            {scoreboard}
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!view.isHost || isSending}
                onClick={() => void sendIntent({ kind: "play-again" })}
                className="plaza-button h-12 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {view.isHost ? t("alias.playAgain") : t("gradovi.waitingForHost")}
              </button>
              <button
                type="button"
                disabled={!view.isHost || isSending}
                onClick={() => void finishSession()}
                className="plaza-button-secondary h-12 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {view.isHost ? t("gradovi.backToLaunchpad") : t("gradovi.waitingForHost")}
              </button>
            </div>
            {!view.isHost && (
              <p className="plaza-muted text-center text-xs">{t("gradovi.hostCloseNote")}</p>
            )}
          </div>
        )}
      </div>

      {(view.phase === "turnIntro" || view.phase === "explaining") && myTeam === null && (
        <p className="plaza-muted text-center text-xs">{t("alias.spectatorNote")}</p>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  unit,
  step,
  min,
  max,
  disabled,
  compact = false,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  step: number;
  min: number;
  max: number;
  disabled: boolean;
  compact?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className={compact ? "flex items-center gap-2" : "grid gap-1.5"}>
      <span className="plaza-label">{label}</span>
      <div className="plaza-input flex h-11 items-center justify-between rounded-xl">
        <button
          type="button"
          aria-label={`${label} −${step}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          className="plaza-stepper-button h-full w-11 rounded-l-xl text-lg font-semibold disabled:opacity-30"
        >
          −
        </button>
        <span className="px-1 font-mono text-sm font-semibold tabular-nums">
          {value}
          {unit ? <span className="plaza-muted ml-1 text-xs font-normal">{unit}</span> : null}
        </span>
        <button
          type="button"
          aria-label={`${label} +${step}`}
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          className="plaza-stepper-button h-full w-11 rounded-r-xl text-lg font-semibold disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
