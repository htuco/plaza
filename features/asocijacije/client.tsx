"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import { RoomBody, RoomBottomBar, RoomContent, RoomSplit } from "@/components/room-shell";
import {
  PhaseHeader,
  RoomError,
  RoomLoading,
  StandingRow,
  WaitingNote,
} from "@/components/room-game-ui";
import { createClient } from "@/lib/supabase/client";
import { subscribeToRoom } from "@/lib/realtime/channels";
import { COLUMN_LABELS, FINAL_BASE_POINTS, FINAL_COLUMN_BONUS } from "./types";
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
  // UI only: which unsolved column currently has its guess field open. The
  // board is a grid now, so column guesses live behind their solution cell.
  const [openColumn, setOpenColumn] = useState<number | null>(null);

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
      <RoomBody>
        <RoomLoading rows={4} />
      </RoomBody>
    );
  }

  const solvedCount = view.columns.filter((column) => column.solution !== null).length;
  const myScore = view.scores[playerId] ?? 0;
  // What the final solution is still worth: the base, plus a bonus for every
  // column nobody has cracked yet.
  const finalPoints = FINAL_BASE_POINTS + FINAL_COLUMN_BONUS * (4 - solvedCount);
  const boardLocked = isSending || view.phase === "finished";

  // ------------------------------------------------------------------ setup
  if (view.phase === "setup") {
    return (
      <>
        <PhaseHeader
          eyebrow={t("asocijacije.board", view.round)}
          title={t("asocijacije.phase.setup")}
        />
        <RoomBody className="p-5 sm:p-6">
          <RoomContent className="gap-3.5">
          {error && <RoomError message={error} />}
          <ul className="grid gap-2.5 text-[0.84rem]">
            {[t("asocijacije.rule1"), t("asocijacije.rule2"), t("asocijacije.rule3")].map(
              (rule) => (
                <li key={rule} className="plaza-muted flex gap-2.5 leading-relaxed">
                  <span className="mt-[0.44rem] h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--plaza-accent)]" />
                  <span>{rule}</span>
                </li>
              ),
            )}
          </ul>
          </RoomContent>
        </RoomBody>
        <RoomBottomBar>
          {view.isHost ? (
            <button
              type="button"
              disabled={isSending}
              onClick={() => void actionIntent({ kind: "start-game" })}
              className="plaza-button rm-cta disabled:opacity-50"
            >
              {t("asocijacije.start")}
            </button>
          ) : (
            <WaitingNote>{t("asocijacije.waitingForHost")}</WaitingNote>
          )}
        </RoomBottomBar>
      </>
    );
  }

  // ------------------------------------------------------------ 12 · board
  return (
    <>
      <PhaseHeader
        eyebrow={t("asocijacije.boardEyebrow", view.round)}
        title={
          view.phase === "finished" ? t("asocijacije.phase.finished") : t("asocijacije.subtitle")
        }
        right={
          <span className="rm-chip rm-chip--accent">{t("asocijacije.yourScore", myScore)}</span>
        }
      />

      <RoomBody className="px-5 pt-3.5 sm:px-6">
        <RoomSplit
          aside={
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
                    score={view.scores[player.id] ?? 0}
                  />
                ))}
              </ol>
            </section>
          }
        >
        <div className="flex min-w-0 flex-col gap-2.5 pb-5 lg:flex-1">
        {error && <RoomError message={error} />}

        {/* Column letters, so a coordinate like B3 reads off the board. */}
        <div className="rm-board" aria-hidden="true">
          {COLUMN_LABELS.map((label) => (
            <span key={label} className="rm-board-head">
              {label}
            </span>
          ))}
        </div>

        {/* 4 × 4 fields, row-major: row r is field r of every column. Hidden
            cells only ever carry their coordinate — the hint stays server-side
            until someone spends an open on it. */}
        <div className="rm-board rm-board--fields">
          {[0, 1, 2, 3].map((field) =>
            view.columns.map((column, columnIndex) => {
              const hint = column.hints[field];
              const revealed = hint !== null;
              const label = `${COLUMN_LABELS[columnIndex]}${field + 1}`;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={boardLocked || revealed || column.solution !== null}
                  onClick={() =>
                    void actionIntent({ kind: "reveal-hint", column: columnIndex, field })
                  }
                  aria-label={revealed ? `${label}: ${hint}` : label}
                  className={`rm-board-cell ${revealed ? "" : "rm-board-cell--hidden"}`}
                >
                  {revealed ? hint : label}
                </button>
              );
            }),
          )}
        </div>

        {/* One solution cell per column: the answer once solved, otherwise a
            "?" that opens the guess field for that column. */}
        <div className="rm-board">
          {view.columns.map((column, columnIndex) => {
            const solved = column.solution !== null;
            const solver = column.solvedBy ? playersById.get(column.solvedBy) : null;
            return (
              <button
                key={columnIndex}
                type="button"
                disabled={boardLocked || solved}
                aria-expanded={!solved ? openColumn === columnIndex : undefined}
                onClick={() =>
                  setOpenColumn((current) => (current === columnIndex ? null : columnIndex))
                }
                title={solved && solver ? t("asocijacije.solvedBy", solver.nickname) : undefined}
                className={`rm-board-solution ${solved ? "rm-board-solution--solved" : ""} ${
                  wrongTarget === `col-${columnIndex}` ? "plaza-shake" : ""
                }`}
              >
                {solved ? column.solution : "?"}
              </button>
            );
          })}
        </div>

        {openColumn !== null && view.columns[openColumn]?.solution === null && (
          <ColumnGuess
            label={COLUMN_LABELS[openColumn]}
            disabled={boardLocked}
            onGuess={(value) =>
              guess(`col-${openColumn}`, {
                kind: "guess-column",
                column: openColumn,
                guess: value,
              })
            }
            onSolved={() => setOpenColumn(null)}
            t={t}
          />
        )}

        <FinalCard
          view={view}
          playersById={playersById}
          points={finalPoints}
          disabled={boardLocked}
          wrong={wrongTarget === "final"}
          onGuess={(value) => guess("final", { kind: "guess-final", guess: value })}
          t={t}
        />

        </div>
        </RoomSplit>
      </RoomBody>

      <RoomBottomBar
        note={
          view.phase === "playing"
            ? `${t("asocijacije.solvedCount", solvedCount)} · ${t("asocijacije.hostRevealNote")}`
            : !view.isHost
              ? t("gradovi.hostCloseNote")
              : undefined
        }
      >
        {view.phase === "finished" ? (
          view.isHost ? (
            <>
              <button
                type="button"
                disabled={isSending}
                onClick={() => void actionIntent({ kind: "play-again" })}
                className="plaza-button rm-cta disabled:opacity-50"
              >
                {t("asocijacije.nextBoard")}
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
          )
        ) : (
          view.isHost && (
            <button
              type="button"
              disabled={isSending}
              onClick={() => void actionIntent({ kind: "reveal-all" })}
              className="plaza-button-secondary h-12 rounded-[0.875rem] text-[0.84rem] font-semibold disabled:opacity-50"
            >
              {t("asocijacije.revealAll")}
            </button>
          )
        )}
      </RoomBottomBar>
    </>
  );
}

