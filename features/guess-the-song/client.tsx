"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import { RoomBody, RoomBottomBar, RoomContent } from "@/components/room-shell";
import {
  PhaseHeader,
  RoomError,
  RoomLoading,
  StandingRow,
  WaitingNote,
} from "@/components/room-game-ui";
import { CheckIcon, EnterIcon, NoteIcon, ReplayIcon } from "@/components/room-icons";
import { createClient } from "@/lib/supabase/client";
import { subscribeToRoom } from "@/lib/realtime/channels";
import {
  CLIP_LENGTH_OPTIONS,
  COUNTDOWN_SECONDS,
  GUESS_DURATION_STEP_SECONDS,
  MAX_GUESS_DURATION_SECONDS,
  MAX_SONG_ROUNDS,
  MIN_GUESS_DURATION_SECONDS,
  MIN_SONG_ROUNDS,
  SONG_SOURCE_PRESETS,
  FIRST_MATCH_BONUS,
  clipLengthMultiplier,
} from "./types";
import type { AnswerMode, GuessTheSongIntent, GuessTheSongView } from "./types";

const GAME_ID = "guess-the-song";

// A browser's autoplay unlock is bound to the specific <audio> element that
// received the gesture, and it does not survive a page load — so it cannot be
// cached in localStorage. One element stays mounted for the whole game and this
// silent clip gives it something to play before the first preview arrives.
const VOLUME_KEY = "plaza:song-volume";
const DEFAULT_VOLUME = 0.8;

const SILENT_CLIP = "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

type PlayerSummary = {
  id: string;
  nickname: string;
  isHost: boolean;
};

type SongSnapshot = {
  gameId: typeof GAME_ID;
  playerId: string;
  players: PlayerSummary[];
  view: GuessTheSongView;
  updatedAt: string;
};

// Twelve fixed bars showing how much of the clip has played. Heights are
// hard-coded so server and client agree and the shape never jumps.
const WAVE_BARS = [14, 26, 38, 22, 34, 18, 30, 12, 24, 16, 32, 20];

