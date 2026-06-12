"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import { createClient } from "@/lib/supabase/client";
import { subscribeToRoom } from "@/lib/realtime/channels";
import { COLUMN_LABELS } from "./types";
import type { AsocijacijeIntent, AsocijacijeView } from "./types";

const GAME_ID = "asocijacije";

type PlayerSummary = {
  id: string;
  nickname: string;
  isHost: boolean;
};

type AsocijacijeSnapshot = {
  gameId: typeof GAME_ID;
  playerId: string;
  players: PlayerSummary[];
  view: AsocijacijeView;
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

export function AsocijacijeClient({
  roomCode,
  playerId,
}: {
  roomCode: string;
  playerId: string;
}) {
  const router = useRouter();
  const { localizeError, t } = usePreferences();
  const [snapshot, setSnapshot] = useState<AsocijacijeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  // Which guess target just failed, for a quick shake/flash: "col-0".."col-3" | "final"
  const [wrongTarget, setWrongTarget] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/state`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setError(localizeError(await readError(response)));
      return;
    }
    setSnapshot((await response.json()) as AsocijacijeSnapshot);
    setError(null);
  }, [localizeError, roomCode]);

  const sendIntent = useCallback(
    async (intent: AsocijacijeIntent): Promise<{ ok: boolean; message?: string }> => {
      setIsSending(true);
      try {
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: GAME_ID, intent }),
        });
        if (!response.ok) {
          const message = await readError(response);
          return { ok: false, message };
        }
        setSnapshot((await response.json()) as AsocijacijeSnapshot);
        setError(null);
        return { ok: true };
      } finally {
        setIsSending(false);
      }
    },
    [roomCode],
  );

  async function actionIntent(intent: AsocijacijeIntent) {
    const result = await sendIntent(intent);
    if (!result.ok && result.message) setError(localizeError(result.message));
  }

  async function guess(target: string, intent: AsocijacijeIntent): Promise<boolean> {
    setWrongTarget(null);
    const result = await sendIntent(intent);
    if (result.ok) return true;
    if (result.message === "Wrong guess.") {
      setWrongTarget(target);
      window.setTimeout(() => setWrongTarget((current) => (current === target ? null : current)), 1400);
    } else if (result.message) {
      setError(localizeError(result.message));
    }
    return false;
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

  const playersById = useMemo(
    () => new Map(snapshot?.players.map((player) => [player.id, player]) ?? []),
    [snapshot?.players],
  );

  const view = snapshot?.view ?? null;

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
        <div className="mt-4 grid grid-cols-2 gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="plaza-skeleton h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const solvedCount = view.columns.filter((column) => column.solution !== null).length;

  return (
    <div className="grid gap-4">
      <div className="plaza-panel rounded-xl">
        <div className="plaza-divider border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="plaza-label">{t("asocijacije.board", view.round)}</p>
              <h2 className="truncate text-lg font-semibold">
                {view.phase === "setup"
                  ? t("asocijacije.phase.setup")
                  : view.phase === "finished"
                    ? t("asocijacije.phase.finished")
                    : t("asocijacije.phase.playing")}
              </h2>
            </div>
            {view.phase !== "setup" && (
              <span className="plaza-chip rounded-full px-3 py-1.5 text-xs font-semibold">
                {t("asocijacije.solvedCount", solvedCount)}
              </span>
            )}
          </div>
        </div>

        {error && <div className="plaza-error border-b px-4 py-3 text-sm">{error}</div>}

        {view.phase === "setup" ? (
          <div className="grid gap-4 p-4">
            <ul className="grid gap-1.5 text-sm">
              {[
                t("asocijacije.rule1"),
                t("asocijacije.rule2"),
                t("asocijacije.rule3"),
              ].map((rule) => (
                <li key={rule} className="plaza-muted flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--plaza-accent)]" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
            {view.isHost ? (
              <button
                type="button"
                disabled={isSending}
                onClick={() => void actionIntent({ kind: "start-game" })}
                className="plaza-button h-12 rounded-xl text-base font-semibold disabled:opacity-50"
              >
                {t("asocijacije.start")}
              </button>
            ) : (
              <p className="plaza-muted text-sm">{t("asocijacije.waitingForHost")}</p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 p-4">
            {/* Final solution */}
            <FinalCard
              view={view}
              playersById={playersById}
              disabled={isSending || view.phase === "finished"}
              wrong={wrongTarget === "final"}
              onGuess={(value) => guess("final", { kind: "guess-final", guess: value })}
              t={t}
            />

            {/* Columns */}
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {view.columns.map((column, columnIndex) => (
                <ColumnCard
                  key={columnIndex}
                  label={COLUMN_LABELS[columnIndex]}
                  column={column}
                  playersById={playersById}
                  disabled={isSending || view.phase === "finished"}
                  wrong={wrongTarget === `col-${columnIndex}`}
                  onReveal={(field) =>
                    void actionIntent({ kind: "reveal-hint", column: columnIndex, field })
                  }
                  onGuess={(value) =>
                    guess(`col-${columnIndex}`, {
                      kind: "guess-column",
                      column: columnIndex,
                      guess: value,
                    })
                  }
                  t={t}
                />
              ))}
            </div>

            {/* Scoreboard */}
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
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {view.scores[player.id] ?? 0}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {view.phase === "playing" && view.isHost && (
              <button
                type="button"
                disabled={isSending}
                onClick={() => void actionIntent({ kind: "reveal-all" })}
                className="plaza-ghost-button h-10 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {t("asocijacije.revealAll")}
              </button>
            )}

            {view.phase === "finished" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!view.isHost || isSending}
                  onClick={() => void actionIntent({ kind: "play-again" })}
                  className="plaza-button h-12 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {view.isHost ? t("asocijacije.nextBoard") : t("gradovi.waitingForHost")}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnCard({
  label,
  column,
  playersById,
  disabled,
  wrong,
  onReveal,
  onGuess,
  t,
}: {
  label: string;
  column: AsocijacijeView["columns"][number];
  playersById: Map<string, PlayerSummary>;
  disabled: boolean;
  wrong: boolean;
  onReveal: (field: number) => void;
  onGuess: (value: string) => Promise<boolean>;
  t: (key: string, ...args: Array<string | number>) => string;
}) {
  const [value, setValue] = useState("");
  const solved = column.solution !== null;
  const solver = column.solvedBy ? playersById.get(column.solvedBy) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    const ok = await onGuess(value);
    if (ok) setValue("");
  }

  return (
    <section
      className={`plaza-asoc-column rounded-xl ${solved ? "plaza-asoc-column--solved" : ""} ${wrong ? "plaza-shake" : ""}`}
      aria-label={t("asocijacije.columnAria", label)}
    >
      <div className="grid gap-1.5 p-2.5">
        {column.hints.map((hint, fieldIndex) => {
          const revealed = hint !== null;
          return (
            <button
              key={fieldIndex}
              type="button"
              disabled={disabled || revealed || solved}
              onClick={() => onReveal(fieldIndex)}
              className={`plaza-asoc-cell h-11 rounded-lg px-2 text-sm font-medium ${
                revealed ? "plaza-asoc-cell--revealed" : ""
              }`}
            >
              {revealed ? hint : `${label}${fieldIndex + 1}`}
            </button>
          );
        })}
        {solved ? (
          <div className="plaza-asoc-solution rounded-lg px-2 py-2 text-center">
            <p className="text-sm font-bold uppercase tracking-wide">{column.solution}</p>
            {solver && <p className="plaza-muted mt-0.5 text-xs">{solver.nickname}</p>}
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="flex gap-1.5">
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={disabled}
              maxLength={40}
              placeholder={label}
              aria-label={t("asocijacije.guessColumnAria", label)}
              className="plaza-input h-10 w-full min-w-0 rounded-lg px-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={disabled || !value.trim()}
              className="plaza-button h-10 shrink-0 rounded-lg px-3 text-xs font-semibold disabled:opacity-40"
            >
              {t("asocijacije.guess")}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function FinalCard({
  view,
  playersById,
  disabled,
  wrong,
  onGuess,
  t,
}: {
  view: AsocijacijeView;
  playersById: Map<string, PlayerSummary>;
  disabled: boolean;
  wrong: boolean;
  onGuess: (value: string) => Promise<boolean>;
  t: (key: string, ...args: Array<string | number>) => string;
}) {
  const [value, setValue] = useState("");
  const solved = view.finalSolution !== null;
  const solver = view.finalSolvedBy ? playersById.get(view.finalSolvedBy) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    const ok = await onGuess(value);
    if (ok) setValue("");
  }

  return (
    <section
      className={`plaza-asoc-final rounded-xl p-4 text-center ${wrong ? "plaza-shake" : ""} ${
        solved ? "plaza-asoc-final--won" : ""
      }`}
      aria-label={t("asocijacije.finalAria")}
    >
      <p className="plaza-label">{t("asocijacije.finalSolution")}</p>
      {solved ? (
        <>
          <p className="mt-1.5 text-2xl font-bold uppercase tracking-wide">
            {view.finalSolution}
          </p>
          {solver ? (
            <p className="plaza-muted mt-1 text-sm">{t("asocijacije.solvedBy", solver.nickname)}</p>
          ) : (
            <p className="plaza-muted mt-1 text-sm">{t("asocijacije.revealedByHost")}</p>
          )}
        </>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="mx-auto mt-2 flex max-w-sm gap-2">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={disabled}
            maxLength={40}
            placeholder={t("asocijacije.finalPlaceholder")}
            aria-label={t("asocijacije.finalAria")}
            className="plaza-input h-11 w-full min-w-0 rounded-lg px-3 text-sm"
          />
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="plaza-button h-11 shrink-0 rounded-lg px-4 text-sm font-semibold disabled:opacity-40"
          >
            {t("asocijacije.guess")}
          </button>
        </form>
      )}
    </section>
  );
}
