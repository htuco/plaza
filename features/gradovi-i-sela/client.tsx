"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
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
import type {
  AnswerValidationStatus,
  GradoviIntent,
  GradoviSettings,
  GradoviView,
} from "./types";

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

function statusClasses(status: AnswerValidationStatus): string {
  if (status === "valid") {
    return "plaza-status-valid";
  }
  if (status === "invalid") {
    return "plaza-status-invalid";
  }
  return "plaza-status-review";
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

  const playersById = useMemo(() => {
    return new Map(snapshot?.players.map((player) => [player.id, player]) ?? []);
  }, [snapshot?.players]);

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

  function updateDraftSettings(key: keyof GradoviSettings, value: string, minTotalRounds: number) {
    const parsed = Number.parseInt(value, 10);
    const nextValue = Number.isFinite(parsed) ? parsed : 0;
    setDraftSettings((current) => {
      if (key === "roundDurationSeconds") {
        return {
          ...current,
          roundDurationSeconds: clamp(
            nextValue,
            MIN_ROUND_DURATION_SECONDS,
            MAX_ROUND_DURATION_SECONDS,
          ),
        };
      }
      return {
        ...current,
        totalRounds: clamp(nextValue, minTotalRounds, MAX_TOTAL_ROUNDS),
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
      <div className="plaza-panel rounded-lg p-5">
        <div className="plaza-skeleton h-5 w-32 rounded" />
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="plaza-skeleton h-11 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const meSubmitted = view.submitted[playerId] ?? false;
  const submittedCount = snapshot.players.filter((player) => view.submitted[player.id]).length;
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
      <h3 className="plaza-label mb-3">{t("gradovi.settings.title")}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="plaza-label">{t("gradovi.settings.roundTime")}</span>
          <div className="plaza-input grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-lg">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draftSettings.roundDurationSeconds}
              disabled={!canConfigure || isSending}
              onChange={(event) =>
                updateDraftSettings("roundDurationSeconds", event.target.value, minTotalRounds)
              }
              className="h-11 min-w-0 bg-transparent px-3 text-base outline-none disabled:text-[var(--plaza-muted-2)]"
            />
            <span className="plaza-muted pr-3 text-sm">{t("gradovi.settings.seconds")}</span>
          </div>
        </label>

        <label className="grid gap-1.5">
          <span className="plaza-label">{t("gradovi.settings.rounds")}</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draftSettings.totalRounds}
            disabled={!canConfigure || isSending}
            onChange={(event) =>
              updateDraftSettings("totalRounds", event.target.value, minTotalRounds)
            }
            className="plaza-input h-11 rounded-lg px-3 text-base"
          />
        </label>
      </div>
      <p className="plaza-muted mt-2 text-xs">
        {t("gradovi.settings.note", MIN_ROUND_DURATION_SECONDS, MAX_TOTAL_ROUNDS)}
      </p>
      {view.phase === "setup" && (
        <div className="mt-5 grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="plaza-label">{t("gradovi.categories.optional")}</h4>
            <span className="plaza-muted text-xs">
              {t("gradovi.categories.selected", draftCategories.length)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_GRADOVI_CATEGORIES.map((category) => (
              <span key={category} className="plaza-chip rounded-full px-3 py-1 text-xs">
                {category}
              </span>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {OPTIONAL_GRADOVI_CATEGORIES.map((category) => (
              <label
                key={category}
                className="plaza-card flex h-11 items-center gap-2 rounded-lg px-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={draftCategories.includes(category)}
                  disabled={!canConfigureCategories || isSending}
                  onChange={() => toggleDraftCategory(category)}
                  className="h-4 w-4 accent-[var(--plaza-accent)] disabled:opacity-50"
                />
                <span className="min-w-0 truncate">{category}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );

  return (
    <>
      {showFloatingTimer && (
        <div
          aria-label={`${timerIsUrgent ? t("gradovi.timerWarning") : t("gradovi.timer")}: ${formatTime(remainingMs)}`}
          aria-live="polite"
          className="plaza-floating-timer"
          data-urgent={timerIsUrgent ? "true" : "false"}
          role="timer"
        >
          <span className="plaza-floating-timer-dot" aria-hidden="true" />
          <span className="font-mono tabular-nums">{formatTime(remainingMs)}</span>
        </div>
      )}
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
      <div className="plaza-panel rounded-lg">
      <div className="plaza-divider border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="plaza-label">
              {t("gradovi.round", view.round, view.settings.totalRounds)}
            </p>
            <h2 className="truncate text-lg font-semibold">{phaseTitle}</h2>
          </div>
          <div className="flex items-center gap-2">
            {view.phase === "writing" && (
              <span className="plaza-input rounded-lg px-3 py-2 font-mono text-sm">
                {formatTime(remainingMs)}
              </span>
            )}
            {view.phase !== "setup" && (
              <span className="plaza-code grid h-12 w-12 place-items-center rounded-lg text-2xl font-semibold">
                {view.letter}
              </span>
            )}
          </div>
        </div>

        {view.phase === "writing" && (
          <div className="mt-4">
            <div className="plaza-progress h-1.5 overflow-hidden rounded-full">
              <div
                className="plaza-progress-fill h-full rounded-full transition-[width]"
                style={{ width: `${timerPercent}%` }}
              />
            </div>
            <div className="plaza-muted mt-2 flex items-center justify-between text-xs">
              <span>
                {t("gradovi.submitted", submittedCount, snapshot.players.length)}
              </span>
              {meSubmitted && <span>{t("gradovi.locked")}</span>}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="plaza-error border-b px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {view.phase === "setup" ? (
        <div className="grid gap-5 p-4">
          {settingsControls}

          {view.isHost ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={isSending}
                onClick={() => void saveSettings()}
                className="plaza-button-secondary h-11 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {t("gradovi.saveSettings")}
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={() => void startRound()}
                className="plaza-button h-11 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {t("gradovi.startRound", 1)}
              </button>
            </div>
          ) : (
            <p className="plaza-muted text-sm">{t("gradovi.waitStartRound", 1)}</p>
          )}
        </div>
      ) : view.phase === "writing" ? (
        <div className="p-4">
          <div className="grid gap-3">
            {view.categories.map((category) => (
              <label key={category} className="grid gap-1.5">
                <span className="plaza-label">{category}</span>
                <input
                  value={draftAnswers[category] ?? ""}
                  maxLength={40}
                  disabled={writingDisabled}
                  onChange={(event) => updateAnswer(category, event.target.value)}
                  className="plaza-input h-11 rounded-lg px-3 text-base"
                  placeholder={t("gradovi.answerPlaceholder", category, view.letter)}
                />
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={writingDisabled || isSending}
              onClick={() => void submitAnswers()}
              className="plaza-button h-11 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {isSending ? t("gradovi.saving") : t("gradovi.submitAnswers")}
            </button>
            <button
              type="button"
              disabled={!view.isHost || isSending}
              onClick={() => void revealRound()}
              className="plaza-button-secondary h-11 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {t("gradovi.reveal")}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 p-4">
          {canConfigure && settingsControls}
          {canConfigure && (
            <button
              type="button"
              disabled={isSending}
              onClick={() => void saveSettings()}
              className="plaza-button-secondary h-11 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {t("gradovi.saveSettings")}
            </button>
          )}

          <section>
            <h3 className="plaza-label mb-2">{t("gradovi.scoreboard")}</h3>
            <ol className="grid gap-2">
              {scoreRows.map((player, index) => (
                <li
                  key={player.id}
                  className="plaza-subtle flex h-10 items-center justify-between rounded-lg px-3 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {index + 1}. {player.nickname}
                    {player.id === playerId && (
                      <span className="plaza-muted-2 ml-1 text-xs">{t("gradovi.you")}</span>
                    )}
                  </span>
                  <span className="font-mono">
                    {view.phase === "review"
                      ? `${view.scores[player.id] ?? 0}+${totalRoundPoints(view, player.id)}`
                      : (view.scores[player.id] ?? 0)}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {view.allAnswers && (
            <section>
              <h3 className="plaza-label mb-2">{t("gradovi.answers")}</h3>
              <div className="grid gap-3">
                {view.categories.map((category) => (
                  <div
                    key={category}
                    className="plaza-card rounded-lg"
                  >
                    <div className="plaza-divider border-b px-3 py-2 text-sm font-medium">
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
                          <div key={player.id} className="grid gap-3 px-3 py-3 text-sm">
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                              <div className="min-w-0">
                                <p className="plaza-muted text-xs">{player.nickname}</p>
                                <p className="mt-0.5 break-words font-medium">{answer || "-"}</p>
                                {validation && (
                                  <p className="plaza-muted-2 mt-1 break-words text-xs leading-relaxed">
                                    {validation.reason}
                                    {validation.reports.length > 0 &&
                                      ` / ${t("gradovi.reportCount", validation.reports.length)}`}
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                                <span
                                  className={`rounded px-2 py-1 text-xs font-medium ${statusClasses(status)}`}
                                >
                                  {status === "needs-review"
                                    ? t("gradovi.status.review")
                                    : t(`gradovi.status.${status}`)}
                                </span>
                                <span
                                  className={`rounded px-2 py-1 font-mono text-xs ${
                                    points > 0
                                      ? "plaza-status-valid"
                                      : "plaza-chip plaza-muted"
                                  }`}
                                >
                                  +{points}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              {view.phase === "review" && view.isHost && answer && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isSending}
                                    onClick={() => void reviewAnswer(player.id, category, "valid")}
                                    className="plaza-button-secondary h-8 rounded px-2 text-xs font-medium disabled:opacity-50"
                                  >
                                    {t("gradovi.valid")}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSending}
                                    onClick={() =>
                                      void reviewAnswer(player.id, category, "invalid")
                                    }
                                    className="plaza-button-secondary h-8 rounded px-2 text-xs font-medium disabled:opacity-50"
                                  >
                                    {t("gradovi.invalid")}
                                  </button>
                                </>
                              )}
                              {view.phase === "review" && !view.isHost && player.id !== playerId && answer && (
                                <button
                                  type="button"
                                  disabled={reportedByMe || isSending}
                                  onClick={() => void reportAnswer(player.id, category)}
                                  className="plaza-button-secondary h-8 rounded px-2 text-xs font-medium disabled:opacity-50"
                                >
                                  {reportedByMe ? t("gradovi.reported") : t("gradovi.report")}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {view.phase === "review" ? (
            <div className={`grid gap-2 ${view.isHost ? "sm:grid-cols-2" : ""}`}>
              {view.isHost && (
                <button
                  type="button"
                  disabled={isSending || isCheckingAi}
                  onClick={() => void runAiValidation()}
                  className="plaza-button-secondary h-11 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {isCheckingAi ? t("gradovi.aiChecking") : t("gradovi.aiCheck")}
                </button>
              )}
              <button
                type="button"
                disabled={!view.isHost || isSending || isCheckingAi}
                onClick={() => void lockRound()}
                className="plaza-button h-11 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {view.isHost ? t("gradovi.lockScores") : t("gradovi.waitingHostReview")}
              </button>
            </div>
          ) : (
            <div className="grid gap-2">
              {view.phase === "finished" ? (
                <>
                  <button
                    type="button"
                    disabled={!view.isHost || isSending}
                    onClick={() => void finishSession()}
                    className="plaza-button h-11 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {view.isHost ? t("gradovi.backToLaunchpad") : t("gradovi.waitingForHost")}
                  </button>
                  {!view.isHost && (
                    <p className="plaza-muted text-center text-xs">
                      {t("gradovi.hostCloseNote")}
                    </p>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  disabled={!view.isHost || isSending}
                  onClick={() => void startRound()}
                  className="plaza-button h-11 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {view.isHost
                    ? t("gradovi.startRound", view.round + 1)
                    : t("gradovi.waitingForHost")}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="plaza-divider plaza-muted-2 border-t px-4 py-3 text-xs">
        {snapshot.players.map((player) => playersById.get(player.id)?.nickname).join(", ")}
      </div>
      </div>
    </>
  );
}
