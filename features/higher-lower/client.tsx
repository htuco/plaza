"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ArrowDownIcon, ArrowUpIcon } from "@/components/room-icons";
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
      <RoomBody>
        <RoomLoading rows={3} />
      </RoomBody>
    );
  }

  const playersById = new Map(snapshot.players.map((player) => [player.id, player]));
  const currentItem = view.revealed[view.revealed.length - 1] ?? null;
  const sortedProgress = Object.entries(view.progress).sort(
    (a, b) => b[1].position - a[1].position,
  );

  const standings = (
    <section
      className="plaza-panel flex min-h-0 flex-col gap-2.5 rounded-[1.125rem] p-4"
      aria-label={t("higherLower.scoreboard")}
    >
      <h3 className="rm-eyebrow">{t("higherLower.scoreboard")}</h3>
      <ul className="grid gap-2 overflow-y-auto">
        {sortedProgress.map(([id, entry]) => (
          <StandingRow
            key={id}
            name={playersById.get(id)?.nickname ?? "—"}
            score={entry.position}
            isMe={id === playerId}
            youLabel={t("gradovi.you")}
            dimmed={!entry.alive}
            note={!entry.alive ? t("higherLower.out") : undefined}
          />
        ))}
      </ul>
    </section>
  );

  // ---------------------------------------------------------------- setup
  if (view.phase === "setup") {
    return (
      <>
        <PhaseHeader
          eyebrow={t("higherLower.phase.setup")}
          title={t("higherLower.setupTitle")}
        />
        <RoomBody center className="p-5 sm:p-6">
          <RoomContent className="gap-4">
            {error && <RoomError message={error} />}
            <p className="plaza-muted text-center text-[0.84rem] leading-relaxed">
              {t("higherLower.rulesHint")}
            </p>
          </RoomContent>
        </RoomBody>
        <RoomBottomBar>
          {view.isHost ? (
            <button
              type="button"
              disabled={isSending}
              onClick={() => void sendIntent({ kind: "start-game" })}
              className="plaza-button rm-cta disabled:opacity-50"
            >
              {t("higherLower.startGame")}
            </button>
          ) : (
            <WaitingNote>{t("higherLower.waitingForSetup")}</WaitingNote>
          )}
        </RoomBottomBar>
      </>
    );
  }

  // ------------------------------------------------------------- finished
  if (view.phase === "finished") {
    return (
      <>
        <PhaseHeader
          eyebrow={t("higherLower.phase.finished")}
          title={t("higherLower.finishedTitle")}
        />
        <RoomBody className="p-5 sm:p-6">
          <RoomContent className="gap-3.5">
          {error && <RoomError message={error} />}
          <div className="plaza-winner-card rounded-3xl px-5 py-7 text-center">
            <p className="rm-eyebrow">{t("higherLower.winner")}</p>
            <p className="rm-display mt-2 text-[1.75rem] font-extrabold">
              {view.winnerPlayerIds.length > 1
                ? t("alias.tie")
                : playersById.get(view.winnerPlayerIds[0])?.nickname ?? "—"}
            </p>
          </div>
          {standings}
          </RoomContent>
        </RoomBody>
        <RoomBottomBar note={!view.isHost ? t("gradovi.hostCloseNote") : undefined}>
          {view.isHost ? (
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
          )}
        </RoomBottomBar>
      </>
    );
  }

  // -------------------------------------------------------- 08 · playing
  return (
    <RoomBody className="p-5 sm:p-6">
      <RoomSplit aside={standings}>
      <div className="flex min-w-0 flex-col gap-3 lg:flex-1">
      {error && <RoomError message={error} />}

      <div className="flex items-center justify-between gap-2">
        <span className="rm-eyebrow">{t("higherLower.streak", view.position)}</span>
        <span className="plaza-muted-2 text-[0.72rem]">
          {t("higherLower.categoryLabel", t(`higherLower.category.${view.category ?? "trivia"}`))}
        </span>
      </div>

      {view.alive ? (
        <>
          {/* The confirmed item, with its real value. */}
          <div className="rm-value-card">
            <span className="rm-eyebrow">{t("higherLower.current")}</span>
            <span className="text-[1.1875rem] font-semibold">{currentItem?.label ?? "…"}</span>
            <span className="rm-numeric mt-1.5 text-[2.125rem] font-extrabold">
              {currentItem ? formatValue(currentItem.value) : "—"}
              {currentItem?.unit && (
                <span className="plaza-muted ml-1.5 font-[family-name:var(--font-geist-sans)] text-[0.81rem] font-medium">
                  {currentItem.unit}
                </span>
              )}
            </span>
          </div>

          {/* Only the next item's label is ever sent — the value is the secret. */}
          <div className="rm-value-card rm-value-card--next">
            <span className="rm-eyebrow">{t("higherLower.next")}</span>
            <span className="text-[1.1875rem] font-semibold">{view.nextLabel ?? "…"}</span>
            <span className="rm-numeric mt-1.5 text-[2.125rem] font-extrabold text-[var(--plaza-muted-2)]">
              ? ? ?
            </span>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={isSending}
              onClick={() => void sendIntent({ kind: "guess", direction: "lower" })}
              className="rm-answer rm-answer--lower"
            >
              <ArrowDownIcon /> {t("higherLower.lower")}
            </button>
            <button
              type="button"
              disabled={isSending}
              onClick={() => void sendIntent({ kind: "guess", direction: "higher" })}
              className="rm-answer rm-answer--higher"
            >
              <ArrowUpIcon /> {t("higherLower.higher")}
            </button>
          </div>
        </>
      ) : (
        <div className="rm-value-card rm-value-card--next py-8">
          <p className="text-[1.0625rem] font-semibold">{t("higherLower.youAreOut")}</p>
          <p className="plaza-muted mt-1 text-[0.81rem]">
            {t("higherLower.finalChainLength", view.position)}
          </p>
        </div>
      )}

      </div>
      </RoomSplit>
    </RoomBody>
  );
}
