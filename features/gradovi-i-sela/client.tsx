"use client";

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
import { CheckIcon } from "@/components/room-icons";
import { createClient } from "@/lib/supabase/client";
import { subscribeToRoom } from "@/lib/realtime/channels";
import {
  DEFAULT_GRADOVI_SETTINGS,
  DEFAULT_GRADOVI_CATEGORIES,
  MAX_ROUND_DURATION_SECONDS,
  MAX_TOTAL_ROUNDS,
  MIN_ROUND_DURATION_SECONDS,
  MIN_TOTAL_ROUNDS,
  OPTIONAL_GRADOVI_CATEGORIES,
} from "./types";
import type { GradoviIntent, GradoviSettings, GradoviView } from "./types";

const GAME_ID = "gradovi-i-sela";
const AUTOSAVE_DELAY_MS = 350;

type PlayerSummary = {
  id: string;
  nickname: string;
  isHost: boolean;
};

type GradoviSnapshot = {
  gameId: typeof GAME_ID;
  playerId: string;
  players: PlayerSummary[];
  view: GradoviView;
  updatedAt: string;
  warning?: string;
};
type ScreenNotice = {
  kicker: string;
  title: string;
  note: string;
  tone: "start" | "final";
};

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function totalRoundPoints(view: GradoviView, targetPlayerId: string): number {
  return Object.values(view.roundScores[targetPlayerId] ?? {}).reduce(
    (total, points) => total + points,
    0,
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

export function GradoviClient({ roomCode, playerId }: { roomCode: string; playerId: string }) {
  const router = useRouter();
  const { localizeError, t } = usePreferences();
  const [snapshot, setSnapshot] = useState<GradoviSnapshot | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [draftSettings, setDraftSettings] = useState<GradoviSettings>({
    ...DEFAULT_GRADOVI_SETTINGS,
  });
  const [draftCategories, setDraftCategories] = useState<string[]>([
    ...DEFAULT_GRADOVI_CATEGORIES,
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCheckingAi, setIsCheckingAi] = useState(false);
  const [screenNotice, setScreenNotice] = useState<ScreenNotice | null>(null);
  const [timeUpNotice, setTimeUpNotice] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const requestQueue = useRef<Promise<GradoviSnapshot | null>>(Promise.resolve(null));
  const pendingRequests = useRef(0);
  const syncedRound = useRef<number | null>(null);
  const syncedSettings = useRef<string | null>(null);
  const syncedCategories = useRef<string | null>(null);
  const autoRevealRound = useRef<number | null>(null);
  const warningFlashRound = useRef<number | null>(null);
  const warningFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundStartNoticeRound = useRef<number | null>(null);
  const finalNoticeShown = useRef(false);
  const timeUpNoticeRound = useRef<number | null>(null);
  const timeUpNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showScreenNotice = useCallback((notice: ScreenNotice) => {
    setScreenNotice(notice);
    if (screenNoticeTimer.current) clearTimeout(screenNoticeTimer.current);
    screenNoticeTimer.current = setTimeout(() => {
      setScreenNotice(null);
      screenNoticeTimer.current = null;
    }, 1850);
  }, []);

  const loadState = useCallback(async () => {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/state`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setError(localizeError(await readError(response)));
      return;
    }
    const data = (await response.json()) as GradoviSnapshot;
    setSnapshot(data);
    setError(null);
  }, [localizeError, roomCode]);

  const sendIntent = useCallback(
    async (intent: GradoviIntent) => {
      pendingRequests.current += 1;
      setIsSending(true);
      try {
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: GAME_ID, intent }),
        });
        if (!response.ok) {
          setError(localizeError(await readError(response)));
          return null;
        }
        const data = (await response.json()) as GradoviSnapshot;
        setSnapshot(data);
        setError(null);
        return data;
      } finally {
        pendingRequests.current -= 1;
        if (pendingRequests.current === 0) setIsSending(false);
      }
    },
    [localizeError, roomCode],
  );

  const postIntent = useCallback(
    (intent: GradoviIntent) => {
      const run = requestQueue.current.catch(() => null).then(() => sendIntent(intent));
      requestQueue.current = run.catch(() => null);
      return run;
    },
    [sendIntent],
  );

  const flushPendingSaves = useCallback(async () => {
    const view = snapshot?.view;
    if (!view) return;

    Object.values(saveTimers.current).forEach((timer) => clearTimeout(timer));
    saveTimers.current = {};

    for (const category of view.categories) {
      await postIntent({
        kind: "set-answer",
        category,
        value: draftAnswers[category] ?? "",
      });
    }
  }, [draftAnswers, postIntent, snapshot?.view]);

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
      if (event.type === "lobby-update") void loadState();
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadState, roomCode, router]);

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach((timer) => clearTimeout(timer));
      if (warningFlashTimer.current) clearTimeout(warningFlashTimer.current);
      if (screenNoticeTimer.current) clearTimeout(screenNoticeTimer.current);
      if (timeUpNoticeTimer.current) clearTimeout(timeUpNoticeTimer.current);
      document.body.classList.remove("plaza-time-warning");
    };
  }, []);

  useEffect(() => {
    const view = snapshot?.view;
    if (!view) return;

    if (syncedRound.current !== view.round) {
      syncedRound.current = view.round;
      autoRevealRound.current = null;
      warningFlashRound.current = null;
      roundStartNoticeRound.current = null;
      timeUpNoticeRound.current = null;
      if (warningFlashTimer.current) clearTimeout(warningFlashTimer.current);
      if (screenNoticeTimer.current) clearTimeout(screenNoticeTimer.current);
      if (timeUpNoticeTimer.current) clearTimeout(timeUpNoticeTimer.current);
      setScreenNotice(null);
      setTimeUpNotice(false);
      document.body.classList.remove("plaza-time-warning");
      setDraftAnswers(view.myAnswers);
    }

    const settingsKey = `${view.settings.roundDurationSeconds}:${view.settings.totalRounds}`;
    if (syncedSettings.current !== settingsKey) {
      syncedSettings.current = settingsKey;
      setDraftSettings(view.settings);
    }

    const categoriesKey = view.categories.join("|");
    if (syncedCategories.current !== categoriesKey) {
      syncedCategories.current = categoriesKey;
      setDraftCategories(view.categories);
    }
  }, [snapshot?.view]);

  useEffect(() => {
    if (snapshot?.view.phase !== "writing") return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [snapshot?.view.phase]);

  const view = snapshot?.view ?? null;
  const remainingMs =
    view?.phase === "writing" && view.deadlineAt !== null
      ? Math.max(0, view.deadlineAt - now)
      : 0;
  const showFloatingTimer = view?.phase === "writing" && view.deadlineAt !== null;
  const timerIsUrgent = showFloatingTimer && remainingMs > 0 && remainingMs <= 15_000;
  const viewPhase = view?.phase;
  const roundDurationMs = view ? view.settings.roundDurationSeconds * 1000 : 0;
  const freshRoundStart =
    view?.phase === "writing" &&
    view.deadlineAt !== null &&
    remainingMs > Math.max(0, roundDurationMs - 5_000);

  useEffect(() => {
    if (!view || !freshRoundStart || timeUpNotice) return;
    if (roundStartNoticeRound.current === view.round) return;

    roundStartNoticeRound.current = view.round;
    showScreenNotice({
      kicker: t("gradovi.round", view.round, view.settings.totalRounds),
      title: view.round === 1 ? t("gradovi.notice.gameStart") : t("gradovi.notice.newRound"),
      note: t("gradovi.notice.letter", view.letter),
      tone: "start",
    });
  }, [freshRoundStart, showScreenNotice, t, timeUpNotice, view]);

  useEffect(() => {
    if (!view || view.phase !== "finished" || finalNoticeShown.current || timeUpNotice) return;

    finalNoticeShown.current = true;
    showScreenNotice({
      kicker: t("gradovi.round", view.round, view.settings.totalRounds),
      title: t("gradovi.notice.final"),
      note: t("gradovi.notice.finalNote"),
      tone: "final",
    });
  }, [showScreenNotice, t, timeUpNotice, view]);

  useEffect(() => {
    if (!view || view.phase !== "writing" || view.deadlineAt === null) return;
    if (remainingMs > 0 || autoRevealRound.current === view.round) return;

    autoRevealRound.current = view.round;
    if (timeUpNoticeRound.current !== view.round) {
      timeUpNoticeRound.current = view.round;
      setScreenNotice(null);
      if (screenNoticeTimer.current) clearTimeout(screenNoticeTimer.current);
      setTimeUpNotice(true);
      if (timeUpNoticeTimer.current) clearTimeout(timeUpNoticeTimer.current);
      timeUpNoticeTimer.current = null;
    }
    void flushPendingSaves().then(() => postIntent({ kind: "reveal" }));
  }, [flushPendingSaves, postIntent, remainingMs, view]);

  useEffect(() => {
    if (!timeUpNotice || !viewPhase || viewPhase === "writing") return;

    if (timeUpNoticeTimer.current) clearTimeout(timeUpNoticeTimer.current);
    timeUpNoticeTimer.current = setTimeout(() => {
      setTimeUpNotice(false);
      timeUpNoticeTimer.current = null;
    }, 700);

    return () => {
      if (timeUpNoticeTimer.current) clearTimeout(timeUpNoticeTimer.current);
    };
  }, [timeUpNotice, viewPhase]);

  useEffect(() => {
    if (!timerIsUrgent || !view || warningFlashRound.current === view.round) return;

    warningFlashRound.current = view.round;
    document.body.classList.remove("plaza-time-warning");
    window.requestAnimationFrame(() => document.body.classList.add("plaza-time-warning"));

    if (warningFlashTimer.current) clearTimeout(warningFlashTimer.current);
    warningFlashTimer.current = setTimeout(() => {
      document.body.classList.remove("plaza-time-warning");
      warningFlashTimer.current = null;
    }, 2200);
  }, [timerIsUrgent, view]);

  const scoreRows = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.players].sort(
      (a, b) =>
        (snapshot.view.scores[b.id] ?? 0) +
        (snapshot.view.phase === "review" ? totalRoundPoints(snapshot.view, b.id) : 0) -
        ((snapshot.view.scores[a.id] ?? 0) +
          (snapshot.view.phase === "review" ? totalRoundPoints(snapshot.view, a.id) : 0)),
    );
  }, [snapshot]);

  function updateAnswer(category: string, value: string) {
    setDraftAnswers((current) => ({ ...current, [category]: value }));

    const existingTimer = saveTimers.current[category];
    if (existingTimer) clearTimeout(existingTimer);

    saveTimers.current[category] = setTimeout(() => {
      delete saveTimers.current[category];
      void postIntent({ kind: "set-answer", category, value });
    }, AUTOSAVE_DELAY_MS);
  }

  function adjustDraftSetting(key: keyof GradoviSettings, delta: number, minTotalRounds: number) {
    setDraftSettings((current) => {
      if (key === "roundDurationSeconds") {
        return {
          ...current,
          roundDurationSeconds: clamp(
            current.roundDurationSeconds + delta,
            MIN_ROUND_DURATION_SECONDS,
            MAX_ROUND_DURATION_SECONDS,
          ),
        };
      }
      return {
        ...current,
        totalRounds: clamp(current.totalRounds + delta, minTotalRounds, MAX_TOTAL_ROUNDS),
      };
    });
  }

  function toggleDraftCategory(category: string) {
    setDraftCategories((current) => {
      const selected = new Set(current);
      if (selected.has(category)) {
        selected.delete(category);
      } else {
        selected.add(category);
      }
      return [
        ...DEFAULT_GRADOVI_CATEGORIES,
        ...OPTIONAL_GRADOVI_CATEGORIES.filter((option) => selected.has(option)),
      ];
    });
  }

  async function saveSettings(): Promise<boolean> {
    const view = snapshot?.view;
    if (!view?.isHost || view.phase === "writing" || view.phase === "finished") return false;

    const minTotalRounds =
      view.phase === "setup" ? MIN_TOTAL_ROUNDS : Math.max(MIN_TOTAL_ROUNDS, view.round + 1);
    const settingsResult = await postIntent({
      kind: "update-settings",
      settings: {
        roundDurationSeconds: clamp(
          draftSettings.roundDurationSeconds,
          MIN_ROUND_DURATION_SECONDS,
          MAX_ROUND_DURATION_SECONDS,
        ),
        totalRounds: clamp(draftSettings.totalRounds, minTotalRounds, MAX_TOTAL_ROUNDS),
      },
    });
    if (!settingsResult) return false;

    if (view.phase === "setup") {
      const categoriesResult = await postIntent({
        kind: "update-categories",
        categories: draftCategories,
      });
      if (!categoriesResult) return false;
    }

    return true;
  }

  async function startRound() {
    const saved = await saveSettings();
    if (!saved) return;
    await postIntent({ kind: "start-round" });
  }

  async function submitAnswers() {
    await flushPendingSaves();
    await postIntent({ kind: "submit" });
  }

  async function revealRound() {
    await flushPendingSaves();
    await postIntent({ kind: "reveal" });
  }

  async function reviewAnswer(
    targetPlayerId: string,
    category: string,
    status: "valid" | "invalid",
  ) {
    await postIntent({ kind: "review-answer", playerId: targetPlayerId, category, status });
  }

  async function reportAnswer(targetPlayerId: string, category: string) {
    await postIntent({ kind: "report-answer", playerId: targetPlayerId, category });
  }

  async function lockRound() {
    await postIntent({ kind: "lock-round" });
  }

  async function runAiValidation() {
    setIsCheckingAi(true);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/gradovi-ai`, {
        method: "POST",
      });
      if (!response.ok) {
        setError(localizeError(await readError(response)));
        return;
      }
      const data = (await response.json()) as GradoviSnapshot;
      setSnapshot(data);
      setError(data.warning ? localizeError(data.warning) : null);
    } finally {
      setIsCheckingAi(false);
    }
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

  if (!snapshot || !view) {
    return (
      <RoomBody>
        <RoomLoading rows={5} />
      </RoomBody>
    );
  }

  const meSubmitted = view.submitted[playerId] ?? false;
  const submittedCount = snapshot.players.filter((player) => view.submitted[player.id]).length;
  const filledCount = view.categories.filter(
    (category) => (draftAnswers[category] ?? "").trim().length > 0,
  ).length;
  const timerPercent =
    view.phase === "writing" ? Math.max(0, Math.min(100, (remainingMs / roundDurationMs) * 100)) : 0;
  const writingDisabled = view.phase !== "writing" || meSubmitted || remainingMs <= 0;
  const minTotalRounds =
    view.phase === "setup" ? MIN_TOTAL_ROUNDS : Math.max(MIN_TOTAL_ROUNDS, view.round + 1);
  const canConfigure = view.isHost && (view.phase === "setup" || view.phase === "reveal");
  const canConfigureCategories = view.isHost && view.phase === "setup";
  const phaseTitle =
    view.phase === "setup"
      ? t("gradovi.phase.setup")
      : view.phase === "writing"
        ? t("gradovi.phase.writing")
        : view.phase === "review"
          ? t("gradovi.phase.review")
          : view.phase === "finished"
            ? t("gradovi.phase.finished")
            : t("gradovi.phase.reveal");

  const settingsControls = (
    <section>
      <h3 className="rm-eyebrow mb-3 block">{t("gradovi.settings.title")}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <SettingStepper
          label={t("gradovi.settings.roundTime")}
          value={draftSettings.roundDurationSeconds}
          unit={t("gradovi.settings.seconds")}
          disabled={!canConfigure || isSending}
          onAdjust={(delta) => adjustDraftSetting("roundDurationSeconds", delta, minTotalRounds)}
          step={15}
        />
        <SettingStepper
          label={t("gradovi.settings.rounds")}
          value={draftSettings.totalRounds}
          disabled={!canConfigure || isSending}
          onAdjust={(delta) => adjustDraftSetting("totalRounds", delta, minTotalRounds)}
          step={1}
        />
      </div>
      <p className="plaza-muted mt-2 text-xs">
        {t("gradovi.settings.note", MIN_ROUND_DURATION_SECONDS, MAX_TOTAL_ROUNDS)}
      </p>
      {view.phase === "setup" && (
        <div className="mt-5 grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="plaza-label">{t("gradovi.categories.optional")}</h4>
            <span className="plaza-chip rounded-full px-2.5 py-1 text-xs font-semibold">
              {t("gradovi.categories.selected", draftCategories.length)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_GRADOVI_CATEGORIES.map((category) => (
              <span
                key={category}
                className="plaza-chip rounded-full px-3 py-1.5 text-xs font-medium opacity-80"
              >
                🔒 {category}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {OPTIONAL_GRADOVI_CATEGORIES.map((category) => {
              const checked = draftCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={checked}
                  disabled={!canConfigureCategories || isSending}
                  onClick={() => toggleDraftCategory(category)}
                  className={`plaza-select-card rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                    checked ? "plaza-select-card--selected" : ""
                  }`}
                >
                  {checked ? "✓ " : "+ "}
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );

  const overlays = (
    <>
      {!timeUpNotice && screenNotice && (
        <div className="plaza-screen-overlay" data-tone={screenNotice.tone}>
          <div className="plaza-screen-content">
            <p className="plaza-screen-kicker">{screenNotice.kicker}</p>
            <p className="plaza-screen-title">{screenNotice.title}</p>
            <p className="plaza-screen-note">{screenNotice.note}</p>
          </div>
        </div>
      )}
      {timeUpNotice && (
        <div className="plaza-time-up-overlay">
          <div className="plaza-time-up-content">
            <p className="plaza-time-up-kicker">
              {t("gradovi.round", view.round, view.settings.totalRounds)}
            </p>
            <p className="plaza-time-up-title">{t("gradovi.timeUp")}</p>
            <p className="plaza-time-up-note">{t("gradovi.timeUpNote")}</p>
          </div>
        </div>
      )}
    </>
  );

  // ------------------------------------------------------- 11 · writing
  if (view.phase === "writing") {
    return (
      <>
        {overlays}

        {/* The letter is the round's identity, so it leads the header. */}
        <div className="rm-content flex items-center gap-3.5 px-5 pb-3.5 pt-[1.125rem] sm:px-6">
          <span
            className="rm-letter-tile"
            aria-label={t("gradovi.notice.letter", view.letter)}
          >
            {view.letter}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="rm-eyebrow">
              {t("gradovi.roundLetter", view.round, view.settings.totalRounds)}
            </span>
            <span className="text-[0.94rem] font-semibold">
              {filledCount > 0
                ? t("gradovi.filled", filledCount, view.categories.length)
                : t("gradovi.fillCategories", view.categories.length)}
            </span>
            <span className="plaza-muted-2 text-[0.72rem]">
              {t("gradovi.playersDone", submittedCount, snapshot.players.length)}
            </span>
          </span>
          <span
            className={`rm-timer shrink-0 ${timerIsUrgent ? "rm-timer--danger" : ""}`}
            role="timer"
            aria-live="polite"
            aria-label={`${timerIsUrgent ? t("gradovi.timerWarning") : t("gradovi.timer")}: ${formatTime(remainingMs)}`}
          >
            {formatTime(remainingMs)}
          </span>
        </div>

        <div className="rm-content px-5 sm:px-6">
          <span className="rm-track rm-track--thin">
            <span
              className={`rm-track__fill ${timerIsUrgent ? "rm-track__fill--danger" : ""}`}
              style={{ width: `${timerPercent}%` }}
            />
          </span>
        </div>

        <RoomBody className="p-5 sm:p-6">
          <RoomContent className="gap-2">
          {error && <RoomError message={error} />}
          <div className="grid gap-2 lg:grid-cols-2">
          {view.categories.map((category) => {
            const value = draftAnswers[category] ?? "";
            const filled = value.trim().length > 0;
            return (
              <label key={category} className="rm-field-row">
                <span className="rm-field-row__label">{category}</span>
                <input
                  value={value}
                  maxLength={40}
                  disabled={writingDisabled}
                  onChange={(event) => updateAnswer(category, event.target.value)}
                  className="rm-field-row__input"
                  placeholder={t("gradovi.answerPlaceholder", category, view.letter)}
                />
                {filled && (
                  <span className="shrink-0 text-[var(--plaza-success)]" aria-hidden="true">
                    <CheckIcon size={14} />
                  </span>
                )}
              </label>
            );
          })}
          </div>
          </RoomContent>
        </RoomBody>

        <RoomBottomBar
          note={meSubmitted ? t("gradovi.locked") : t("gradovi.stopNote")}
        >
          <button
            type="button"
            disabled={writingDisabled || isSending}
            onClick={() => void submitAnswers()}
            className="plaza-button rm-cta disabled:opacity-50"
          >
            {isSending ? t("gradovi.saving") : t("gradovi.doneStop")}
          </button>
          {view.isHost && (
            <button
              type="button"
              disabled={isSending}
              onClick={() => void revealRound()}
              className="plaza-ghost-button mx-auto rounded-lg px-3 py-1.5 text-[0.78rem] font-medium disabled:opacity-50"
            >
              {t("gradovi.reveal")}
            </button>
          )}
        </RoomBottomBar>
      </>
    );
  }

  // ------------------------------------------- setup / review / reveal / finished
  return (
    <>
      {overlays}

      <PhaseHeader
        eyebrow={t("gradovi.round", view.round, view.settings.totalRounds)}
        title={phaseTitle}
        right={
          view.phase !== "setup" ? (
            <span
              className="rm-letter-tile h-11 w-11 rounded-xl text-xl"
              aria-label={t("gradovi.notice.letter", view.letter)}
            >
              {view.letter}
            </span>
          ) : undefined
        }
      />

      <RoomBody className="p-5 sm:p-6">
        <RoomContent className="gap-5">
        {error && <RoomError message={error} />}

        {canConfigure && settingsControls}

        {view.phase === "finished" && scoreRows.length > 0 && (
          <div className="plaza-winner-card rounded-3xl px-5 py-7 text-center">
            <p className="rm-eyebrow">{t("gradovi.winner")}</p>
            <p className="rm-display mt-2 text-[1.75rem] font-extrabold">
              {scoreRows[0].nickname}
            </p>
            <p className="plaza-muted mt-1 text-[0.84rem]">
              {t("song.finalScore", view.scores[scoreRows[0].id] ?? 0)}
            </p>
          </div>
        )}

        {view.phase !== "setup" && (
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
                  score={
                    view.phase === "review" ? (
                      <>
                        {view.scores[player.id] ?? 0}
                        <span className="plaza-status-valid ml-1.5 rounded px-1.5 py-0.5 text-[0.69rem]">
                          +{totalRoundPoints(view, player.id)}
                        </span>
                      </>
                    ) : (
                      (view.scores[player.id] ?? 0)
                    )
                  }
                />
              ))}
            </ol>
          </section>
        )}

        {view.allAnswers && (
          <section className="grid gap-2.5">
            <h3 className="rm-eyebrow">{t("gradovi.answers")}</h3>
            <div className="grid gap-3">
              {view.categories.map((category) => (
                <div key={category} className="plaza-card overflow-hidden rounded-[0.875rem]">
                  <div className="plaza-divider plaza-subtle border-b px-3 py-2 text-[0.81rem] font-semibold">
                    {category}
                  </div>
                  <div className="divide-y divide-[var(--plaza-line)]">
                    {snapshot.players.map((player) => {
                      const answer = view.allAnswers?.[player.id]?.[category] ?? "";
                      const points = view.roundScores[player.id]?.[category] ?? 0;
                      const validation = view.validations?.[player.id]?.[category];
                      const status = validation?.status ?? "needs-review";
                      const reportedByMe = validation?.reports.includes(playerId) ?? false;
                      return (
                        <div key={player.id} className="grid gap-2.5 px-3 py-3 text-[0.81rem]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="plaza-muted text-[0.69rem]">{player.nickname}</p>
                              <p className="mt-0.5 break-words font-medium">{answer || "—"}</p>
                              {validation && (
                                <p className="plaza-muted-2 mt-1 break-words text-[0.69rem] leading-relaxed">
                                  {validation.reason}
                                  {validation.reports.length > 0 &&
                                    ` / ${t("gradovi.reportCount", validation.reports.length)}`}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <span
                                className={`rm-chip ${
                                  status === "valid"
                                    ? "rm-chip--valid"
                                    : status === "invalid"
                                      ? "rm-chip--danger"
                                      : "rm-chip--neutral"
                                }`}
                              >
                                {status === "needs-review"
                                  ? t("gradovi.status.review")
                                  : t(`gradovi.status.${status}`)}
                              </span>
                              <span
                                className={`rm-numeric rounded-full px-2 py-0.5 text-[0.69rem] ${
                                  points > 0 ? "plaza-status-valid" : "plaza-chip plaza-muted"
                                }`}
                              >
                                +{points}
                              </span>
                            </div>
                          </div>
                          {view.phase === "review" && (
                            <div className="flex flex-wrap items-center gap-2">
                              {view.isHost && answer && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isSending}
                                    onClick={() =>
                                      void reviewAnswer(player.id, category, "valid")
                                    }
                                    className="plaza-button-secondary h-8 rounded-lg px-2.5 text-[0.69rem] font-medium disabled:opacity-50"
                                  >
                                    ✓ {t("gradovi.valid")}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSending}
                                    onClick={() =>
                                      void reviewAnswer(player.id, category, "invalid")
                                    }
                                    className="plaza-button-secondary h-8 rounded-lg px-2.5 text-[0.69rem] font-medium disabled:opacity-50"
                                  >
                                    ✕ {t("gradovi.invalid")}
                                  </button>
                                </>
                              )}
                              {!view.isHost && player.id !== playerId && answer && (
                                <button
                                  type="button"
                                  disabled={reportedByMe || isSending}
                                  onClick={() => void reportAnswer(player.id, category)}
                                  className="plaza-button-secondary h-8 rounded-lg px-2.5 text-[0.69rem] font-medium disabled:opacity-50"
                                >
                                  {reportedByMe ? t("gradovi.reported") : t("gradovi.report")}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        </RoomContent>
      </RoomBody>

      <RoomBottomBar
        note={
          view.phase === "finished" && !view.isHost ? t("gradovi.hostCloseNote") : undefined
        }
      >
        {view.phase === "setup" &&
          (view.isHost ? (
            <>
              <button
                type="button"
                disabled={isSending}
                onClick={() => void startRound()}
                className="plaza-button rm-cta disabled:opacity-50"
              >
                {t("gradovi.startRound", 1)}
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={() => void saveSettings()}
                className="plaza-ghost-button mx-auto rounded-lg px-3 py-1.5 text-[0.78rem] font-medium disabled:opacity-50"
              >
                {t("gradovi.saveSettings")}
              </button>
            </>
          ) : (
            <WaitingNote>{t("gradovi.waitStartRound", 1)}</WaitingNote>
          ))}

        {view.phase === "review" &&
          (view.isHost ? (
            <>
              <button
                type="button"
                disabled={isSending || isCheckingAi}
                onClick={() => void lockRound()}
                className="plaza-button rm-cta disabled:opacity-50"
              >
                {t("gradovi.lockScores")}
              </button>
              <button
                type="button"
                disabled={isSending || isCheckingAi}
                onClick={() => void runAiValidation()}
                className="plaza-button-secondary h-12 rounded-[0.875rem] text-[0.84rem] font-semibold disabled:opacity-50"
              >
                {isCheckingAi ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="plaza-floating-timer-dot animate-pulse" aria-hidden="true" />
                    {t("gradovi.aiChecking")}
                  </span>
                ) : (
                  `✨ ${t("gradovi.aiCheck")}`
                )}
              </button>
            </>
          ) : (
            <WaitingNote>{t("gradovi.waitingHostReview")}</WaitingNote>
          ))}

        {view.phase === "reveal" &&
          (view.isHost ? (
            <button
              type="button"
              disabled={isSending}
              onClick={() => void startRound()}
              className="plaza-button rm-cta disabled:opacity-50"
            >
              {t("gradovi.startRound", view.round + 1)}
            </button>
          ) : (
            <WaitingNote>{t("gradovi.waitingForHost")}</WaitingNote>
          ))}

        {view.phase === "finished" &&
          (view.isHost ? (
            <button
              type="button"
              disabled={isSending}
              onClick={() => void finishSession()}
              className="plaza-button rm-cta disabled:opacity-50"
            >
              {t("gradovi.backToLaunchpad")}
            </button>
          ) : (
            <WaitingNote>{t("gradovi.waitingForHost")}</WaitingNote>
          ))}
      </RoomBottomBar>
    </>
  );
}

function SettingStepper({
  label,
  value,
  unit,
  step,
  disabled,
  onAdjust,
}: {
  label: string;
  value: number;
  unit?: string;
  step: number;
  disabled: boolean;
  onAdjust: (delta: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="plaza-label">{label}</span>
      <div className="plaza-input flex h-12 items-center justify-between rounded-xl">
        <button
          type="button"
          aria-label={`${label} −${step}`}
          disabled={disabled}
          onClick={() => onAdjust(-step)}
          className="plaza-stepper-button h-full w-12 rounded-l-xl text-lg font-semibold disabled:opacity-30"
        >
          −
        </button>
        <span className="px-1 font-mono text-base font-semibold tabular-nums">
          {value}
          {unit ? <span className="plaza-muted ml-1 text-xs font-normal">{unit}</span> : null}
        </span>
        <button
          type="button"
          aria-label={`${label} +${step}`}
          disabled={disabled}
          onClick={() => onAdjust(step)}
          className="plaza-stepper-button h-full w-12 rounded-r-xl text-lg font-semibold disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
