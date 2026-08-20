"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import { createClient } from "@/lib/supabase/client";
import { subscribeToRoom } from "@/lib/realtime/channels";
import {
  COUNTDOWN_SECONDS,
  MAX_GUESS_DURATION_SECONDS,
  MAX_SONG_ROUNDS,
  MIN_GUESS_DURATION_SECONDS,
  MIN_SONG_ROUNDS,
  SONG_SOURCE_PRESETS,
} from "./types";
import type { AnswerMode, GuessTheSongIntent, GuessTheSongView } from "./types";

const GAME_ID = "guess-the-song";
const AUDIO_UNLOCKED_KEY = "plaza:song-audio-unlocked";

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

// Deterministic pseudo-random bar settings so SSR and client agree; the
// staggered durations keep the wave from ever looping in sync.
const EQ_BARS = Array.from({ length: 16 }, (_, index) => ({
  dur: 620 + ((index * 97) % 460),
  delay: (index * 53) % 380,
  min: 0.14 + ((index * 31) % 22) / 100,
  max: 0.55 + ((index * 47) % 45) / 100,
}));

function Equalizer({ active }: { active: boolean }) {
  return (
    <div className="plaza-eq mt-3" data-active={active} aria-hidden="true">
      {EQ_BARS.map((bar, index) => (
        <span
          key={index}
          style={
            {
              "--eq-dur": `${bar.dur}ms`,
              "--eq-delay": `${bar.delay}ms`,
              "--eq-min": bar.min,
              "--eq-max": bar.max,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
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
  const [audioUnlocked, setAudioUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(AUDIO_UNLOCKED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const endRoundAttempted = useRef<number | null>(null);
  const countdownAttempted = useRef<number | null>(null);
  const nextRoundAttempted = useRef<number | null>(null);
  const playbackStartedAt = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // One real tap plays+immediately pauses a silent clip, which satisfies mobile
  // autoplay policies for the rest of the session so later rounds can autoplay.
  const unlockAudio = useCallback(() => {
    setAudioUnlocked(true);
    try {
      window.localStorage.setItem(AUDIO_UNLOCKED_KEY, "1");
    } catch {
      // ignore
    }
    const audio = audioRef.current;
    if (!audio) return;
    const playAttempt = audio.play();
    if (playAttempt && typeof playAttempt.then === "function") {
      playAttempt
        .then(() => audio.pause())
        .catch(() => {
          // Autoplay was blocked; playback will retry from the countdown timestamp.
        });
    }
  }, []);

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
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Blocked despite the earlier unlock tap; the visible play control still works.
    });
  }, [audioUnlocked, previewUrl, view?.phase, view?.playbackStartAt]);

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

  const secondsLeft = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;
  const countdownSecondsLeft =
    countdownRemainingMs !== null ? Math.ceil(countdownRemainingMs / 1000) : null;
  const modeDone =
    view.settings.answerMode === "title"
      ? view.myProgress.titleMatched
      : view.settings.answerMode === "artist"
        ? view.myProgress.artistMatched
        : view.myProgress.titleMatched && view.myProgress.artistMatched;

  const scoreboard = (
    <section>
      <h3 className="plaza-label mb-2">{t("gradovi.scoreboard")}</h3>
      <ol className="grid gap-2">
        {scoreRows.map((player, index) => (
          <li
            key={player.id}
            className={`plaza-rank-row flex h-11 items-center justify-between rounded-xl px-3 text-sm ${
              player.id === playerId ? "plaza-rank-row--me" : ""
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="plaza-rank-badge">{index + 1}</span>
              <span className="truncate font-medium">{player.nickname}</span>
              {player.id === playerId && (
                <span className="plaza-muted-2 text-xs">{t("gradovi.you")}</span>
              )}
              {view.matchedPlayerIds.includes(player.id) && view.phase === "playing" && (
                <span className="plaza-status-valid rounded-full px-2 py-0.5 text-[0.65rem] font-semibold">
                  {t("song.matched")}
                </span>
              )}
            </span>
            <span className="font-mono font-semibold tabular-nums">
              {view.phase === "round-end" && (view.roundPoints[player.id] ?? 0) > 0 ? (
                <span className="plaza-status-valid mr-1.5 rounded px-1.5 py-0.5 text-xs">
                  +{view.roundPoints[player.id]}
                </span>
              ) : null}
              {view.scores[player.id] ?? 0}
            </span>
          </li>
        ))}
      </ol>
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
                  ? t("song.phase.setup")
                  : t("song.roundOf", view.roundIndex + 1, view.effectiveRounds)}
              </p>
              <h2 className="truncate text-lg font-semibold">
                {view.phase === "setup" && t("song.setupTitle")}
                {view.phase === "countdown" && t("song.countdownTitle")}
                {view.phase === "playing" && t("song.playingTitle")}
                {view.phase === "round-end" && t("song.roundEndTitle")}
                {view.phase === "finished" && t("song.finishedTitle")}
              </h2>
            </div>
            {view.playlistLabel && view.phase !== "setup" && (
              <span className="plaza-chip max-w-40 truncate rounded-full px-3 py-1.5 text-xs font-semibold">
                ♪ {view.playlistLabel}
              </span>
            )}
          </div>
        </div>

        {error && <div className="plaza-error border-b px-4 py-3 text-sm">{error}</div>}

        {!audioUnlocked && view.phase !== "finished" && (
          <button
            type="button"
            onClick={unlockAudio}
            className="plaza-status-valid flex w-full items-center justify-center gap-2 border-b px-4 py-3 text-sm font-semibold"
          >
            ♪ {t("song.unlockAudio")}
          </button>
        )}

        {/* ------------------------------------------------ setup */}
        {view.phase === "setup" && (
          <div className="grid gap-5 p-4">
            {view.isHost ? (
              <>
                <section className="grid gap-2">
                  <h3 className="plaza-label">{t("song.source")}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {SONG_SOURCE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={selectedPreset === preset.id}
                        disabled={isStarting}
                        onClick={() => setSelectedPreset(preset.id)}
                        className={`plaza-select-card h-12 rounded-xl px-3 text-sm font-semibold ${
                          selectedPreset === preset.id ? "plaza-select-card--selected" : ""
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <label className="mt-1 grid gap-1.5">
                    <span className="plaza-muted text-xs">{t("song.customQuery")}</span>
                    <input
                      value={customQuery}
                      maxLength={60}
                      disabled={isStarting}
                      onChange={(event) => {
                        setCustomQuery(event.target.value);
                        setSelectedPreset(event.target.value.trim() ? null : SONG_SOURCE_PRESETS[0].id);
                      }}
                      placeholder={t("song.customQueryPlaceholder")}
                      className="plaza-input h-11 rounded-xl px-3 text-sm"
                    />
                  </label>
                </section>

                <section className="grid gap-3">
                  <h3 className="plaza-label">{t("alias.settings")}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberControl
                      label={t("song.rounds")}
                      value={view.settings.totalRounds}
                      min={MIN_SONG_ROUNDS}
                      max={MAX_SONG_ROUNDS}
                      step={1}
                      disabled={isSending || isStarting}
                      onChange={(value) =>
                        void actionIntent({ kind: "update-settings", settings: { totalRounds: value } })
                      }
                    />
                    <NumberControl
                      label={t("song.roundTime")}
                      value={view.settings.guessDurationSeconds}
                      unit={t("gradovi.settings.seconds")}
                      min={MIN_GUESS_DURATION_SECONDS}
                      max={MAX_GUESS_DURATION_SECONDS}
                      step={15}
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
                    <span className="plaza-label">{t("song.answerMode")}</span>
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("song.answerMode")}>
                      {(["both", "title", "artist"] as AnswerMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={view.settings.answerMode === mode}
                          disabled={isSending || isStarting}
                          onClick={() =>
                            void actionIntent({ kind: "update-settings", settings: { answerMode: mode } })
                          }
                          className={`plaza-select-card h-11 rounded-xl text-xs font-semibold ${
                            view.settings.answerMode === mode ? "plaza-select-card--selected" : ""
                          }`}
                        >
                          {t(`song.mode.${mode}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <button
                  type="button"
                  disabled={isStarting || (!selectedPreset && !customQuery.trim())}
                  onClick={() => void startGame()}
                  className="plaza-button h-12 rounded-xl text-base font-semibold disabled:opacity-50"
                >
                  {isStarting ? t("song.loadingTracks") : t("song.start")}
                </button>
                <p className="plaza-muted text-center text-xs">{t("song.previewNote")}</p>
              </>
            ) : (
              <div className="grid gap-4">
                <p className="plaza-muted text-sm">{t("song.waitingForSetup")}</p>
                {scoreboard}
              </div>
            )}
          </div>
        )}

        {/* Mounted once across countdown/playing/round-end so the same element
            keeps buffering + playing without remounting between phases. */}
        {previewUrl &&
          (view.phase === "countdown" ||
            view.phase === "playing" ||
            view.phase === "round-end") && (
            <audio ref={audioRef} preload="auto" className="hidden" src={previewUrl} />
          )}

        {/* ------------------------------------------------ countdown */}
        {view.phase === "countdown" && (
          <div className="grid gap-6 p-4 py-10 text-center">
            <p className="plaza-muted text-sm">{t("song.getReady")}</p>
            <p
              key={countdownSecondsLeft ?? COUNTDOWN_SECONDS}
              className="plaza-count-pulse font-mono text-6xl font-bold tabular-nums"
              role="timer"
              aria-live="polite"
            >
              {countdownSecondsLeft ?? COUNTDOWN_SECONDS}
            </p>
            {!audioUnlocked && (
              <p className="plaza-muted text-xs">{t("song.unlockAudioHint")}</p>
            )}
          </div>
        )}

        {/* ------------------------------------------------ playing / round-end */}
        {(view.phase === "playing" || view.phase === "round-end") && (
          <div className="grid gap-4 p-4">
            <div className="plaza-music-card rounded-2xl p-4">
              <div className="flex items-center gap-4">
                {view.reveal?.artworkUrl ? (
                  <img
                    src={view.reveal.artworkUrl}
                    alt=""
                    width={72}
                    height={72}
                    className="h-18 w-18 shrink-0 rounded-xl"
                  />
                ) : (
                  <div className="plaza-music-disc shrink-0" aria-hidden="true" data-spinning={view.phase === "playing"}>
                    <span>♪</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {view.phase === "round-end" && view.reveal ? (
                    <>
                      <p className="truncate text-lg font-bold">{view.reveal.title}</p>
                      <p className="plaza-muted truncate text-sm">{view.reveal.artist}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold">{t("song.mysteryTrack")}</p>
                      <p className="plaza-muted text-sm">{t(`song.modeHint.${view.settings.answerMode}`)}</p>
                    </>
                  )}
                </div>
                {view.phase === "playing" && secondsLeft !== null && (
                  <span
                    className={`shrink-0 font-mono text-2xl font-bold tabular-nums ${
                      secondsLeft <= 10 ? "text-[var(--plaza-danger)]" : ""
                    }`}
                    role="timer"
                    aria-live="polite"
                  >
                    {secondsLeft}
                  </span>
                )}
              </div>
              <Equalizer active={view.phase === "playing"} />
              {view.phase === "playing" && !audioUnlocked && (
                <button
                  type="button"
                  onClick={() => {
                    unlockAudio();
                    const audio = audioRef.current;
                    if (!audio) return;
                    audio.currentTime = 0;
                    void audio.play().catch(() => {});
                  }}
                  className="plaza-button mt-4 h-11 w-full rounded-xl text-sm font-semibold"
                >
                  ▶ {t("song.tapToPlay")}
                </button>
              )}
            </div>

            {view.phase === "playing" && (
              <>
                {modeDone ? (
                  <div className="plaza-status-valid rounded-xl px-4 py-3 text-center text-sm font-semibold">
                    {t("song.youGotIt")}
                  </div>
                ) : (
                  <form onSubmit={(event) => void submitGuess(event)} className="grid gap-2">
                    <div className="flex gap-2">
                      <input
                        value={guessValue}
                        onChange={(event) => setGuessValue(event.target.value)}
                        maxLength={80}
                        disabled={isSending}
                        placeholder={t(`song.guessPlaceholder.${view.settings.answerMode}`)}
                        aria-label={t("song.guessAria")}
                        className={`plaza-input h-12 w-full min-w-0 rounded-xl px-3 text-base ${
                          guessFlash === "miss" ? "plaza-shake" : ""
                        }`}
                      />
                      <button
                        type="submit"
                        disabled={isSending || !guessValue.trim()}
                        className="plaza-button h-12 shrink-0 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
                      >
                        {t("song.guess")}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs" aria-live="polite">
                      {guessFlash === "miss" && (
                        <span className="text-[var(--plaza-danger)]">{t("song.miss")}</span>
                      )}
                      {view.settings.answerMode !== "artist" && (
                        <span className={view.myProgress.titleMatched ? "plaza-status-valid rounded px-1.5 py-0.5 font-semibold" : "plaza-muted"}>
                          {t("song.titleLabel")} {view.myProgress.titleMatched ? "✓" : "…"}
                        </span>
                      )}
                      {view.settings.answerMode !== "title" && (
                        <span className={view.myProgress.artistMatched ? "plaza-status-valid rounded px-1.5 py-0.5 font-semibold" : "plaza-muted"}>
                          {t("song.artistLabel")} {view.myProgress.artistMatched ? "✓" : "…"}
                        </span>
                      )}
                    </div>
                  </form>
                )}
                {view.isHost && (
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => void actionIntent({ kind: "end-round" })}
                    className="plaza-ghost-button h-10 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {t("song.endRound")}
                  </button>
                )}
              </>
            )}

            {view.phase === "round-end" && (
              <>
                {view.firstMatchPlayerId && (
                  <p className="plaza-muted text-center text-sm">
                    {t(
                      "song.firstMatch",
                      playersById.get(view.firstMatchPlayerId)?.nickname ?? "—",
                    )}
                  </p>
                )}
                <p className="plaza-muted text-center text-xs">
                  {view.roundIndex + 1 >= view.effectiveRounds
                    ? t("song.autoResults")
                    : t("song.autoNextRound")}
                </p>
                {view.isHost && (
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => void actionIntent({ kind: "next-round" })}
                    className="plaza-ghost-button h-10 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {view.roundIndex + 1 >= view.effectiveRounds
                      ? t("song.showResults")
                      : t("song.nextRound")}
                  </button>
                )}
              </>
            )}

            {scoreboard}
          </div>
        )}

        {/* ------------------------------------------------ finished */}
        {view.phase === "finished" && (
          <div className="grid gap-5 p-4">
            <div className="plaza-winner-card rounded-2xl px-5 py-8 text-center">
              <p className="plaza-label">{t("alias.winner")}</p>
              <p className="mt-2 text-3xl font-bold">{scoreRows[0]?.nickname ?? "—"}</p>
              <p className="plaza-muted mt-1 text-sm">
                {t("song.finalScore", view.scores[scoreRows[0]?.id ?? ""] ?? 0)}
              </p>
            </div>
            {scoreboard}
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!view.isHost || isSending}
                onClick={() => void actionIntent({ kind: "play-again" })}
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
    </div>
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
