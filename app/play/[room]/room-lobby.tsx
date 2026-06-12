"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GameDetails } from "@/components/game-details";
import { GAME_ICONS } from "@/components/game-icons";
import { LeaveRoomButton } from "@/components/leave-room-button";
import { RoomCode } from "@/components/room-code";
import { ShareRoom } from "@/components/share-room";
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

// Per-game accent tones, shared with the landing catalog cards.
const GAME_TILE_TONES: Record<GameId, string> = {
  imposteri: "plaza-game-card--mask",
  alias: "plaza-game-card--voice",
  "gradovi-i-sela": "plaza-game-card--paper",
  asocijacije: "plaza-game-card--puzzle",
  "guess-the-song": "plaza-game-card--music",
};

export function RoomLobby({ room, me }: { room: RoomRow; me: PlayerRow | null }) {
  const router = useRouter();
  const { gameCopy, localizeError, t } = usePreferences();
  const [players, setPlayers] = useState<PlayerRow[]>(room.players);
  const [selectedGame, setSelectedGame] = useState<GameId | null>(room.gameId);
  const [expandedGame, setExpandedGame] = useState<GameId | null>(room.gameId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Host can change live (host transfer on leave) — track it from broadcasts.
  const myId = me?.id ?? null;
  const [isHost, setIsHost] = useState(me?.isHost ?? false);

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
        if (p.players) {
          setPlayers(p.players);
          if (myId) {
            const mine = p.players.find((player) => player.id === myId);
            if (mine) setIsHost(mine.isHost);
          }
        }
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
  }, [room.code, router, myId]);

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
      <header className="plaza-room-topbar sticky top-0 z-40">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-3 px-5">
          <span className="plaza-wordmark text-lg">Plaza</span>
          <div className="flex items-center gap-2">
            {me && (
              <span className="plaza-muted hidden max-w-40 truncate text-sm sm:inline">
                {me.nickname}
              </span>
            )}
            {isHost && <span className="plaza-host-chip">★ {t("lobby.host")}</span>}
            {me && <LeaveRoomButton roomCode={room.code} isHost={isHost} />}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-10 pt-8">
        <section className="mb-6 grid justify-items-center gap-3 text-center">
          <p className="plaza-label">{t("lobby.roomCode")}</p>
          <RoomCode code={room.code} />
          <p className="plaza-muted-2 text-xs">{t("lobby.shareCode")}</p>
          <ShareRoom code={room.code} />
          {me && (
            <p className="plaza-muted text-sm">
              {t("lobby.playingAs")} <span className="font-semibold">{me.nickname}</span>
            </p>
          )}
        </section>

        <section className="plaza-panel mb-5 p-4" aria-labelledby="players-heading">
          <h2 id="players-heading" className="plaza-label mb-3">
            {t("lobby.players", players.length)}
          </h2>
          {players.length === 0 ? (
            <p className="plaza-muted text-sm">{t("lobby.waitingForPlayers")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {players.map((p, index) => (
                <li key={p.id}>
                  <span
                    className={`plaza-player-pill ${p.isHost ? "plaza-player-pill--host" : ""} ${
                      p.id === myId ? "plaza-player-pill--me" : ""
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <span className="plaza-player-pill__avatar" aria-hidden="true">
                      {p.isHost ? "★" : p.nickname.slice(0, 1)}
                    </span>
                    <span className="max-w-32 truncate font-medium">{p.nickname}</span>
                    {p.id === myId && (
                      <span className="plaza-muted-2 text-xs">{t("gradovi.you")}</span>
                    )}
                  </span>
                </li>
              ))}
              {players.length === 1 && (
                <li>
                  <span className="plaza-seat-ghost">
                    <span className="plaza-seat-ghost__avatar" aria-hidden="true" />
                    <span className="text-xs">{t("lobby.waitingForPlayers")}</span>
                  </span>
                </li>
              )}
            </ul>
          )}
        </section>

        <section className="plaza-panel p-4" aria-labelledby="pick-game-heading">
          <h2 id="pick-game-heading" className="plaza-label mb-3">
            {t("lobby.pickGame")}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {GAMES.map((game) => {
              const selected = selectedGame === game.id;
              const soon = game.availability === "soon";
              const copy = gameCopy(game.id);
              const expanded = expandedGame === game.id;
              return (
                <li
                  key={game.id}
                  className={`plaza-game-tile ${GAME_TILE_TONES[game.id]} overflow-hidden rounded-xl ${
                    selected ? "plaza-game-tile--selected" : ""
                  } ${soon ? "opacity-70" : ""}`}
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-pressed={selected}
                    onClick={() => handleGameClick(game.id)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="plaza-game-tile__icon shrink-0" aria-hidden="true">
                        {GAME_ICONS[game.id]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold">{copy.displayName}</span>
                          {soon && (
                            <span className="plaza-status-review shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                              {t("game.soon")}
                            </span>
                          )}
                          {selected && !soon && (
                            <span className="plaza-status-valid shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="plaza-muted truncate text-xs">{copy.tagline}</div>
                        <div className="plaza-muted-2 mt-0.5 text-xs">
                          {t("home.players", game.minPlayers, game.maxPlayers)}
                        </div>
                      </div>
                    </div>
                  </button>
                  {expanded && <GameDetails gameId={game.id} />}
                </li>
              );
            })}
          </ul>

          {isHost ? (
            <div className="mt-5 grid gap-2">
              <p className="plaza-label">{t("lobby.hostControls")}</p>
              <button
                type="button"
                disabled={!canStart || isPending}
                onClick={startGame}
                className="plaza-button h-14 rounded-xl text-base font-extrabold disabled:opacity-50"
              >
                {isPending ? "…" : t("lobby.startGame")}
              </button>
              {!canStart && selectedGame && selectedMeta && (
                <p className="plaza-muted text-xs">
                  {selectedMeta.availability === "soon"
                    ? t("lobby.gameComingSoon")
                    : t("lobby.needPlayers", selectedMeta.minPlayers)}
                </p>
              )}
              {!selectedGame && <p className="plaza-muted text-xs">{t("lobby.pickGameFirst")}</p>}
            </div>
          ) : (
            <div className="plaza-subtle mt-5 flex items-center gap-3 rounded-xl px-4 py-3.5">
              <span
                className="plaza-game-tile__icon shrink-0 animate-pulse"
                aria-hidden="true"
              >
                {selectedMeta ? GAME_ICONS[selectedMeta.id] : "🕯️"}
              </span>
              <div className="min-w-0">
                <p className="plaza-muted text-sm">{t("lobby.waitingForHostGame")}</p>
                {selectedMeta && (
                  <p className="mt-0.5 truncate text-sm font-semibold">
                    {t("lobby.selectedGame")}: {gameCopy(selectedMeta.id).displayName}
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="plaza-error mt-3 rounded-lg px-3 py-2 text-sm font-medium">{error}</p>
          )}
        </section>
      </main>
    </div>
  );
}
