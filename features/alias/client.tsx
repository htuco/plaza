"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import { RoomBody, RoomBottomBar, RoomContent } from "@/components/room-shell";
import {
  PhaseHeader,
  RoomError,
  RoomLoading,
  WaitingNote,
} from "@/components/room-game-ui";
import { CheckIcon, SkipIcon } from "@/components/room-icons";
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

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
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
      <RoomBody>
        <RoomLoading rows={4} />
      </RoomBody>
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
  const turnDurationMs = view.settings.turnDurationSeconds * 1000;
  const turnUrgent = secondsLeft !== null && secondsLeft <= 10;

  // Team scores as a chip row — the bottom bar's second line during a turn.
  const teamChips = (
    <div className="flex gap-2">
      {view.teams.map((team) => (
        <span
          key={team.id}
          className={`${teamColorClass(team.id)} flex flex-1 items-center justify-between gap-2 rounded-xl px-3 py-2.5 ${
            team.id === view.activeTeamId
              ? "plaza-team-pill"
              : "plaza-subtle border border-[var(--plaza-line)]"
          }`}
        >
          <span className="truncate text-[0.78rem] font-semibold">{team.name}</span>
          <span className="rm-numeric text-[0.875rem] font-extrabold">{team.score}</span>
        </span>
      ))}
    </div>
  );

  const scoreboard = (
    <section aria-label={t("alias.scoreboard")} className="grid gap-2.5">
      <h3 className="rm-eyebrow">{t("alias.scoreboard")}</h3>
      <div className="grid gap-2">
        {sortedTeams.map((team) => (
          <div
            key={team.id}
            className={`plaza-team-card rounded-xl px-3.5 py-2.5 ${teamColorClass(team.id)} ${
              team.id === view.activeTeamId ? "plaza-team-card--active" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-[0.84rem] font-semibold">
                <span className="plaza-team-dot" aria-hidden="true" />
                <span className="truncate">{team.name}</span>
                {team.id === view.myTeamId && (
                  <span className="plaza-muted-2 shrink-0 text-[0.69rem] font-normal">
                    {t("gradovi.you")}
                  </span>
                )}
              </span>
              <span className="rm-numeric text-[1.0625rem] font-extrabold">{team.score}</span>
            </div>
            <p className="plaza-muted mt-0.5 truncate text-[0.69rem]">
              {team.playerIds.map((id) => playersById.get(id)?.nickname ?? "—").join(", ") ||
                t("alias.noPlayers")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );

  const phaseEyebrow =
    view.phase === "setup"
      ? t("alias.phase.setup")
      : `${t("alias.roundOf", view.round, view.settings.totalRounds)}${
          activeTeam ? ` · ${activeTeam.name}` : ""
        }`;

  // -------------------------------------------------------- 10 · explaining
  if (view.phase === "explaining") {
    return (
      <>
        <PhaseHeader
          eyebrow={phaseEyebrow}
          title={
            view.isExplainer
              ? t("alias.youExplain")
              : iAmOnActiveTeam
                ? t("alias.teamExplains")
                : t("alias.otherTeamExplains")
          }
          right={
            <span
              className={`rm-timer ${turnUrgent ? "rm-timer--danger" : "rm-timer--accent"}`}
              role="timer"
              aria-live="polite"
            >
              {remainingMs !== null ? formatClock(remainingMs) : "–"}
            </span>
          }
        />

        {/* Mirrored from the server's turn deadline, never counted locally. */}
        <div className="rm-content px-5 pt-3 sm:px-6">
          <span className="rm-track rm-track--thin">
            <span
              className="rm-track__fill rm-track__fill--danger"
              style={{
                width: `${
                  remainingMs !== null && turnDurationMs > 0
                    ? Math.min(100, (remainingMs / turnDurationMs) * 100)
                    : 0
                }%`,
              }}
            />
          </span>
        </div>

        <RoomBody center className="p-5 sm:p-6">
          <RoomContent className="gap-5">
          {error && <RoomError message={error} />}

          {/* Only the active explainer's view carries `currentWord`. */}
          {view.isExplainer ? (
            <div className="plaza-word-card grid justify-items-center gap-2.5 rounded-3xl px-6 py-9 text-center">
              <span className="rm-eyebrow">{t("alias.explainLabel")}</span>
              <span className="rm-display text-[2.5rem] font-extrabold">
                {view.currentWord ?? "…"}
              </span>
              <span className="plaza-muted-2 text-[0.78rem]">{t("alias.wordRule")}</span>
            </div>
          ) : (
            <div className="plaza-word-card grid justify-items-center gap-2.5 rounded-3xl px-6 py-9 text-center">
              <span className="rm-eyebrow">
                {activeTeam?.name} · {explainer?.nickname ?? "—"}
              </span>
              <span className="rm-display text-[1.75rem] font-extrabold">
                {iAmOnActiveTeam ? t("alias.guessOutLoud") : t("alias.watchAndWait")}
              </span>
            </div>
          )}

          {view.isExplainer && (
            /* "Correct" is deliberately twice as wide as "skip". */
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isSending || (remainingMs !== null && remainingMs <= 0)}
                onClick={() => void sendIntent({ kind: "mark-word", result: "skipped" })}
                className="plaza-action-skip flex h-18 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] disabled:opacity-50"
              >
                <span className="flex items-center gap-1.5 text-[0.94rem] font-extrabold">
                  <SkipIcon /> {t("alias.skip")}
                </span>
                <span className="text-[0.69rem] font-medium opacity-80">
                  {view.settings.skipPenalty ? t("alias.penalty") : t("alias.noPenalty")}
                </span>
              </button>
              <button
                type="button"
                disabled={isSending || (remainingMs !== null && remainingMs <= 0)}
                onClick={() => void sendIntent({ kind: "mark-word", result: "correct" })}
                className="plaza-action-correct flex h-18 flex-[2] items-center justify-center gap-2 rounded-[1.25rem] text-[1.0625rem] font-extrabold disabled:opacity-50"
              >
                <CheckIcon size={18} /> {t("alias.correct")}
              </button>
            </div>
          )}

          {(view.isExplainer || view.isHost) && (
            <button
              type="button"
              disabled={isSending}
              onClick={() => void sendIntent({ kind: "end-turn" })}
              className="plaza-ghost-button mx-auto h-10 rounded-lg px-3 text-[0.81rem] font-medium disabled:opacity-50"
            >
              {t("alias.endTurnEarly")}
            </button>
          )}
          </RoomContent>
        </RoomBody>

        <RoomBottomBar>
          <div className="plaza-muted flex items-center justify-between gap-2 text-[0.75rem]">
            <span>{t("alias.turnTally", view.turnCorrect, view.turnSkipped)}</span>
            <span className="shrink-0">{t("alias.wordsLeft", view.wordsRemaining)}</span>
          </div>
          {teamChips}
        </RoomBottomBar>
      </>
    );
  }

  // ------------------------------------------------------------ every other phase
  return (
    <>
      <PhaseHeader
        eyebrow={phaseEyebrow}
        title={
          view.phase === "setup"
            ? t("alias.setupTitle")
            : view.phase === "turnIntro"
              ? t("alias.turnIntroTitle")
              : view.phase === "turnReview"
                ? t("alias.turnReviewTitle")
                : t("alias.finishedTitle")
        }
        right={
          activeTeam && view.phase !== "setup" && view.phase !== "finished" ? (
            <span
              className={`plaza-team-pill ${teamColorClass(activeTeam.id)} rounded-full px-3 py-1.5 text-[0.72rem] font-semibold`}
            >
              <span className="plaza-team-dot" aria-hidden="true" /> {activeTeam.name}
            </span>
          ) : undefined
        }
      />

      <RoomBody className="p-5 sm:p-6">
        <RoomContent className="gap-5">
        {error && <RoomError message={error} />}

        {/* ----------------------------------------------------------- setup */}
        {view.phase === "setup" &&
          (view.isHost ? (
            <>
              <section className="grid gap-3">
                <h3 className="rm-eyebrow">{t("alias.settings")}</h3>
                <div className="grid grid-cols-2 gap-3">
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
                <label className="plaza-card flex min-h-13 cursor-pointer items-center justify-between gap-3 rounded-[0.875rem] px-3.5 py-2.5">
                  <span className="text-[0.84rem] font-medium">{t("alias.skipPenalty")}</span>
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
                  <h3 className="rm-eyebrow">{t("alias.teams")}</h3>
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
                <div className="grid gap-2">
                  {snapshot.players.map((player) => {
                    const playerTeam = view.teams.find((team) =>
                      team.playerIds.includes(player.id),
                    );
                    return (
                      <div
                        key={player.id}
                        className="plaza-card flex flex-wrap items-center justify-between gap-2 rounded-[0.875rem] px-3 py-2.5"
                      >
                        <span className="min-w-0 truncate text-[0.84rem] font-medium">
                          {player.nickname}
                          {player.id === playerId && (
                            <span className="plaza-muted-2 ml-1.5 text-[0.69rem] font-normal">
                              {t("gradovi.you")}
                            </span>
                          )}
                        </span>
                        <div
                          className="flex gap-1"
                          role="group"
                          aria-label={t("alias.assignTeam", player.nickname)}
                        >
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
                                className={`plaza-team-toggle ${teamColorClass(team.id)} h-9 rounded-lg px-2.5 text-[0.69rem] font-semibold ${
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
                  className="plaza-button-secondary h-12 rounded-[0.875rem] text-[0.84rem] font-semibold disabled:opacity-50"
                >
                  {t("alias.autoBalance")}
                </button>
              </section>
            </>
          ) : (
            <>
              <p className="plaza-muted text-[0.84rem]">{t("alias.waitingForSetup")}</p>
              {scoreboard}
            </>
          ))}

        {/* ------------------------------------------------------- turn intro */}
        {view.phase === "turnIntro" && activeTeam && (
          <>
            <div
              className={`plaza-turn-intro rounded-3xl px-5 py-7 text-center ${teamColorClass(activeTeam.id)}`}
            >
              <p className="rm-eyebrow">{t("alias.upNext")}</p>
              <p className="rm-display mt-1 text-[1.75rem] font-extrabold">{activeTeam.name}</p>
              <div className="plaza-word-card__divider mx-auto my-3" />
              <p className="rm-eyebrow">{t("alias.explains")}</p>
              <p className="mt-1 text-[1.1875rem] font-semibold">
                {explainer?.nickname ?? "—"}
                {explainer?.id === playerId && (
                  <span className="plaza-muted ml-2 text-[0.84rem] font-normal">
                    {t("alias.thatsYou")}
                  </span>
                )}
              </p>
            </div>
            <p className="plaza-muted text-center text-[0.84rem] leading-relaxed">
              {view.activeExplainerId === playerId
                ? t("alias.explainerInstructions", view.settings.turnDurationSeconds)
                : iAmOnActiveTeam
                  ? t("alias.guesserInstructions")
                  : t("alias.spectatorInstructions", activeTeam.name)}
            </p>
            {scoreboard}
          </>
        )}

        {/* ------------------------------------------------------ turn review */}
        {view.phase === "turnReview" && (
          <>
            <p className="plaza-muted text-[0.84rem] leading-relaxed">
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
                        className={`flex h-13 w-full items-center justify-between rounded-[0.875rem] border px-3.5 text-[0.84rem] font-medium transition-colors ${
                          correct
                            ? "border-[color-mix(in_srgb,var(--plaza-success)_45%,var(--plaza-line))] plaza-status-valid"
                            : "border-[var(--plaza-line)] plaza-status-review"
                        } ${editable ? "" : "cursor-default"}`}
                      >
                        <span className="min-w-0 truncate">{entry.word}</span>
                        <span className="rm-numeric shrink-0 text-[0.72rem] font-extrabold">
                          {correct ? "+1" : view.settings.skipPenalty ? "-1" : "0"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="plaza-subtle rounded-[0.875rem] px-4 py-6 text-center text-[0.84rem]">
                {t("alias.noWordsPlayed")}
              </p>
            )}
            <div className="plaza-card flex items-center justify-between rounded-[0.875rem] px-4 py-3 text-[0.84rem] font-semibold">
              <span>{activeTeam?.name}</span>
              <span className="rm-numeric text-[1.0625rem]">
                {view.turnCorrect - (view.settings.skipPenalty ? view.turnSkipped : 0) >= 0
                  ? "+"
                  : ""}
                {view.turnCorrect - (view.settings.skipPenalty ? view.turnSkipped : 0)}
              </span>
            </div>
            {scoreboard}
          </>
        )}

        {/* --------------------------------------------------------- finished */}
        {view.phase === "finished" && (
          <>
            <div className="plaza-winner-card rounded-3xl px-5 py-8 text-center">
              <p className="rm-eyebrow">{t("alias.winner")}</p>
              <p className="rm-display mt-2 text-[1.75rem] font-extrabold">
                {view.winnerTeamIds.length > 1
                  ? t("alias.tie")
                  : view.teams.find((team) => team.id === view.winnerTeamIds[0])?.name ?? "—"}
              </p>
              {view.winnerTeamIds.length === 1 && (
                <p className="plaza-muted mt-1 text-[0.84rem]">
                  {view.teams
                    .find((team) => team.id === view.winnerTeamIds[0])
                    ?.playerIds.map((id) => playersById.get(id)?.nickname ?? "—")
                    .join(", ")}
                </p>
              )}
            </div>
            {scoreboard}
          </>
        )}

        {view.phase === "turnIntro" && myTeam === null && (
          <p className="plaza-muted-2 text-center text-[0.72rem]">{t("alias.spectatorNote")}</p>
        )}
        </RoomContent>
      </RoomBody>

      <RoomBottomBar
        note={
          view.phase === "setup" && view.isHost
            ? t("alias.teamRequirement", MIN_TEAM_SIZE)
            : view.phase === "finished" && !view.isHost
              ? t("gradovi.hostCloseNote")
              : undefined
        }
      >
        {view.phase === "setup" &&
          (view.isHost ? (
            <button
              type="button"
              disabled={isSending}
              onClick={() => void sendIntent({ kind: "start-game" })}
              className="plaza-button rm-cta disabled:opacity-50"
            >
              {t("alias.startGame")}
            </button>
          ) : (
            <WaitingNote>{t("alias.waitingForSetup")}</WaitingNote>
          ))}

        {view.phase === "turnIntro" &&
          (view.activeExplainerId === playerId || view.isHost ? (
            <button
              type="button"
              disabled={isSending}
              onClick={() => void sendIntent({ kind: "start-turn" })}
              className="plaza-button rm-cta disabled:opacity-50"
            >
              {t("alias.startTurn")}
            </button>
          ) : (
            <WaitingNote>
              {t("alias.waitingForExplainer", explainer?.nickname ?? "—")}
            </WaitingNote>
          ))}

        {view.phase === "turnReview" &&
          (view.activeExplainerId === playerId || view.isHost ? (
            <button
              type="button"
              disabled={isSending}
              onClick={() => void sendIntent({ kind: "confirm-turn" })}
              className="plaza-button rm-cta disabled:opacity-50"
            >
              {t("alias.confirmTurn")}
            </button>
          ) : (
            <WaitingNote>{t("alias.waitingConfirm")}</WaitingNote>
          ))}

        {view.phase === "finished" &&
          (view.isHost ? (
            <>
              <button
                type="button"
                disabled={isSending}
                onClick={() => void sendIntent({ kind: "play-again" })}
                className="plaza-button rm-cta disabled:opacity-50"
              >
                {t("alias.playAgain")}
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={() => void finishSession()}
                className="plaza-ghost-button mx-auto rounded-lg px-3 py-1.5 text-[0.78rem] font-medium disabled:opacity-50"
              >
                {t("gradovi.backToLaunchpad")}
              </button>
            </>
          ) : (
            <WaitingNote>{t("gradovi.waitingForHost")}</WaitingNote>
          ))}
      </RoomBottomBar>
    </>
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
