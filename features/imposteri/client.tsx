"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import { createClient } from "@/lib/supabase/client";
import { subscribeToRoom } from "@/lib/realtime/channels";
import type { ImposteriIntent, ImposteriView } from "./types";

const GAME_ID = "imposteri";
const TRANSITION_MS = 2400;

type PlayerSummary = {
  id: string;
  nickname: string;
  isHost: boolean;
};

type ImposteriSnapshot = {
  gameId: typeof GAME_ID;
  playerId: string;
  players: PlayerSummary[];
  view: ImposteriView;
  updatedAt: string;
};

type TransitionOverlay = {
  tone: "neutral" | "valid" | "invalid";
  kicker: string;
  title: string;
  note: string;
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

function voteTotal(voteCounts: Record<string, number>): number {
  return Object.values(voteCounts).reduce((total, count) => total + count, 0);
}

export function ImposteriClient({
  roomCode,
  playerId,
}: {
  roomCode: string;
  playerId: string;
}) {
  const router = useRouter();
  const { localizeError, t } = usePreferences();
  const [snapshot, setSnapshot] = useState<ImposteriSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [overlay, setOverlay] = useState<TransitionOverlay | null>(null);
  // Role card rests face-down each round; the player flips it themselves.
  // `revealedRound` records which round the flip applies to, so a new round
  // automatically reads as face-down without an effect (see below).
  const [revealedRound, setRevealedRound] = useState<number | null>(null);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPhaseKey = useRef<string | null>(null);
  const lastResultKey = useRef<string | null>(null);
  const resolveAttempted = useRef<string | null>(null);

  const fireOverlay = useCallback((next: TransitionOverlay, durationMs: number) => {
    setOverlay(next);
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => {
      setOverlay(null);
      overlayTimer.current = null;
    }, durationMs);
  }, []);

  const applySnapshot = useCallback(
    (data: ImposteriSnapshot) => {
      const phaseKey = `${data.gameId}-${data.view.round}-${data.view.phase}`;
      const previousPhaseKey = lastPhaseKey.current;
      lastPhaseKey.current = phaseKey;

      if (previousPhaseKey !== null && previousPhaseKey !== phaseKey) {
        if (data.view.phase === "clues") {
          fireOverlay(
            {
              tone: "neutral",
              kicker: t("imposteri.overlay.clues.kicker"),
              title: t("imposteri.overlay.clues.title"),
              note: t("imposteri.overlay.clues.note"),
            },
            TRANSITION_MS,
          );
        } else if (data.view.phase === "vote") {
          fireOverlay(
            {
              tone: "neutral",
              kicker: t("imposteri.overlay.vote.kicker"),
              title: t("imposteri.overlay.vote.title"),
              note: t("imposteri.overlay.vote.note"),
            },
            TRANSITION_MS,
          );
        }
      }

      if (data.view.phase === "result" && data.view.result) {
        const resultKey = `${data.gameId}-${data.view.round}-result`;
        if (lastResultKey.current !== resultKey) {
          lastResultKey.current = resultKey;
          const myTeamWon =
            (data.view.result.crewWon && data.view.myRole === "crew") ||
            (!data.view.result.crewWon && data.view.myRole === "impostor");
          fireOverlay(
            {
              tone: myTeamWon ? "valid" : "invalid",
              kicker: t(`imposteri.overlay.${myTeamWon ? "victory" : "defeat"}.kicker`),
              title: t(
                data.view.result.crewWon
                  ? "imposteri.overlay.crewCaught.title"
                  : "imposteri.overlay.impostorEscaped.title",
              ),
              note: t(
                myTeamWon ? "imposteri.overlay.victory.note" : "imposteri.overlay.defeat.note",
              ),
            },
            3600,
          );
        }
      } else if (data.view.phase !== "result") {
        lastResultKey.current = null;
      }

      setSnapshot(data);
      setError(null);
    },
    [fireOverlay, t],
  );

  const loadState = useCallback(async () => {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/state`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setError(localizeError(await readError(response)));
      return;
    }
    const data = (await response.json()) as ImposteriSnapshot;
    applySnapshot(data);
  }, [applySnapshot, localizeError, roomCode]);

  const sendIntent = useCallback(
    async (intent: ImposteriIntent) => {
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
        const data = (await response.json()) as ImposteriSnapshot;
        applySnapshot(data);
      } finally {
        setIsSending(false);
      }
    },
    [applySnapshot, localizeError, roomCode],
  );

  // Silent variant: ignore "still open" errors when racing the deadline.
  const sendIntentSilent = useCallback(
    async (intent: ImposteriIntent) => {
      try {
        await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: GAME_ID, intent }),
        });
      } catch {
        // ignored
      }
    },
    [roomCode],
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
    const timer = window.setTimeout(() => {
      void loadState();
    }, 0);
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
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadState, roomCode, router]);

  const view = snapshot?.view ?? null;

  useEffect(() => {
    return () => {
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
    };
  }, []);

  // Countdown for the vote phase.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (view?.phase !== "vote" || !view.voteDeadlineAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [view?.phase, view?.voteDeadlineAt]);

  const deadlineMs = view?.voteDeadlineAt ? new Date(view.voteDeadlineAt).getTime() : null;
  const secondsLeft =
    view?.phase === "vote" && deadlineMs !== null
      ? Math.max(0, Math.ceil((deadlineMs - now) / 1000))
      : null;
  const voteUrgent = secondsLeft !== null && secondsLeft <= 3;

  // When the deadline passes, every client tries (once) to ask the server to resolve.
  useEffect(() => {
    if (view?.phase !== "vote" || !view.voteDeadlineAt || deadlineMs === null) return;
    const remaining = deadlineMs - now;
    if (remaining > 0) return;
    const key = `${snapshot?.gameId}-${view.round}-${view.voteDeadlineAt}`;
    if (resolveAttempted.current === key) return;
    resolveAttempted.current = key;
    void sendIntentSilent({ kind: "resolve-vote" });
  }, [
    view?.phase,
    view?.voteDeadlineAt,
    view?.round,
    snapshot?.gameId,
    now,
    deadlineMs,
    sendIntentSilent,
  ]);

  const playersById = useMemo(() => {
    return new Map(snapshot?.players.map((player) => [player.id, player]) ?? []);
  }, [snapshot?.players]);

  // The card counts as revealed only while the recorded round matches the
  // live round, so a new round deals a fresh face-down card with no effect
  // and no face-up flash on the first frame.
  const currentRound = snapshot?.view.round;
  const roleRevealed = currentRound !== undefined && revealedRound === currentRound;

  if (!snapshot || !view) {
    return (
      <div className="plaza-panel rounded-lg p-5">
        <div className="plaza-skeleton h-5 w-32 rounded" />
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="plaza-skeleton h-11 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const phaseTitle = t(`imposteri.phase.${view.phase}`);
  const result = view.result;
  const startPlayer = view.startPlayerId ? playersById.get(view.startPlayerId) : null;
  const isImpostor = view.myRole === "impostor";
  const roleHidden = view.isInRound && !roleRevealed;

  return (
    <>
      <div className="plaza-panel rounded-lg">
        <div className="plaza-divider border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="plaza-label">{t("imposteri.round", view.round)}</p>
              <h2 className="truncate text-lg font-semibold">{phaseTitle}</h2>
            </div>
            <span
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                roleHidden
                  ? "plaza-status-review"
                  : isImpostor
                    ? "plaza-status-invalid"
                    : "plaza-status-valid"
              }`}
            >
              {roleHidden ? t("imposteri.roleHidden") : t(`imposteri.role.${view.myRole}`)}
            </span>
          </div>
        </div>

        {error && <div className="plaza-error border-b px-4 py-3 text-sm">{error}</div>}

        <div className="grid gap-5 p-4">
          <section className="grid gap-3">
            <p className="plaza-label">{t("imposteri.yourInfo")}</p>
            {/* Dramatic role reveal: the card is dealt face-down and the
                player flips it. Tapping again hides it from shoulder-surfers.
                The face-down side carries aria-hidden so the role never
                reaches the accessibility tree until flipped. */}
            <div className="plaza-role-stage">
              <button
                type="button"
                className="plaza-role-flip"
                aria-pressed={roleRevealed}
                aria-label={roleRevealed ? t("imposteri.tapToHide") : t("imposteri.tapToReveal")}
                onClick={() =>
                  setRevealedRound((current) =>
                    current === view.round ? null : view.round,
                  )
                }
              >
                <span
                  className="plaza-role-flip__side plaza-role-flip__front"
                  aria-hidden={roleRevealed}
                >
                  <span className="plaza-role-flip__monogram" aria-hidden="true">
                    P
                  </span>
                  <span className="plaza-role-flip__hint">{t("imposteri.tapToReveal")}</span>
                </span>
                <span
                  className="plaza-role-flip__side plaza-role-flip__back"
                  aria-hidden={!roleRevealed}
                >
                  <span
                    className={`plaza-word-card grid rounded-2xl px-5 py-7 text-center ${
                      isImpostor ? "plaza-word-card--impostor" : "plaza-word-card--crew"
                    }`}
                  >
                    <span className="plaza-word-card__label">{t("imposteri.category")}</span>
                    <span className="plaza-word-card__category">{view.category}</span>
                    {!isImpostor && view.secretWord && (
                      <>
                        <span className="plaza-word-card__divider" />
                        <span className="plaza-word-card__label">
                          {t("imposteri.secretWord")}
                        </span>
                        <span className="plaza-word-card__word">{view.secretWord}</span>
                      </>
                    )}
                    {isImpostor && (
                      <>
                        <span className="plaza-word-card__divider" />
                        <span className="plaza-word-card__label">
                          {t("imposteri.impostorHintLabel")}
                        </span>
                        <span className="plaza-word-card__hint">
                          {view.impostorHint ?? t("imposteri.secretHidden")}
                        </span>
                      </>
                    )}
                  </span>
                </span>
              </button>
            </div>
            <p className="plaza-muted text-sm">
              {!view.isInRound
                ? t("imposteri.notInRound")
                : roleHidden
                  ? t("imposteri.tapToReveal")
                  : isImpostor
                    ? t("imposteri.impostorHint")
                    : t("imposteri.crewHint")}
            </p>
          </section>

          {view.phase === "reveal" && (
            <HostAction
              canAct={view.isHost}
              disabled={isSending}
              button={t("imposteri.startClues")}
              waiting={t("imposteri.waitingHost")}
              onClick={() => void sendIntent({ kind: "advance-phase" })}
            />
          )}

          {view.phase === "clues" && (
            <section className="grid gap-3">
              <p className="plaza-muted text-sm">{t("imposteri.cluesOfflineHint")}</p>
              {startPlayer && (
                <div className="plaza-card rounded-lg px-4 py-3">
                  <p className="plaza-label mb-1">{t("imposteri.firstPlayer")}</p>
                  <p className="text-base font-semibold">
                    {startPlayer.nickname}
                    {startPlayer.id === playerId && (
                      <span className="plaza-muted-2 ml-2 text-xs">{t("gradovi.you")}</span>
                    )}
                  </p>
                </div>
              )}
              <HostAction
                canAct={view.isHost}
                disabled={isSending}
                button={t("imposteri.startVote")}
                waiting={t("imposteri.waitingHostVote")}
                onClick={() => void sendIntent({ kind: "advance-phase" })}
              />
            </section>
          )}

          {view.phase === "vote" && (
            <section className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="plaza-label">{t("imposteri.vote")}</h3>
                <span className="plaza-muted text-xs">
                  {t("imposteri.submitted", view.votedPlayerIds.length, snapshot.players.length)}
                </span>
              </div>
              <p className="plaza-muted text-sm">{t("imposteri.voteHint")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {snapshot.players.map((player) => {
                  const selected = view.myVote === player.id;
                  const isMe = player.id === playerId;
                  const hasVoted = view.votedPlayerIds.includes(player.id);
                  return (
                    <button
                      key={player.id}
                      type="button"
                      disabled={isSending || !view.isInRound || isMe}
                      onClick={() => void sendIntent({ kind: "cast-vote", targetId: player.id })}
                      className={`flex h-11 items-center justify-between rounded-lg border px-3 text-left text-sm font-medium transition-colors disabled:opacity-45 ${
                        selected
                          ? "border-[var(--plaza-accent)] bg-[var(--plaza-accent-soft)]"
                          : "plaza-card hover:border-[var(--plaza-line-strong)]"
                      }`}
                    >
                      <span className="truncate">
                        {player.nickname}
                        {isMe && (
                          <span className="plaza-muted-2 ml-1 text-xs">{t("gradovi.you")}</span>
                        )}
                      </span>
                      {hasVoted && !isMe && (
                        <span className="plaza-muted-2 ml-2 text-[0.7rem] uppercase tracking-wide">
                          {t("imposteri.voted")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {view.phase === "result" && result && (
            <section className="grid gap-4">
              <div
                className={`rounded-lg p-4 ${
                  result.crewWon ? "plaza-status-valid" : "plaza-status-invalid"
                }`}
              >
                <h3 className="font-semibold">
                  {result.crewWon ? t("imposteri.crewWon") : t("imposteri.impostorsWon")}
                </h3>
                <p className="mt-1 text-sm">
                  {result.ejectedPlayerId
                    ? t(
                        "imposteri.ejected",
                        playersById.get(result.ejectedPlayerId)?.nickname ?? "-",
                      )
                    : result.timedOut
                      ? t("imposteri.voteTimedOut")
                      : t("imposteri.noEjection")}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoBlock label={t("imposteri.secretWord")} value={result.secretWord} />
                <InfoBlock
                  label={t("imposteri.impostors")}
                  value={result.impostorIds
                    .map((id) => playersById.get(id)?.nickname ?? "-")
                    .join(", ")}
                />
              </div>

              <section>
                <h3 className="plaza-label mb-2">{t("imposteri.votes")}</h3>
                <ul className="grid gap-2">
                  {snapshot.players.map((player) => (
                    <li
                      key={player.id}
                      className="plaza-subtle flex h-10 items-center justify-between rounded-lg px-3 text-sm"
                    >
                      <span className="min-w-0 truncate">{player.nickname}</span>
                      <span className="plaza-muted font-mono text-xs">
                        {result.voteCounts[player.id] ?? 0}/{voteTotal(result.voteCounts)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!view.isHost || isSending}
                  onClick={() => void sendIntent({ kind: "start-round" })}
                  className="plaza-button h-11 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {view.isHost ? t("imposteri.nextRound") : t("imposteri.waitingHost")}
                </button>
                <button
                  type="button"
                  disabled={!view.isHost || isSending}
                  onClick={() => void finishSession()}
                  className="plaza-button-secondary h-11 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {view.isHost ? t("gradovi.backToLaunchpad") : t("imposteri.waitingHost")}
                </button>
              </div>
            </section>
          )}
        </div>

        <div className="plaza-divider plaza-muted-2 border-t px-4 py-3 text-xs">
          {snapshot.players.map((player) => player.nickname).join(", ")}
        </div>
      </div>

      {view.phase === "vote" && secondsLeft !== null && (
        <div
          className={`plaza-vote-timer ${voteUrgent ? "plaza-vote-timer--urgent" : ""}`}
          aria-live="polite"
        >
          <span className="plaza-vote-timer__label">{t("imposteri.timeLeft")}</span>
          <span className="plaza-vote-timer__value">{secondsLeft}s</span>
        </div>
      )}

      {overlay && (
        <div
          className="plaza-screen-overlay"
          data-tone={
            overlay.tone === "valid" ? "final" : overlay.tone === "invalid" ? "defeat" : undefined
          }
        >
          <div className="plaza-screen-content">
            <p className="plaza-screen-kicker">{overlay.kicker}</p>
            <p className="plaza-screen-title">{overlay.title}</p>
            <p className="plaza-screen-note">{overlay.note}</p>
          </div>
        </div>
      )}
    </>
  );
}

function HostAction({
  canAct,
  disabled,
  button,
  waiting,
  onClick,
}: {
  canAct: boolean;
  disabled: boolean;
  button: string;
  waiting: string;
  onClick: () => void;
}) {
  if (!canAct) return <p className="plaza-muted text-sm">{waiting}</p>;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="plaza-button h-11 rounded-lg text-sm font-medium disabled:opacity-50"
    >
      {button}
    </button>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="plaza-card rounded-lg p-3">
      <p className="plaza-label mb-1">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