// The guess field for one unsolved column, opened from its solution cell.
function ColumnGuess({
  label,
  disabled,
  onGuess,
  onSolved,
  t,
}: {
  label: string;
  disabled: boolean;
  onGuess: (value: string) => Promise<boolean>;
  onSolved: () => void;
  t: (key: string, ...args: Array<string | number>) => string;
}) {
  const [value, setValue] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    const ok = await onGuess(value);
    if (ok) {
      setValue("");
      onSolved();
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex gap-2">
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        maxLength={40}
        placeholder={t("asocijacije.guessColumnAria", label)}
        aria-label={t("asocijacije.guessColumnAria", label)}
        className="plaza-input h-[2.875rem] min-w-0 flex-1 rounded-xl px-3.5 text-[0.875rem]"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="plaza-button h-[2.875rem] w-[4.875rem] shrink-0 rounded-xl text-[0.84rem] font-extrabold disabled:opacity-40"
      >
        {t("asocijacije.guess")}
      </button>
    </form>
  );
}

function FinalCard({
  view,
  playersById,
  points,
  disabled,
  wrong,
  onGuess,
  t,
}: {
  view: AsocijacijeView;
  playersById: Map<string, PlayerSummary>;
  points: number;
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
      className={`rm-final-card ${wrong ? "plaza-shake" : ""}`}
      aria-label={t("asocijacije.finalAria")}
    >
      <span className="rm-final-card__label">
        {solved ? t("asocijacije.finalSolution") : t("asocijacije.finalWithPoints", points)}
      </span>
      {solved ? (
        <>
          <p className="rm-display text-[1.375rem] font-extrabold uppercase">
            {view.finalSolution}
          </p>
          <p className="plaza-muted text-[0.78rem]">
            {solver
              ? t("asocijacije.solvedBy", solver.nickname)
              : t("asocijacije.revealedByHost")}
          </p>
        </>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="flex gap-2">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={disabled}
            maxLength={40}
            placeholder={t("asocijacije.finalPlaceholder")}
            aria-label={t("asocijacije.finalAria")}
            className="plaza-input h-[2.875rem] min-w-0 flex-1 rounded-xl px-3.5 text-[0.875rem]"
          />
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="plaza-button h-[2.875rem] w-[4.875rem] shrink-0 rounded-xl text-[0.84rem] font-extrabold disabled:opacity-40"
          >
            {t("asocijacije.guess")}
          </button>
        </form>
      )}
    </section>
  );
}
