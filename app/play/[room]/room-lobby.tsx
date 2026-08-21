"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GameDetails } from "@/components/game-details";
import { GameIcon } from "@/components/game-icons";
import { LeaveRoomButton } from "@/components/leave-room-button";
import { RoomCode } from "@/components/room-code";
import { CheckIcon, StarIcon } from "@/components/room-icons";
import {
  RoomBody,
  RoomBottomBar,
  RoomScreen,
  RoomSplit,
  RoomTopBar,
} from "@/components/room-shell";
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

// 02 · Lobby — host, and 03 · Lobby — gost.
//
// Same shell, two jobs. The host gets the room code as the hero (tap to copy,
// share + QR as the primary pair), the player list, and a scrolling game
// picker with the start action in the bottom bar. A guest gets a compact code
// row — share and QR stay reachable — a status strip for what the host is
// doing, and the rules of the selected game while they wait.
export function RoomLobby({ room, me }: { room: RoomRow; me: PlayerRow | null }) {
  const router = useRouter();
  const { gameCopy, localizeError, t } = usePreferences();
  const [players, setPlayers] = useState<PlayerRow[]>(room.players);
  const [selectedGame, setSelectedGame] = useState<GameId | null>(room.gameId);
  const [expandedGame, setExpandedGame] = useState<GameId | null>(null);
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
  const enoughPlayers = selectedMeta !== null && players.length >= selectedMeta.minPlayers;
  const canStart =
    isHost && selectedMeta !== null && selectedMeta.availability === "playable" && enoughPlayers;

  const playersCard = (
    <section className="plaza-panel grid gap-2.5 rounded-[1.125rem] p-3.5" aria-labelledby="players-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="players-heading" className="rm-eyebrow">
          {t("lobby.playersCount", players.length)}
        </h2>
        {selectedMeta && !enoughPlayers && (
          <span className="plaza-muted-2 text-[0.69rem]">
            {t("lobby.minPlayersFor", selectedMeta.minPlayers, gameCopy(selectedMeta.id).displayName)}
          </span>
        )}
      </div>
      <ul className="flex flex-wrap gap-2">
        {players.map((player, index) => (
          <li key={player.id}>
            <span
              className={`plaza-player-pill ${player.id === myId ? "plaza-player-pill--me" : ""}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="plaza-player-pill__avatar" aria-hidden="true">
                {player.isHost ? <StarIcon size={11} /> : player.nickname.slice(0, 1)}
              </span>
              <span className="max-w-28 truncate text-[0.81rem] font-semibold">
                {player.nickname}
              </span>
              {player.id === myId && (
                <span className="plaza-muted-2 text-[0.62rem] font-medium">{t("gradovi.you")}</span>
              )}
            </span>
          </li>
        ))}
        {/* A ghost seat only reads as "waiting" while the room genuinely is:
            nobody else has arrived, or the picked game needs more players. */}
        {(players.length < 2 || (selectedMeta !== null && !enoughPlayers)) && (
          <li>
            <span className="plaza-seat-ghost">
              <span className="plaza-seat-ghost__avatar" aria-hidden="true" />
              <span className="text-[0.72rem]">{t("lobby.waitingForPlayers")}</span>
            </span>
          </li>
        )}
      </ul>
    </section>
  );

  const errorBanner = error ? (
    <p className="plaza-error rounded-xl px-3 py-2 text-[0.78rem] font-medium">{error}</p>
  ) : null;

  // ------------------------------------------------------------------ host
  if (isHost) {
    return (
      <RoomScreen wide>
        <RoomTopBar>
          <span className="plaza-display text-[1.0625rem] font-extrabold">Plaza</span>
          <div className="flex items-center gap-2">
            <span className="rm-chip rm-chip--host">
              <StarIcon size={11} /> {t("lobby.host")}
            </span>
            {me && <LeaveRoomButton roomCode={room.code} isHost={isHost} />}
          </div>
        </RoomTopBar>

        <RoomBody scroll={false} className="gap-3.5 p-5 sm:p-6">
          <RoomSplit
            asideFirst
            aside={
              <>
          {/* The room code is the hero: tap to copy, share + QR right under it. */}
          <section className="grid justify-items-center gap-3">
            <p className="rm-eyebrow">{t("lobby.roomCode")}</p>
            <RoomCode code={room.code} size="md" />
            <ShareRoom code={room.code} />
            {me && (
              <p className="plaza-muted text-xs">
                {t("lobby.playingAs")}{" "}
                <strong className="font-semibold text-[var(--foreground)]">{me.nickname}</strong>
              </p>
            )}
          </section>

                {playersCard}
              </>
            }
          >
          {/* Fills the rest of the screen and scrolls on its own, so the start
              action never leaves the bottom bar. */}
          <section
            className="plaza-panel relative flex min-h-40 flex-1 flex-col gap-2.5 rounded-[1.125rem] p-3.5"
            aria-labelledby="pick-game-heading"
          >
            <h2 id="pick-game-heading" className="rm-eyebrow">
              {t("lobby.pickGame")}
            </h2>
            <span className="rm-fade" aria-hidden="true" />
            <ul className="rm-list min-h-0 flex-1 gap-2 overflow-y-auto pb-[1.625rem]">
              {GAMES.map((game) => {
                const selected = selectedGame === game.id;
                const soon = game.availability === "soon";
                const copy = gameCopy(game.id);
                const expanded = expandedGame === game.id;
                return (
                  <li key={game.id} className="grid min-w-0 gap-1.5">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-pressed={selected}
                      onClick={() => handleGameClick(game.id)}
                      className={`rm-game-row ${selected ? "rm-game-row--selected" : ""} ${
                        soon ? "opacity-70" : ""
                      }`}
                    >
                      <GameIcon gameId={game.id} size={38} />
                      <span className="flex min-w-0 flex-1 flex-col gap-px">
                        <span className="truncate text-[0.875rem] font-semibold">
                          {copy.displayName}
                        </span>
                        <span className="plaza-muted truncate text-[0.72rem]">
                          {copy.tagline} · {game.minPlayers}–{game.maxPlayers}
                        </span>
                      </span>
                      {soon ? (
                        <span className="rm-chip rm-chip--neutral shrink-0">{t("game.soon")}</span>
                      ) : selected ? (
                        <span className="rm-game-row__check" aria-hidden="true">
                          <CheckIcon size={13} />
                        </span>
                      ) : null}
                    </button>
                    {expanded && (
                      <div className="plaza-subtle rounded-xl">
                        <GameDetails gameId={game.id} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          </RoomSplit>

          {errorBanner}
        </RoomBody>

        <RoomBottomBar
          note={
            selectedMeta
              ? canStart
                ? t("lobby.readyNote", players.length)
                : t("lobby.needPlayers", selectedMeta.minPlayers)
              : t("lobby.pickGameFirst")
          }
        >
          <button
            type="button"
            disabled={!canStart || isPending}
            onClick={startGame}
            className="plaza-button rm-cta disabled:opacity-50"
          >
            {isPending
              ? "…"
              : selectedMeta
                ? t("lobby.startNamed", gameCopy(selectedMeta.id).displayName)
                : t("lobby.startGame")}
          </button>
        </RoomBottomBar>
      </RoomScreen>
    );
  }

  // ----------------------------------------------------------------- guest
  return (
    <RoomScreen>
      <RoomTopBar>
        <span className="plaza-display text-[1.0625rem] font-extrabold">Plaza</span>
        <div className="flex min-w-0 items-center gap-2">
          {me && <span className="plaza-muted max-w-24 truncate text-xs">{me.nickname}</span>}
          {me && <LeaveRoomButton roomCode={room.code} isHost={isHost} />}
        </div>
      </RoomTopBar>

      <RoomBody className="gap-3.5 p-5 sm:p-6">
        <RoomSplit
          asideFirst
          aside={
            <>
        {/* Share and QR stay reachable for guests — anyone can pull in a friend. */}
        <div className="plaza-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5">
          <RoomCode code={room.code} size="inline" />
          <ShareRoom code={room.code} variant="compact" />
        </div>

        <div className="plaza-status-accent flex items-center gap-3 rounded-2xl px-4 py-3.5">
          {selectedMeta ? (
            <GameIcon gameId={selectedMeta.id} size={38} />
          ) : (
            <span className="rm-game-icon" aria-hidden="true">
              🕯️
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[0.69rem] font-semibold text-[var(--plaza-accent)]">
              {t("lobby.hostPicking")}
            </span>
            <span className="truncate text-[0.875rem] font-semibold">
              {selectedMeta
                ? t("lobby.gameSelected", gameCopy(selectedMeta.id).displayName)
                : t("lobby.noGameYet")}
            </span>
          </span>
          <span className="rm-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>

              {playersCard}
            </>
          }
        >
        {selectedMeta ? (
          <section className="plaza-panel flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto rounded-[1.125rem] p-[1.125rem]">
            <div className="flex items-center gap-3">
              <GameIcon gameId={selectedMeta.id} size={44} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="plaza-display truncate text-[1.0625rem] font-extrabold">
                  {gameCopy(selectedMeta.id).displayName}
                </span>
                <span className="plaza-muted text-[0.72rem]">
                  {t("home.players", selectedMeta.minPlayers, selectedMeta.maxPlayers)} ·{" "}
                  {t("game.roundLength")}
                </span>
              </span>
            </div>
            <GameDetails gameId={selectedMeta.id} />
          </section>
        ) : (
          <section className="plaza-panel grid min-h-40 flex-1 place-items-center rounded-[1.125rem] p-6 text-center">
            <p className="plaza-muted-2 text-[0.81rem]">{t("lobby.waitingForHostGame")}</p>
          </section>
        )}
        </RoomSplit>

        {errorBanner}
      </RoomBody>

      <RoomBottomBar>
        <div className="flex items-center gap-3">
          <span className="rm-spinner" aria-hidden="true" />
          <span className="plaza-muted flex-1 text-[0.81rem]">{t("lobby.waitingHostStart")}</span>
        </div>
      </RoomBottomBar>
    </RoomScreen>
  );
}
