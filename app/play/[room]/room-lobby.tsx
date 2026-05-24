"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GameDetails } from "@/components/game-details";
import { usePreferences } from "@/components/preferences-provider";
import { createClient } from "@/lib/supabase/client";
import { subscribeToRoom } from "@/lib/realtime/channels";
import { GAMES } from "@/features/registry";
import { selectGameAction, startGameAction } from "@/app/actions";
import type { GameId } from "@/lib/db/schema";

type PlayerRow = {
  id: string;
  nickname: string;
  isHost: boolean;
  anonId: string;
};

type RoomRow = {
  id: string;
  code: string;
  hostPlayerId: string | null;
  gameId: GameId | null;
  status: "lobby" | "in_game" | "finished";
  players: PlayerRow[];
};

export function RoomLobby({ room, me }: { room: RoomRow; me: PlayerRow | null }) {
  const router = useRouter();
  const { gameCopy, localizeError, t } = usePreferences();
  const [players, setPlayers] = useState<PlayerRow[]>(room.players);
  const [selectedGame, setSelectedGame] = useState<GameId | null>(room.gameId);
  const [expandedGame, setExpandedGame] = useState<GameId | null>(room.gameId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // If we land here while a game is already in progress, route straight in.
  useEffect(() => {
    if (room.status === "finished") {
      router.replace("/");
      return;
    }
    if (room.status === "in_game" && room.gameId) {
      router.replace(`/play/${room.code}/${room.gameId}`);
    }
  }, [room.status, room.gameId, room.code, router]);

  useEffect(() => {
    const supabase = createClient();
    const channel = subscribeToRoom(supabase, room.code, (event) => {
      if (event.type === "lobby-update") {
        const p = event.payload as {
          players?: PlayerRow[];
          gameId?: GameId | null;
        };
        if (p.players) setPlayers(p.players);
        if (p.gameId !== undefined) setSelectedGame(p.gameId);
      }
      if (event.type === "state") {
        const p = event.payload as { gameId?: GameId; status?: string; target?: string };
        if (p.status === "finished") {
          router.replace(p.target ?? "/");
          return;
        }
        if (p.status === "in_game" && p.gameId) {
          router.push(`/play/${room.code}/${p.gameId}`);
        }
      }
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.code, router]);

  const isHost = me?.isHost ?? false;

  function pickGame(gameId: GameId) {
    if (!isHost) return;
    const meta = GAMES.find((game) => game.id === gameId);
    if (meta?.availability === "soon") {
      setError(t("lobby.gameComingSoon"));
      return;
    }
    // Optimistic — server broadcast will re-sync everyone (including us).
    setSelectedGame(gameId);
    setError(null);
    startTransition(async () => {
      const res = await selectGameAction(room.code, gameId);
      if (res && "error" in res && res.error) setError(localizeError(res.error));
    });
  }

  function handleGameClick(gameId: GameId) {
    setExpandedGame((current) => (current === gameId ? null : gameId));
    if (!isHost || isPending || selectedGame === gameId) return;
    pickGame(gameId);
  }

  function startGame() {
    setError(null);
    startTransition(async () => {
      const res = await startGameAction(room.code);
      if (res && "error" in res && res.error) setError(localizeError(res.error));
      // Success: server broadcasts `state` and our subscriber will redirect.
    });
  }

  const selectedMeta = selectedGame ? GAMES.find((g) => g.id === selectedGame) ?? null : null;
  const canStart =
    isHost &&
    selectedMeta !== null &&
    selectedMeta.availability === "playable" &&
    players.length >= selectedMeta.minPlayers;

  return (
    <div className="plaza-page flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
        <header className="mb-6">
          <p className="plaza-label">{t("lobby.roomCode")}</p>
          <h1 className="font-mono text-4xl font-semibold tracking-widest">{room.code}</h1>
          {me && (
            <p className="plaza-muted mt-1 text-sm">
              {t("lobby.playingAs")} <span className="font-medium">{me.nickname}</span>
              {isHost && ` (${t("lobby.host")})`}
            </p>
          )}
        </header>

        <section className="plaza-panel mb-6 rounded-lg p-4">
          <h2 className="plaza-label mb-2">{t("lobby.players", players.length)}</h2>
          <ul className="flex flex-wrap gap-2">
            {players.map((p) => (
              <li
                key={p.id}
                className="plaza-chip rounded-full px-3 py-1 text-sm"
              >
                {p.nickname}
                {p.isHost && <span className="plaza-muted-2 ml-1 text-xs">{t("lobby.host")}</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="plaza-panel rounded-lg p-4">
          <h2 className="plaza-label mb-3">{t("lobby.pickGame")}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {GAMES.map((game) => {
              const selected = selectedGame === game.id;
              const soon = game.availability === "soon";
              const copy = gameCopy(game.id);
              const expanded = expandedGame === game.id;
              return (
                <li key={game.id} className="plaza-card overflow-hidden rounded-lg">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => handleGameClick(game.id)}
                    className={`w-full p-3 text-left transition-colors ${
                      selected
                        ? "bg-[var(--plaza-accent-soft)] text-[var(--foreground)]"
                        : "hover:bg-[var(--plaza-surface-2)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{copy.displayName}</div>
                      {soon && (
                        <span className="plaza-status-review rounded px-2 py-1 text-xs font-medium">
                          {t("game.soon")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs opacity-80">{copy.tagline}</div>
                  </button>
                  {expanded && <GameDetails gameId={game.id} />}
                </li>
              );
            })}
          </ul>

          {isHost ? (
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={!canStart || isPending}
                onClick={startGame}
                className="plaza-button h-11 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isPending ? "..." : t("lobby.startGame")}
              </button>
              {!canStart && selectedGame && selectedMeta && (
                <p className="plaza-muted text-xs">
                  {selectedMeta.availability === "soon"
                    ? t("lobby.gameComingSoon")
                    : t("lobby.needPlayers", selectedMeta.minPlayers)}
                </p>
              )}
              {!selectedGame && (
                <p className="plaza-muted text-xs">{t("lobby.pickGameFirst")}</p>
              )}
            </div>
          ) : (
            <p className="plaza-muted mt-3 text-xs">
              {t("lobby.waitingForHostGame")}
            </p>
          )}

          {error && (
            <p className="mt-3 text-sm text-[var(--plaza-danger)]">{error}</p>
          )}
        </section>
      </main>
    </div>
  );
}
