"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import { RoomBody, RoomBottomBar, RoomContent } from "@/components/room-shell";
import {
  PhaseHeader,
  PhaseSegments,
  RoomError,
  RoomLoading,
  WaitingNote,
} from "@/components/room-game-ui";
import { StarIcon } from "@/components/room-icons";
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

// The four phases of a round, in order — drives the progress segments.
const PHASE_ORDER = ["reveal", "clues", "vote", "result"] as const;

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
      <RoomBody>
        <RoomLoading rows={4} />
      </RoomBody>
    );
  }

  const result = view.result;
  const startPlayer = view.startPlayerId ? playersById.get(view.startPlayerId) : null;
  const isImpostor = view.myRole === "impostor";
  const roleHidden = view.isInRound && !roleRevealed;
  const phaseIndex = PHASE_ORDER.indexOf(view.phase);
  const totalVotes = result ? voteTotal(result.voteCounts) : 0;

  // The role card: dealt face-down, flipped by its owner, hideable again. The
  // face-down side is aria-hidden so the role never reaches the accessibility
  // tree until it has actually been revealed.
  const roleCard = (
    <button
      type="button"
      aria-pressed={roleRevealed}
      aria-label={roleRevealed ? t("imposteri.tapToHide") : t("imposteri.tapToReveal")}
      onClick={() =>
        setRevealedRound((current) => (current === view.round ? null : view.round))
      }
      className={`rm-role-card ${
        roleRevealed
          ? `rm-role-card--revealed ${isImpostor ? "rm-role-card--impostor" : ""}`
          : ""
      }`}
    >
      {roleHidden || !view.isInRound ? (
        <>
          <span className="rm-role-card__monogram" aria-hidden="true">
            P
          </span>
          <span className="text-[0.94rem] font-semibold">
            {view.isInRound ? t("imposteri.tapToReveal") : t("imposteri.notInRound")}
          </span>
          <span className="plaza-muted max-w-58 text-[0.78rem] leading-relaxed">
            {t("imposteri.tapHideNote")}
          </span>
        </>
      ) : (
        <>
          <span
            className={`rm-chip mb-3.5 ${isImpostor ? "rm-chip--danger" : "rm-chip--valid"} uppercase tracking-[0.08em]`}
          >
            {t(`imposteri.role.${view.myRole}`)}
          </span>
          <span className="rm-role-card__label">{t("imposteri.category")}</span>
          <span className="text-xl font-semibold">{view.category}</span>
          <span className="rm-role-card__divider" aria-hidden="true" />
          <span className="rm-role-card__label">
            {isImpostor ? t("imposteri.impostorHintLabel") : t("imposteri.secretWord")}
          </span>
          {/* The impostor never receives the secret word — only the hint. */}
          <span
            className={
              isImpostor
                ? "plaza-muted max-w-58 text-[0.94rem] leading-relaxed"
                : "rm-display text-[2.5rem] font-extrabold"
            }
          >
            {isImpostor
              ? view.impostorHint ?? t("imposteri.secretHidden")
              : view.secretWord ?? t("imposteri.secretHidden")}
          </span>
          <span className="plaza-muted-2 mt-[1.125rem] text-xs">{t("imposteri.tapToHide")}</span>
        </>
      )}
    </button>
  );

  return (
    <>
      {/* --------------------------------------------------- 07 · round result */}
      {view.phase === "result" && result ? (
        <>
          <div className={`rm-verdict ${result.crewWon ? "rm-verdict--crew" : "rm-verdict--impostor"}`}>
            <span
              className="rm-verdict__eyebrow"
              style={{
                color: result.crewWon ? "var(--plaza-success)" : "var(--plaza-danger)",
              }}
            >
              {result.crewWon ? t("imposteri.crewWon") : t("imposteri.impostorsWon")}
            </span>
            <span className="rm-display text-[1.75rem] font-extrabold">
              {result.crewWon ? t("imposteri.result.caught") : t("imposteri.result.escaped")}
            </span>
            <span className="plaza-muted text-[0.81rem]">
              {result.ejectedPlayerId
                ? t(
                    "imposteri.ejectedWithVotes",
                    playersById.get(result.ejectedPlayerId)?.nickname ?? "—",
                    result.voteCounts[result.ejectedPlayerId] ?? 0,
                    totalVotes,
                  )
                : result.timedOut
                  ? t("imposteri.voteTimedOut")
                  : t("imposteri.noEjection")}
            </span>
          </div>

          <RoomBody className="p-5 sm:p-6">
            <RoomContent className="gap-3.5">
            {error && <RoomError message={error} />}

            <div className="flex gap-2.5">
              <span className="rm-stat">
                <span className="rm-eyebrow">{t("imposteri.secretWord")}</span>
                <span className="text-[1.0625rem] font-semibold">{result.secretWord}</span>
              </span>
              <span className="rm-stat">
                <span className="rm-eyebrow">{t("imposteri.impostors")}</span>
                <span className="truncate text-[1.0625rem] font-semibold text-[var(--plaza-danger)]">
                  {result.impostorIds
                    .map((id) => playersById.get(id)?.nickname ?? "—")
                    .join(", ")}
                </span>
              </span>
            </div>

            <section className="plaza-panel grid gap-3 rounded-[1.125rem] p-4">
              <h3 className="rm-eyebrow">{t("imposteri.votes")}</h3>
              <ul className="grid gap-2.5">
                {snapshot.players.map((player) => {
                  const count = result.voteCounts[player.id] ?? 0;
                  const share = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                  const ejected = player.id === result.ejectedPlayerId;
                  return (
                    <li key={player.id} className="flex items-center gap-2.5">
                      <span
                        className={`w-[4.375rem] shrink-0 truncate text-[0.81rem] font-medium ${
                          count === 0 ? "plaza-muted" : ""
                        }`}
                      >
                        {player.nickname}
                      </span>
                      <span className="rm-track flex-1">
                        <span
                          className={`rm-track__fill ${ejected ? "rm-track__fill--danger" : ""}`}
                          style={{ width: `${share}%` }}
                        />
                      </span>
                      <span
                        className={`rm-numeric w-6 text-right text-xs ${
                          count === 0 ? "plaza-muted-2" : "plaza-muted"
                        }`}
                      >
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="plaza-muted-2 text-[0.72rem]">
                {t("imposteri.sessionNote", view.round)}
              </p>
            </section>
            </RoomContent>
          </RoomBody>

          <RoomBottomBar>
            {view.isHost ? (
              <>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => void sendIntent({ kind: "start-round" })}
                  className="plaza-button rm-cta disabled:opacity-50"
                >
                  {t("imposteri.nextRound")}
                </button>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => void finishSession()}
                  className="plaza-ghost-button mx-auto rounded-lg px-3 py-1.5 text-[0.78rem] font-medium disabled:opacity-50"
                >
                  {t("imposteri.backToLobby")}
                </button>
              </>
            ) : (
              <WaitingNote>{t("imposteri.waitingHost")}</WaitingNote>
            )}
          </RoomBottomBar>
        </>
      ) : (
        <>
          <PhaseHeader
            eyebrow={t("imposteri.round", view.round)}
            title={t(`imposteri.phase.${view.phase}`)}
            right={
              <PhaseSegments
                total={PHASE_ORDER.length}
                activeIndex={phaseIndex}
                label={t(`imposteri.phase.${view.phase}`)}
              />
            }
          />

          {/* ------------------------------------------------ 06 · voting */}
          {view.phase === "vote" ? (
            <>
              <div className="rm-content grid gap-3.5 px-5 pt-3.5 sm:px-6">
                <div className="plaza-panel flex items-center gap-3.5 rounded-[1.125rem] p-4">
                  <span
                    className={`rm-timer-ring ${voteUrgent ? "rm-timer-ring--urgent" : ""}`}
                    role="timer"
                    aria-live="polite"
                    aria-label={`${t("imposteri.timeLeft")}: ${secondsLeft ?? "—"}`}
                  >
                    {secondsLeft ?? "—"}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-base font-semibold">{t("imposteri.voteNow")}</span>
                    <span className="plaza-muted text-[0.78rem] leading-snug">
                      {t("imposteri.voteHint")}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rm-eyebrow">
                    {t("imposteri.submitted", view.votedPlayerIds.length, snapshot.players.length)}
                  </span>
                  <span className="plaza-muted-2 text-[0.69rem]">
                    {t("imposteri.voteSecret")}
                  </span>
                </div>
              </div>

              <RoomBody className="px-5 pt-3.5 sm:px-6">
                <RoomContent className="gap-2.5 pb-5">
                {error && <RoomError message={error} />}
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
                      className={`rm-row ${selected ? "rm-row--picked" : ""} ${
                        isMe ? "rm-row--self" : ""
                      }`}
                    >
                      <span className="rm-avatar" aria-hidden="true">
                        {player.isHost ? <StarIcon size={12} /> : player.nickname.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.9rem] font-medium">
                        {player.nickname}
                        {isMe && (
                          <span className="plaza-muted ml-1.5 text-[0.69rem] font-normal">
                            {t("gradovi.you")}
                          </span>
                        )}
                      </span>
                      {selected ? (
                        <span className="rm-chip shrink-0 bg-[var(--plaza-accent)] text-[var(--plaza-accent-ink)]">
                          {t("imposteri.yourVote")}
                        </span>
                      ) : (
                        hasVoted &&
                        !isMe && (
                          <span className="plaza-muted-2 shrink-0 text-[0.66rem] uppercase tracking-[0.1em]">
                            {t("imposteri.voted")}
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
                <p className="plaza-subtle mt-2 rounded-[0.875rem] border border-[var(--plaza-line)] px-3.5 py-3 text-[0.75rem] leading-relaxed text-[var(--plaza-muted)]">
                  {t("imposteri.noMajorityNote")}
                </p>
                </RoomContent>
              </RoomBody>
            </>
          ) : (
            /* --------------------------------- 05 · role card, and clues */
            <>
              <RoomBody center className="p-5 sm:p-6">
                <RoomContent className="items-center gap-[1.125rem]">
                {error && <RoomError message={error} />}
                {roleCard}
                <p className="plaza-muted text-center text-[0.81rem] leading-relaxed">
                  {isImpostor ? t("imposteri.impostorHint") : t("imposteri.crewHint")}
                </p>
                {view.phase === "clues" && (
                  <>
                    <p className="plaza-muted-2 text-center text-[0.78rem] leading-relaxed">
                      {t("imposteri.cluesOfflineHint")}
                    </p>
                    {startPlayer && (
                      <div className="plaza-panel flex items-center justify-between gap-3 rounded-[1.125rem] px-4 py-3">
                        <span className="rm-eyebrow">{t("imposteri.firstPlayer")}</span>
                        <span className="truncate text-[0.94rem] font-semibold">
                          {startPlayer.nickname}
                          {startPlayer.id === playerId && (
                            <span className="plaza-muted-2 ml-1.5 text-xs font-normal">
                              {t("gradovi.you")}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </>
                )}
                </RoomContent>
              </RoomBody>

              <RoomBottomBar note={t("imposteri.hostPacingNote", snapshot.players.length)}>
                {view.isHost ? (
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => void sendIntent({ kind: "advance-phase" })}
                    className="plaza-button rm-cta disabled:opacity-50"
                  >
                    {view.phase === "reveal"
                      ? t("imposteri.startClues")
                      : t("imposteri.startVote")}
                  </button>
                ) : (
                  <WaitingNote>
                    {view.phase === "reveal"
                      ? t("imposteri.waitingHost")
                      : t("imposteri.waitingHostVote")}
                  </WaitingNote>
                )}
              </RoomBottomBar>
            </>
          )}
        </>
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