function ClipWave({ progress }: { progress: number }) {
  // `progress` is 0..1 through the clip; the bar at the cursor is highlighted.
  const cursor = Math.min(WAVE_BARS.length - 1, Math.floor(progress * WAVE_BARS.length));
  return (
    <div className="rm-wave" aria-hidden="true">
      {WAVE_BARS.map((height, index) => (
        <span
          key={index}
          style={{ height: `${height}px` }}
          data-state={
            progress <= 0
              ? "idle"
              : index < cursor
                ? "played"
                : index === cursor
                  ? "cursor"
                  : "idle"
          }
        />
      ))}
    </div>
  );
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

export function GuessTheSongClient({
  roomCode,
  playerId,
}: {
  roomCode: string;
  playerId: string;
}) {
  const router = useRouter();
  const { localizeError, t } = usePreferences();
  const [snapshot, setSnapshot] = useState<SongSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [guessValue, setGuessValue] = useState("");
  const [guessFlash, setGuessFlash] = useState<"hit" | "miss" | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(SONG_SOURCE_PRESETS[0].id);
  const [customQuery, setCustomQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  // Volume is a plain preference and *is* safe to persist — unlike the autoplay
  // unlock, it carries no per-element browser state.
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_VOLUME;
    const stored = Number(window.localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : DEFAULT_VOLUME;
  });
  const endRoundAttempted = useRef<number | null>(null);
  const countdownAttempted = useRef<number | null>(null);
  const nextRoundAttempted = useRef<number | null>(null);
  const playbackStartedAt = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // One real tap plays the mounted element, which satisfies mobile autoplay
  // policy for the rest of the page session so later rounds can autoplay.
  // Only a play() that actually resolves counts as unlocked — marking it
  // optimistically hides the fallback button and leaves the round silent.
  const unlockAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const playAttempt = audio.play();
    if (!playAttempt || typeof playAttempt.then !== "function") {
      setAudioUnlocked(true);
      return;
    }
    playAttempt
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        setAudioUnlocked(true);
      })
      .catch(() => setAudioUnlocked(false));
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    try {
      window.localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // a full/blocked storage quota must not break playback
    }
  }, [volume]);

  const loadState = useCallback(async () => {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/state`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setError(localizeError(await readError(response)));
      return;
    }
    setSnapshot((await response.json()) as SongSnapshot);
    setError(null);
  }, [localizeError, roomCode]);

  const sendIntent = useCallback(
    async (intent: GuessTheSongIntent): Promise<{ ok: boolean; message?: string }> => {
      setIsSending(true);
      try {
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: GAME_ID, intent }),
        });
        if (!response.ok) return { ok: false, message: await readError(response) };
        setSnapshot((await response.json()) as SongSnapshot);
        setError(null);
        return { ok: true };
      } finally {
        setIsSending(false);
      }
    },
    [roomCode],
  );

  async function actionIntent(intent: GuessTheSongIntent) {
    const result = await sendIntent(intent);
    if (!result.ok && result.message) setError(localizeError(result.message));
  }

  async function startGame() {
    setIsStarting(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/songs/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          selectedPreset ? { presetId: selectedPreset } : { customQuery: customQuery.trim() },
        ),
      });
      if (!response.ok) {
        setError(localizeError(await readError(response)));
        return;
      }
      setSnapshot((await response.json()) as SongSnapshot);
    } finally {
      setIsStarting(false);
    }
  }

  async function submitGuess(event: React.FormEvent) {
    event.preventDefault();
    const guess = guessValue.trim();
    if (!guess) return;
    const result = await sendIntent({ kind: "submit-guess", guess });
    if (result.ok) {
      setGuessValue("");
      setGuessFlash("hit");
    } else if (result.message === "Wrong guess.") {
      setGuessFlash("miss");
    } else if (result.message) {
      setError(localizeError(result.message));
    }
    window.setTimeout(() => setGuessFlash(null), 1200);
  }

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
    const ticking =
      (view?.phase === "playing" && view.roundDeadlineAt !== null) ||
      (view?.phase === "countdown" && view.playbackStartAt !== null) ||
      (view?.phase === "round-end" && view.roundEndAdvanceAt !== null);
    if (!ticking) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [view?.phase, view?.roundDeadlineAt, view?.playbackStartAt, view?.roundEndAdvanceAt]);

  const remainingMs =
    view?.phase === "playing" && view.roundDeadlineAt !== null
      ? Math.max(0, view.roundDeadlineAt - now)
      : null;

  const countdownRemainingMs =
    view?.phase === "countdown" && view.playbackStartAt !== null
      ? Math.max(0, view.playbackStartAt - now)
      : null;

  // Past the deadline, any client may ask the server to close the round.
  useEffect(() => {
    if (!view || view.phase !== "playing" || view.roundDeadlineAt === null) return;
    if (remainingMs === null || remainingMs > 0) return;
    if (endRoundAttempted.current === view.roundDeadlineAt) return;
    endRoundAttempted.current = view.roundDeadlineAt;
    void sendIntent({ kind: "end-round" });
  }, [remainingMs, sendIntent, view]);

  // Once the shared countdown timestamp passes, flip the room into "playing".
  useEffect(() => {
    if (!view || view.phase !== "countdown" || view.playbackStartAt === null) return;
    if (countdownRemainingMs === null || countdownRemainingMs > 0) return;
    if (countdownAttempted.current === view.playbackStartAt) return;
    countdownAttempted.current = view.playbackStartAt;
    void sendIntent({ kind: "resolve-countdown" });
  }, [countdownRemainingMs, sendIntent, view]);

  // After the round-end pause, the game advances itself — no host tap needed.
  useEffect(() => {
    if (!view || view.phase !== "round-end" || view.roundEndAdvanceAt === null) return;
    if (now < view.roundEndAdvanceAt) return;
    if (nextRoundAttempted.current === view.roundEndAdvanceAt) return;
    nextRoundAttempted.current = view.roundEndAdvanceAt;
    void sendIntent({ kind: "next-round" });
  }, [now, sendIntent, view]);

  // Load the clip during the countdown, then fire playback exactly at
  // playbackStartAt so every unlocked device starts the same instant.
  const previewUrl = view?.previewUrl ?? null;
  const clipStart = view?.clipStartSeconds ?? 0;
  const clipLengthSeconds = view?.settings.clipLengthSeconds ?? null;
  useEffect(() => {
    if (!previewUrl || !audioRef.current) return;
    audioRef.current.load();
    playbackStartedAt.current = null;
  }, [previewUrl]);

  useEffect(() => {
    if (view?.phase !== "playing" || !previewUrl || !audioRef.current) return;
    if (!audioUnlocked) return;
    if (playbackStartedAt.current === view.playbackStartAt) return;
    playbackStartedAt.current = view.playbackStartAt;
    const audio = audioRef.current;

    const start = () => {
      audio.currentTime = clipStart;
      void audio.play().catch(() => {
        // Blocked despite the unlock tap — surface the manual play control again.
        setAudioUnlocked(false);
      });
    };

    // Round one starts on a cold buffer, so the clip is often not playable yet
    // at playbackStartAt. Waiting for `canplay` costs a beat instead of silence.
    if (audio.readyState >= 3) {
      start();
      return;
    }
    audio.addEventListener("canplay", start, { once: true });
    return () => audio.removeEventListener("canplay", start);
  }, [audioUnlocked, clipStart, previewUrl, view?.phase, view?.playbackStartAt]);

  // Stop at the host's clip length. `timeupdate` tracks real playback position,
  // so a slow start doesn't cut the clip short.
  useEffect(() => {
    if (view?.phase !== "playing" || clipLengthSeconds === null || !audioRef.current) return;
    const audio = audioRef.current;
    const stopAtLimit = () => {
      if (audio.currentTime < clipStart + clipLengthSeconds) return;
      audio.pause();
    };
    audio.addEventListener("timeupdate", stopAtLimit);
    return () => audio.removeEventListener("timeupdate", stopAtLimit);
  }, [clipLengthSeconds, clipStart, view?.phase]);

  // Replaying is the whole point of a short clip — you cannot be expected to
  // name a 2-second snippet you only ever hear once.
  const replayClip = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = clipStart;
    const attempt = audio.play();
    if (attempt && typeof attempt.then === "function") {
      attempt.then(() => setAudioUnlocked(true)).catch(() => setAudioUnlocked(false));
    }
  }, [clipStart]);

  // Cut the clip the instant the round stops being "playing" (round-end,
  // host end-round, next round's countdown) so it never bleeds into review.
  useEffect(() => {
    if (view?.phase === "playing") return;
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    audio.pause();
    audio.currentTime = 0;
  }, [view?.phase]);

  const playersById = useMemo(
    () => new Map(snapshot?.players.map((player) => [player.id, player]) ?? []),
    [snapshot?.players],
  );

  const scoreRows = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.players].sort(
      (a, b) => (snapshot.view.scores[b.id] ?? 0) - (snapshot.view.scores[a.id] ?? 0),
    );
  }, [snapshot]);

  if (!snapshot || !view) {
    return (
      <RoomBody>
        <RoomLoading rows={4} />
      </RoomBody>
    );
  }

  const secondsLeft = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;
  const countdownSecondsLeft =
    countdownRemainingMs !== null ? Math.ceil(countdownRemainingMs / 1000) : null;
  const modeDone =
    view.settings.answerMode === "title"
      ? view.myProgress.titleMatched
      : view.settings.answerMode === "artist"
        ? view.myProgress.artistMatched
        : view.myProgress.titleMatched && view.myProgress.artistMatched;

  // How far into the clip we are, mirrored from the shared playback timestamp.
  const clipLength = view.settings.clipLengthSeconds;
  const clipElapsed =
    view.phase === "playing" && view.playbackStartAt !== null
      ? Math.max(0, Math.min(clipLength, (now - view.playbackStartAt) / 1000))
      : 0;
  const timerUrgent = secondsLeft !== null && secondsLeft <= 5;

  const scoreLine = scoreRows
    .map(
      (player) =>
        `${player.id === playerId ? t("gradovi.you") : player.nickname} ${view.scores[player.id] ?? 0}`,
    )
    .join(" · ");

  const roundProgress = (
    <span
      className="rm-segments"
      role="img"
      aria-label={t("song.roundOf", view.roundIndex + 1, view.effectiveRounds)}
    >
      {Array.from({ length: view.effectiveRounds }).map((_, index) => (
        <span
          key={index}
          className={`rm-segment ${
            index < view.roundIndex
              ? "rm-segment--done"
              : index === view.roundIndex
                ? "rm-segment--current"
                : ""
          }`}
        />
      ))}
    </span>
  );

  const scoreboard = (
    <section className="grid gap-2.5">
      <h3 className="rm-eyebrow">{t("gradovi.scoreboard")}</h3>
      <ol className="grid gap-2">
        {scoreRows.map((player, index) => (
          <StandingRow
            key={player.id}
            rank={index + 1}
            name={player.nickname}
            isMe={player.id === playerId}
            youLabel={t("gradovi.you")}
            note={
              view.matchedPlayerIds.includes(player.id) && view.phase === "playing"
                ? t("song.matched")
                : undefined
            }
            score={
              <>
                {view.phase === "round-end" && (view.roundPoints[player.id] ?? 0) > 0 && (
                  <span className="plaza-status-valid mr-1.5 rounded px-1.5 py-0.5 text-[0.69rem]">
                    +{view.roundPoints[player.id]}
                  </span>
                )}
                {view.scores[player.id] ?? 0}
              </>
            }
          />
        ))}
      </ol>
    </section>
  );

  const audioElement = (
    /* Mounted in every phase and never remounted: the autoplay unlock is bound
       to this element, so it has to exist before the first tap and survive
       every phase change. Swapping `src` keeps the unlock. */
    <audio ref={audioRef} preload="auto" className="hidden" src={previewUrl ?? SILENT_CLIP} />
  );

  const unlockBanner = !audioUnlocked && view.phase !== "finished" && (
    <button
      type="button"
      onClick={unlockAudio}
      className="plaza-status-valid flex w-full items-center justify-center gap-2 rounded-[0.875rem] px-4 py-3 text-[0.84rem] font-semibold"
    >
      <NoteIcon size={16} /> {t("song.unlockAudio")}
    </button>
  );

  // ---------------------------------------------------------------- setup
  if (view.phase === "setup") {
    return (
      <>
        <PhaseHeader eyebrow={t("song.phase.setup")} title={t("song.setupTitle")} />
        <RoomBody className="p-5 sm:p-6">
          <RoomContent className="gap-5">
          {error && <RoomError message={error} />}
          {audioElement}
          {unlockBanner}

          {view.isHost ? (
            <>
              <section className="grid gap-2.5">
                <h3 className="rm-eyebrow">{t("song.source")}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {SONG_SOURCE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={selectedPreset === preset.id}
                      disabled={isStarting}
                      onClick={() => setSelectedPreset(preset.id)}
                      className={`plaza-select-card h-13 rounded-[0.875rem] px-3 text-[0.84rem] font-semibold ${
                        selectedPreset === preset.id ? "plaza-select-card--selected" : ""
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <label className="grid gap-1.5">
                  <span className="plaza-muted text-[0.69rem]">{t("song.customQuery")}</span>
                  <input
                    value={customQuery}
                    maxLength={60}
                    disabled={isStarting}
                    onChange={(event) => {
                      setCustomQuery(event.target.value);
                      setSelectedPreset(
                        event.target.value.trim() ? null : SONG_SOURCE_PRESETS[0].id,
                      );
                    }}
                    placeholder={t("song.customQueryPlaceholder")}
                    className="plaza-input h-12 rounded-[0.875rem] px-3.5 text-[0.875rem]"
                  />
                </label>
              </section>

              <section className="grid gap-3">
                <h3 className="rm-eyebrow">{t("alias.settings")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <NumberControl
                    label={t("song.rounds")}
                    value={view.settings.totalRounds}
                    min={MIN_SONG_ROUNDS}
                    max={MAX_SONG_ROUNDS}
                    step={1}
                    disabled={isSending || isStarting}
                    onChange={(value) =>
                      void actionIntent({
                        kind: "update-settings",
                        settings: { totalRounds: value },
                      })
                    }
                  />
                  <NumberControl
                    label={t("song.roundTime")}
                    value={view.settings.guessDurationSeconds}
                    unit={t("gradovi.settings.seconds")}
                    min={MIN_GUESS_DURATION_SECONDS}
                    max={MAX_GUESS_DURATION_SECONDS}
                    step={GUESS_DURATION_STEP_SECONDS}
                    disabled={isSending || isStarting}
                    onChange={(value) =>
                      void actionIntent({
                        kind: "update-settings",
                        settings: { guessDurationSeconds: value },
                      })
                    }
                  />
                </div>

                <div className="grid gap-1.5">
                  <span className="rm-eyebrow">{t("song.clipLength")}</span>
                  <div className="grid grid-cols-4 gap-2" role="group" aria-label={t("song.clipLength")}>
                    {CLIP_LENGTH_OPTIONS.map((option) => {
                      const multiplier = clipLengthMultiplier(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={view.settings.clipLengthSeconds === option}
                          disabled={isSending || isStarting}
                          onClick={() =>
                            void actionIntent({
                              kind: "update-settings",
                              settings: { clipLengthSeconds: option },
                            })
                          }
                          className={`plaza-select-card grid h-12 place-items-center rounded-[0.875rem] text-[0.69rem] font-semibold disabled:opacity-40 ${
                            view.settings.clipLengthSeconds === option
                              ? "plaza-select-card--selected"
                              : ""
                          }`}
                        >
                          <span>{option}s</span>
                          {multiplier > 1 && (
                            <span className="plaza-muted text-[0.6rem] leading-none">
                              ×{multiplier}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="plaza-muted-2 text-[0.69rem] leading-relaxed">
                    {t("song.clipLengthHint")}
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <span className="rm-eyebrow">{t("song.answerMode")}</span>
                  <div
                    className="grid grid-cols-3 gap-2"
                    role="group"
                    aria-label={t("song.answerMode")}
                  >
                    {(["both", "title", "artist"] as AnswerMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={view.settings.answerMode === mode}
                        disabled={isSending || isStarting}
                        onClick={() =>
                          void actionIntent({
                            kind: "update-settings",
                            settings: { answerMode: mode },
                          })
                        }
                        className={`plaza-select-card h-12 rounded-[0.875rem] text-[0.69rem] font-semibold ${
                          view.settings.answerMode === mode ? "plaza-select-card--selected" : ""
                        }`}
                      >
                        {t(`song.mode.${mode}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </>
          ) : (
            <>
              <p className="plaza-muted text-[0.84rem]">{t("song.waitingForSetup")}</p>
              {scoreboard}
            </>
          )}
          </RoomContent>
        </RoomBody>

        <RoomBottomBar note={view.isHost ? t("song.previewNote") : undefined}>
          {view.isHost ? (
            <button
              type="button"
              disabled={isStarting || (!selectedPreset && !customQuery.trim())}
              onClick={() => void startGame()}
              className="plaza-button rm-cta disabled:opacity-50"
            >
              {isStarting ? t("song.loadingTracks") : t("song.start")}
            </button>
          ) : (
            <WaitingNote>{t("song.waitingForSetup")}</WaitingNote>
          )}
        </RoomBottomBar>
      </>
    );
  }

  // ------------------------------------------------------------- countdown
  if (view.phase === "countdown") {
    return (
      <>
        <PhaseHeader
          eyebrow={`${t("song.roundOf", view.roundIndex + 1, view.effectiveRounds)}${
            view.playlistLabel ? ` · ${view.playlistLabel}` : ""
          }`}
          title={t("song.countdownTitle")}
        />
        <RoomBody center className="p-5 text-center sm:p-6">
          <RoomContent className="items-center gap-6">
          {audioElement}
          {unlockBanner}
          <p className="plaza-muted text-[0.84rem]">{t("song.getReady")}</p>
          <p
            key={countdownSecondsLeft ?? COUNTDOWN_SECONDS}
            className="plaza-count-pulse rm-numeric text-6xl font-extrabold"
            role="timer"
            aria-live="polite"
          >
            {countdownSecondsLeft ?? COUNTDOWN_SECONDS}
          </p>
          {!audioUnlocked && (
            <p className="plaza-muted-2 text-[0.72rem]">{t("song.unlockAudioHint")}</p>
          )}
          </RoomContent>
        </RoomBody>
        <RoomBottomBar>{roundProgress}</RoomBottomBar>
      </>
    );
  }

  // -------------------------------------------------------------- finished
  if (view.phase === "finished") {
    return (
      <>
        <PhaseHeader
          eyebrow={t("song.roundOf", view.roundIndex + 1, view.effectiveRounds)}
          title={t("song.finishedTitle")}
        />
        <RoomBody className="p-5 sm:p-6">
          <RoomContent className="gap-3.5">
          {error && <RoomError message={error} />}
          {audioElement}
          <div className="plaza-winner-card rounded-3xl px-5 py-8 text-center">
            <p className="rm-eyebrow">{t("alias.winner")}</p>
            <p className="rm-display mt-2 text-[1.75rem] font-extrabold">
              {scoreRows[0]?.nickname ?? "—"}
            </p>
            <p className="plaza-muted mt-1 text-[0.84rem]">
              {t("song.finalScore", view.scores[scoreRows[0]?.id ?? ""] ?? 0)}
            </p>
          </div>
          {scoreboard}
          </RoomContent>
        </RoomBody>
        <RoomBottomBar note={!view.isHost ? t("gradovi.hostCloseNote") : undefined}>
          {view.isHost ? (
            <>
              <button
                type="button"
                disabled={isSending}
                onClick={() => void actionIntent({ kind: "play-again" })}
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
          )}
        </RoomBottomBar>
      </>
    );
  }

  // ------------------------------------------ 13 · playing and round-end
  return (
    <>
      <PhaseHeader
        eyebrow={`${t("song.roundOf", view.roundIndex + 1, view.effectiveRounds)}${
          view.playlistLabel ? ` · ${view.playlistLabel}` : ""
        }`}
        title={t(`song.modeHint.${view.settings.answerMode}`)}
        right={
          view.phase === "playing" && secondsLeft !== null ? (
            <span
              className={`rm-timer ${timerUrgent ? "rm-timer--danger" : "rm-timer--accent"}`}
              role="timer"
              aria-live="polite"
            >
              {formatClock(secondsLeft)}
            </span>
          ) : undefined
        }
      />

      <RoomBody center className="p-5 sm:p-6">
        <RoomContent className="gap-4">
        {error && <RoomError message={error} />}
        {audioElement}
        {unlockBanner}

        <div className="plaza-panel grid justify-items-center gap-4 rounded-3xl px-5 py-[1.625rem]">
          {/* Artwork is part of the answer, so it only arrives at reveal. */}
          <div className="rm-artwork">
            {view.reveal?.artworkUrl ? (
              <img src={view.reveal.artworkUrl} alt="" width={180} height={180} />
            ) : (
              <NoteIcon size={44} />
            )}
          </div>

          {view.phase === "round-end" && view.reveal ? (
            <div className="grid justify-items-center gap-1 text-center">
              <p className="rm-display text-[1.375rem] font-extrabold">{view.reveal.title}</p>
              <p className="plaza-muted text-[0.875rem]">{view.reveal.artist}</p>
            </div>
          ) : (
            <div className="grid w-full gap-2">
              <ClipWave progress={clipLength > 0 ? clipElapsed / clipLength : 0} />
              <div className="rm-numeric plaza-muted-2 flex justify-between text-[0.69rem]">
                <span>{formatClock(clipElapsed)}</span>
                <span>{t("song.clipLabel", clipLength)}</span>
              </div>
            </div>
          )}

          {view.phase === "playing" && (
            <div className="grid w-full gap-2.5">
              <button
                type="button"
                onClick={replayClip}
                className="plaza-button-secondary flex h-10 items-center justify-center gap-2 rounded-xl text-[0.78rem] font-semibold"
              >
                <ReplayIcon />
                {audioUnlocked ? `${t("song.replay")} (${clipLength}s)` : t("song.tapToPlay")}
              </button>
              <label className="flex items-center gap-2.5">
                <span className="plaza-muted-2 text-[0.69rem]">{t("song.volume")}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  aria-label={t("song.volume")}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="plaza-range h-6 flex-1"
                />
                <span className="rm-numeric plaza-muted-2 w-9 text-right text-[0.69rem]">
                  {Math.round(volume * 100)}%
                </span>
              </label>
            </div>
          )}
        </div>

        {view.phase === "playing" && (
          <div className="grid gap-2.5">
            {modeDone ? (
              <p className="plaza-status-valid rounded-2xl px-4 py-3.5 text-center text-[0.84rem] font-semibold">
                {t("song.youGotIt")}
              </p>
            ) : (
              <form onSubmit={(event) => void submitGuess(event)} className="flex gap-2">
                <input
                  value={guessValue}
                  onChange={(event) => setGuessValue(event.target.value)}
                  maxLength={80}
                  disabled={isSending}
                  placeholder={t(`song.guessPlaceholder.${view.settings.answerMode}`)}
                  aria-label={t("song.guessAria")}
                  className={`plaza-input h-[3.375rem] min-w-0 flex-1 rounded-2xl px-4 text-[0.94rem] ${
                    guessFlash === "miss" ? "plaza-shake" : ""
                  }`}
                />
                <button
                  type="submit"
                  disabled={isSending || !guessValue.trim()}
                  aria-label={t("song.guess")}
                  className="plaza-button grid h-[3.375rem] w-16 shrink-0 place-items-center rounded-2xl disabled:opacity-40"
                >
                  <EnterIcon size={20} />
                </button>
              </form>
            )}

            {/* One chip per part of the answer this mode asks for. */}
            <div className="flex gap-2">
              {view.settings.answerMode !== "artist" && (
                <MatchChip
                  matched={view.myProgress.titleMatched}
                  label={
                    view.myProgress.titleMatched
                      ? t("song.titleMatched")
                      : t("song.titlePending")
                  }
                />
              )}
              {view.settings.answerMode !== "title" && (
                <MatchChip
                  matched={view.myProgress.artistMatched}
                  label={
                    view.myProgress.artistMatched
                      ? t("song.artistMatched")
                      : t("song.artistPending")
                  }
                />
              )}
            </div>

            {guessFlash === "miss" && (
              <p className="text-center text-[0.72rem] text-[var(--plaza-danger)]" aria-live="polite">
                {t("song.miss")}
              </p>
            )}
          </div>
        )}

        {view.phase === "round-end" && (
          <p className="plaza-muted-2 text-center text-[0.72rem]">
            {view.roundIndex + 1 >= view.effectiveRounds
              ? t("song.autoResults")
              : t("song.autoNextRound")}
          </p>
        )}

        {scoreboard}
        </RoomContent>
      </RoomBody>

      <RoomBottomBar>
        <div className="plaza-muted flex items-center justify-between gap-2 text-[0.72rem]">
          <span className="truncate">
            {view.firstMatchPlayerId
              ? t(
                  "song.firstCorrect",
                  playersById.get(view.firstMatchPlayerId)?.nickname ?? "—",
                  FIRST_MATCH_BONUS,
                )
              : t("song.noFirstYet")}
          </span>
          <span className="shrink-0 truncate">{scoreLine}</span>
        </div>
        {roundProgress}
        {view.isHost && (
          <button
            type="button"
            disabled={isSending}
            onClick={() =>
              void actionIntent({
                kind: view.phase === "playing" ? "end-round" : "next-round",
              })
            }
            className="plaza-ghost-button mx-auto rounded-lg px-3 py-1.5 text-[0.78rem] font-medium disabled:opacity-50"
          >
            {view.phase === "playing"
              ? t("song.endRound")
              : view.roundIndex + 1 >= view.effectiveRounds
                ? t("song.showResults")
                : t("song.nextRound")}
          </button>
        )}
      </RoomBottomBar>
    </>
  );
}

function MatchChip({ matched, label }: { matched: boolean; label: string }) {
  return (
    <span
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[0.72rem] font-semibold ${
        matched
          ? "border border-[color-mix(in_srgb,var(--plaza-success)_36%,var(--plaza-line))] plaza-status-valid"
          : "plaza-subtle border border-[var(--plaza-line)] text-[var(--plaza-muted)]"
      }`}
    >
      {matched && <CheckIcon size={13} />}
      {label}
    </span>
  );
}

function NumberControl({
  label,
  value,
  unit,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
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
