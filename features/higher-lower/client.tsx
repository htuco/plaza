"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePreferences } from "@/components/preferences-provider";
import { RoomBody, RoomBottomBar, RoomContent, RoomSplit } from "@/components/room-shell";
import {
  PhaseHeader,
  RoomError,
  RoomLoading,
  StandingRow,
  WaitingNote,
} from "@/components/room-game-ui";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, CloseIcon } from "@/components/room-icons";
import { useGameRoom } from "@/lib/rooms/use-game-room";
import { randomNudgeJitterMs } from "@/lib/realtime/channels";
import { Hearts, ItemCard, OptionGroup } from "./components";
import {
  LIVES_OPTIONS,
  ROUND_OPTIONS,
  TIMER_OPTIONS,
  type CategoryChoice,
  type GuessDirection,
  type HigherLowerIntent,
  type HigherLowerView,
} from "./types";

const GAME_ID = "higher-lower";

const CATEGORY_OPTIONS: readonly CategoryChoice[] = [
  "miks",
  "poznati",
  "sport",
  "film-muzika",
  "hrana",
  "brendovi-tech",
  "mjesta",
  "historija-pojmovi",
  "regional",
];

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

export function HigherLowerClient({ roomCode, playerId }: { roomCode: string; playerId: string }) {
  const { t } = usePreferences();
  const { snapshot, error, isSending, sendIntent, finishSession } = useGameRoom<
    HigherLowerSnapshot,
    HigherLowerIntent
  >({
    roomCode,
    gameId: GAME_ID,
  });
  const [now, setNow] = useState(() => Date.now());
  const [nudgeJitterMs] = useState(randomNudgeJitterMs);
  const autoAdvanceKey = useRef<string | null>(null);

  const view = snapshot?.view ?? null;
  const phase = view?.phase;

  useEffect(() => {
    if (phase !== "guessing" && phase !== "reveal") return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Once a server deadline passes, nudge the server to move on. The server
  // re-checks the deadline itself, so client clock drift can't cheat.
  useEffect(() => {
    if (!view) return;
    const deadline =
      view.phase === "guessing" ? view.deadlineAt : view.phase === "reveal" ? view.revealAdvanceAt : null;
    if (deadline === null || now < deadline + nudgeJitterMs) return;
    const key = `${view.phase}-${view.round}`;
    if (autoAdvanceKey.current === key) return;
    autoAdvanceKey.current = key;
    void sendIntent({ kind: "advance" }, { showError: false, trackSending: false });
  }, [nudgeJitterMs, now, sendIntent, view]);

  if (!snapshot || !view) {
    return (
      <RoomBody>
        <RoomLoading rows={3} />
      </RoomBody>
    );
  }

  const playersById = new Map(snapshot.players.map((player) => [player.id, player]));
  const nameOf = (id: string) => playersById.get(id)?.nickname ?? "—";
  const me = view.players[playerId] ?? null;
  const maxLives = view.settings.lives;
  const ranked = Object.entries(view.players)
    .filter(([, player]) => !player.spectator)
    .sort((a, b) => b[1].score - a[1].score || b[1].lives - a[1].lives);

  // ---------------------------------------------------------------- setup
  if (view.phase === "setup") {
    const settingsLocked = !view.isHost || isSending;
    const updateSettings = (settings: Partial<HigherLowerView["settings"]>) =>
      void sendIntent({ kind: "update-settings", settings });

    return (
      <>
        <PhaseHeader eyebrow={t("higherLower.phase.setup")} title={t("higherLower.setupTitle")} />
        <RoomBody className="p-5 sm:p-6">
          <RoomContent className="gap-5">
            {error && <RoomError message={error} />}
            <p className="plaza-muted text-[0.84rem] leading-relaxed">{t("higherLower.rulesHint")}</p>
            <OptionGroup
              label={t("higherLower.settings.category")}
              options={CATEGORY_OPTIONS}
              value={view.settings.category}
              format={(option) => t(`higherLower.category.${option}`)}
              disabled={settingsLocked}
              onSelect={(category) => updateSettings({ category })}
            />
            <OptionGroup
              label={t("higherLower.settings.rounds")}
              options={ROUND_OPTIONS}
              value={view.settings.rounds as (typeof ROUND_OPTIONS)[number]}
              format={String}
              disabled={settingsLocked}
              onSelect={(rounds) => updateSettings({ rounds })}
            />
            <OptionGroup
              label={t("higherLower.settings.lives")}
              options={LIVES_OPTIONS}
              value={view.settings.lives as (typeof LIVES_OPTIONS)[number]}
              format={(option) => `${option} ♥`}
              disabled={settingsLocked}
              onSelect={(lives) => updateSettings({ lives })}
            />
            <OptionGroup
              label={t("higherLower.settings.timer")}
              options={TIMER_OPTIONS}
              value={view.settings.timerSeconds as (typeof TIMER_OPTIONS)[number]}
              format={(option) => `${option}s`}
              disabled={settingsLocked}
              onSelect={(timerSeconds) => updateSettings({ timerSeconds })}
            />
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
    const podium = ranked.slice(0, 3);
    return (
      <>
        <PhaseHeader eyebrow={t("higherLower.phase.finished")} title={t("higherLower.finishedTitle")} />
        <RoomBody className="p-5 sm:p-6">
          <RoomContent className="gap-3.5">
            {error && <RoomError message={error} />}
            <div className="plaza-winner-card rounded-3xl px-5 py-7 text-center">
              <p className="rm-eyebrow">{t("higherLower.winner")}</p>
              <p className="rm-display mt-2 text-[1.75rem] font-extrabold">
                {view.winnerPlayerIds.length > 1
                  ? t("higherLower.tie")
                  : nameOf(view.winnerPlayerIds[0] ?? "")}
              </p>
            </div>
            <ol className="rm-hl-podium" aria-label={t("higherLower.scoreboard")}>
              {podium.map(([id, player], index) => (
                <li key={id} className={`rm-hl-podium__step rm-hl-podium__step--${index + 1}`}>
                  <span className="truncate text-[0.84rem] font-semibold">{nameOf(id)}</span>
                  <span className="rm-numeric text-[1.25rem] font-extrabold">{player.score}</span>
                  <span className="plaza-rank-badge">{index + 1}</span>
                </li>
              ))}
            </ol>
            <ul className="grid gap-2">
              {ranked.map(([id, player], index) => (
                <StandingRow
                  key={id}
                  rank={index + 1}
                  name={nameOf(id)}
                  score={player.score}
                  isMe={id === playerId}
                  youLabel={t("gradovi.you")}
                  note={t("higherLower.bestStreak", player.bestStreak)}
                />
              ))}
            </ul>
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
                {t("higherLower.playAgain")}
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

  // ------------------------------------------------- guessing · reveal
  const isReveal = view.phase === "reveal";
  const totalRounds = view.settings.rounds;
  const alive = Boolean(me && !me.spectator && me.lives > 0);
  const myResult = isReveal ? (me?.lastResult ?? null) : null;
  const timerTotalMs = view.settings.timerSeconds * 1000;
  const remainingMs = view.deadlineAt !== null ? Math.max(0, view.deadlineAt - now) : 0;
  const timerFraction = view.phase === "guessing" ? remainingMs / timerTotalMs : 0;
  const nextTone =
    isReveal && myResult ? (myResult.correct ? "correct" : "wrong") : undefined;

  const standings = (
    <section
      className="plaza-panel flex min-h-0 flex-col gap-2.5 rounded-[1.125rem] p-4"
      aria-label={t("higherLower.scoreboard")}
    >
      <h3 className="rm-eyebrow">{t("higherLower.scoreboard")}</h3>
      <ul className="grid gap-2 overflow-y-auto">
        {ranked.map(([id, player]) => {
          const out = player.lives <= 0;
          let note: ReactNode = undefined;
          if (isReveal && player.lastResult) {
            note = (
              <span
                className={`rm-hl-pick ${player.lastResult.correct ? "rm-hl-pick--correct" : "rm-hl-pick--wrong"}`}
              >
                {player.answer === "higher" ? <ArrowUpIcon size={12} /> : null}
                {player.answer === "lower" ? <ArrowDownIcon size={12} /> : null}
                {player.lastResult.correct ? (
                  t("higherLower.points", player.lastResult.points)
                ) : (
                  <CloseIcon size={12} />
                )}
              </span>
            );
          } else if (!isReveal && player.answered) {
            note = (
              <span className="rm-hl-pick rm-hl-pick--answered" aria-label={t("higherLower.answered")}>
                <CheckIcon size={12} />
              </span>
            );
          } else if (out) {
            note = t("higherLower.out");
          }
          return (
            <StandingRow
              key={id}
              name={nameOf(id)}
              score={player.score}
              isMe={id === playerId}
              youLabel={t("gradovi.you")}
              dimmed={out && !(isReveal && player.lastResult)}
              note={note}
              extra={<Hearts lives={player.lives} max={maxLives} />}
            />
          );
        })}
      </ul>
    </section>
  );

  let bottomBar: ReactNode;
  if (isReveal) {
    bottomBar = view.isHost ? (
      <button
        type="button"
        disabled={isSending}
        onClick={() => void sendIntent({ kind: "advance" })}
        className="plaza-button rm-cta disabled:opacity-50"
      >
        {view.isLastRound ? t("higherLower.seeResults") : t("higherLower.next")}
      </button>
    ) : (
      <WaitingNote>{view.isLastRound ? t("higherLower.seeResults") : t("higherLower.next")}…</WaitingNote>
    );
  } else if (!alive) {
    bottomBar = (
      <WaitingNote>{me?.spectator ? t("higherLower.spectating") : t("higherLower.youAreOut")}</WaitingNote>
    );
  } else {
    const answer = view.myAnswer;
    const button = (direction: GuessDirection) => (
      <button
        type="button"
        disabled={isSending || answer !== null}
        aria-pressed={answer === direction}
        onClick={() => void sendIntent({ kind: "guess", direction })}
        className={`rm-answer rm-answer--${direction} ${answer === direction ? "rm-answer--picked" : ""}`}
      >
        {direction === "higher" ? <ArrowUpIcon /> : <ArrowDownIcon />}
        {direction === "higher" ? t("higherLower.higher") : t("higherLower.lower")}
      </button>
    );
    bottomBar = (
      <div className="grid gap-2">
        <div className="flex gap-2.5">
          {button("lower")}
          {button("higher")}
        </div>
        {answer !== null && (
          <p className="plaza-muted text-center text-[0.75rem]">{t("higherLower.lockedIn")}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <PhaseHeader
        eyebrow={t("higherLower.round", view.round, totalRounds)}
        title={t("higherLower.playingTitle")}
        right={
          me && !me.spectator ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="rm-numeric text-[1.0625rem] font-extrabold">{me.score}</span>
              <Hearts lives={me.lives} max={maxLives} />
            </div>
          ) : undefined
        }
      />
      <RoomBody className="p-5 sm:p-6">
        <RoomSplit aside={standings}>
          <div className="flex min-w-0 flex-col gap-3 lg:flex-1">
            {error && <RoomError message={error} />}

            <div
              className={`rm-hl-timer ${timerFraction > 0 && remainingMs <= 3000 ? "rm-hl-timer--urgent" : ""}`}
              role="timer"
              aria-label={`${Math.ceil(remainingMs / 1000)}s`}
            >
              <span style={{ transform: `scaleX(${timerFraction})` }} />
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="plaza-muted-2 text-[0.72rem]">
                {t(`higherLower.category.${view.settings.category}`)}
              </span>
              {me && me.streak >= 2 && (
                <span className="rm-hl-streak">🔥 {t("higherLower.streak", me.streak)}</span>
              )}
            </div>

            {view.current && (
              <ItemCard
                key={`current-${view.round}`}
                card={view.current}
                eyebrow={t(`higherLower.category.${view.current.category}`)}
                unit={t("higherLower.searches")}
                hiddenLabel={t("higherLower.hidden")}
                className="rm-hl-enter"
              />
            )}

            {view.next && (
              <p className="plaza-muted text-center text-[0.8rem]">
                {t("higherLower.question", view.next.label)}
              </p>
            )}

            {view.next && (
              <ItemCard
                key={`next-${view.round}-${isReveal ? "r" : "g"}`}
                card={view.next}
                eyebrow={t(`higherLower.category.${view.next.category}`)}
                unit={t("higherLower.searches")}
                hiddenLabel={t("higherLower.hidden")}
                tone={nextTone}
                animateValue={isReveal}
                className={nextTone === "wrong" ? "rm-hl-shake" : ""}
              />
            )}

            {isReveal && me && !me.spectator && (
              <p
                className={`rm-hl-verdict ${
                  myResult?.correct ? "rm-hl-verdict--correct" : "rm-hl-verdict--wrong"
                }`}
                role="status"
              >
                {myResult === null
                  ? t("higherLower.youAreOut")
                  : myResult.correct
                    ? `${t("higherLower.correct")} ${t("higherLower.points", myResult.points)}`
                    : me.answer === null
                      ? t("higherLower.noAnswer")
                      : t("higherLower.wrong")}
              </p>
            )}
          </div>
        </RoomSplit>
      </RoomBody>
      <RoomBottomBar>{bottomBar}</RoomBottomBar>
    </>
  );
}
