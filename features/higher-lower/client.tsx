"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import { createClient } from "@/lib/supabase/client";
import { subscribeToRoom } from "@/lib/realtime/channels";
import type { HigherLowerIntent, HigherLowerView } from "./types";

const GAME_ID = "higher-lower";

type PlayerSummary = {
  id: string;
  nickname: string;
  isHost: boolean;
};

type HigherLowerSnapshot = {
  gameId: typeof GAME_ID;
  playerId: string;
  players: PlayerSummary[];
  view: HigherLowerView;
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

function formatValue(value: number): string {
  return new Intl.NumberFormat("bs-BA").format(value);
}

export function HigherLowerClient({ roomCode, playerId }: { roomCode: string; playerId: string }) {
  const router = useRouter();
  const { localizeError, t } = usePreferences();
  const [snapshot, setSnapshot] = useState<HigherLowerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const loadState = useCallback(async () => {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/state`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setError(localizeError(await readError(response)));
      return;
    }
    setSnapshot((await response.json()) as HigherLowerSnapshot);
    setError(null);
  }, [localizeError, roomCode]);

  const sendIntent = useCallback(
    async (intent: HigherLowerIntent) => {
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
        setSnapshot((await response.json()) as HigherLowerSnapshot);
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

  if (!snapshot || !view) {
    return (
      <div className="plaza-panel rounded-xl p-5">
        <div className="plaza-skeleton h-5 w-32 rounded" />
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="plaza-skeleton h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const playersById = new Map(snapshot.players.map((player) => [player.id, player]));
  const currentItem = view.revealed[view.revealed.length - 1] ?? null;
  const sortedProgress = Object.entries(view.progress).sort(
    (a, b) => b[1].position - a[1].position,
  );

  const scoreboard = (
    <section aria-label={t("higherLower.scoreboard")} className="grid gap-2">
      <h3 className="plaza-label">{t("higherLower.scoreboard")}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {sortedProgress.map(([id, entry]) => (
          <div
            key={id}
            className={`plaza-team-card rounded-xl px-3.5 py-2.5 ${
              !entry.alive ? "opacity-70" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {playersById.get(id)?.nickname ?? "—"}
                {id === playerId && (
                  <span className="plaza-muted-2 text-xs font-normal">{t("gradovi.you")}</span>
                )}
                {!entry.alive && (
                  <span className="plaza-muted-2 text-xs font-normal">{t("higherLower.out")}</span>
                )}
              </span>
              <span className="font-mono text-lg font-bold tabular-nums">{entry.position}</span>
            </div>
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
                {view.phase === "setup" && t("higherLower.phase.setup")}
                {view.phase === "playing" && t(`higherLower.category.${view.category ?? "trivia"}`)}
                {view.phase === "finished" && t("higherLower.phase.finished")}
              </p>
              <h2 className="truncate text-lg font-semibold">
                {view.phase === "setup" && t("higherLower.setupTitle")}
                {view.phase === "playing" && t("higherLower.playingTitle")}
                {view.phase === "finished" && t("higherLower.finishedTitle")}
              </h2>
            </div>
          </div>
        </div>

        {error && <div className="plaza-error border-b px-4 py-3 text-sm">{error}</div>}

        {/* ------------------------------------------------ setup */}
        {view.phase === "setup" && (
          <div className="grid gap-5 p-4">
            <p className="plaza-muted text-sm">{t("higherLower.rulesHint")}</p>
            {view.isHost ? (
              <button
                type="button"
                disabled={isSending}
                onClick={() => void sendIntent({ kind: "start-game" })}
                className="plaza-button h-12 rounded-xl text-base font-semibold disabled:opacity-50"
              >
                {t("higherLower.startGame")}
              </button>
            ) : (
              <p className="plaza-muted text-sm">{t("higherLower.waitingForSetup")}</p>
            )}
          </div>
        )}

        {/* ------------------------------------------------ playing */}
        {view.phase === "playing" && (
          <div className="grid gap-4 p-4">
            {view.alive ? (
              <>
                <div className="plaza-word-card plaza-word-card--crew rounded-2xl px-5 py-7 text-center">
                  <p className="plaza-word-card__label">{t("higherLower.current")}</p>
                  <p className="plaza-word-card__word text-2xl">{currentItem?.label ?? "…"}</p>
                  <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
                    {currentItem ? formatValue(currentItem.value) : "—"}
                    <span className="plaza-muted ml-2 text-sm font-normal">{currentItem?.unit}</span>
                  </p>
                </div>

                <div className="plaza-subtle rounded-2xl px-5 py-6 text-center">
                  <p className="plaza-word-card__label">{t("higherLower.next")}</p>
                  <p className="mt-1 text-xl font-semibold">{view.nextLabel ?? "…"}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => void sendIntent({ kind: "guess", direction: "lower" })}
                    className="plaza-action-skip h-16 rounded-2xl text-lg font-bold disabled:opacity-50"
                  >
                    ▼ {t("higherLower.lower")}
                  </button>
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => void sendIntent({ kind: "guess", direction: "higher" })}
                    className="plaza-action-correct h-16 rounded-2xl text-lg font-bold disabled:opacity-50"
                  >
                    ▲ {t("higherLower.higher")}
                  </button>
                </div>

                <p className="plaza-muted text-center text-sm">
                  {t("higherLower.chainLength", view.position)}
                </p>
              </>
            ) : (
              <div className="plaza-subtle rounded-2xl px-5 py-8 text-center">
                <p className="text-lg font-semibold">{t("higherLower.youAreOut")}</p>
                <p className="plaza-muted mt-1 text-sm">
                  {t("higherLower.finalChainLength", view.position)}
                </p>
              </div>
            )}
            {scoreboard}
          </div>
        )}

        {/* ------------------------------------------------ finished */}
        {view.phase === "finished" && (
          <div className="grid gap-5 p-4">
            <div className="plaza-winner-card rounded-2xl px-5 py-8 text-center">
              <p className="plaza-label">{t("higherLower.winner")}</p>
              <p className="mt-2 text-3xl font-bold">
                {view.winnerPlayerIds.length > 1
                  ? t("alias.tie")
                  : playersById.get(view.winnerPlayerIds[0])?.nickname ?? "—"}
              </p>
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
    </div>
  );
}
