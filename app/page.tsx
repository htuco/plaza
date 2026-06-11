"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { createRoomAction, joinRoomAction } from "@/app/actions";
import { GameDetails } from "@/components/game-details";
import { PreferencesSwitcher } from "@/components/preferences-switcher";
import { SubmitButton } from "@/components/submit-button";
import { usePreferences } from "@/components/preferences-provider";
import { GAME_ICONS } from "@/components/game-icons";
import { GAMES } from "@/features/registry";
import type { GameId } from "@/lib/db/schema";

type ActionState = { error?: string } | undefined;

async function createAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return createRoomAction(formData);
}

async function joinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return joinRoomAction(formData);
}

const GAME_CARD_TONES: Record<GameId, string> = {
  imposteri: "plaza-game-card--mask",
  alias: "plaza-game-card--voice",
  "gradovi-i-sela": "plaza-game-card--paper",
  asocijacije: "plaza-game-card--puzzle",
  "guess-the-song": "plaza-game-card--music",
};

export default function HomePage() {
  const { gameCopy, t } = usePreferences();
  const [expandedGame, setExpandedGame] = useState<GameId | null>(null);

  return (
    <div className="plaza-page flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="plaza-app-header mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Plaza home">
            <span className="plaza-logo-mark inline-flex items-center justify-center">
              <Image
                src="/plaza-logo.png"
                alt="Plaza"
                width={1448}
                height={1086}
                priority
                className="h-auto w-full"
              />
            </span>
            <span className="hidden text-sm font-semibold text-[#fff5e8]/80 sm:inline">
              Game night hub
            </span>
          </Link>
          <PreferencesSwitcher />
        </header>

        <section className="plaza-home-hero py-10 sm:py-14 lg:py-20">
          <div className="plaza-hero-panel relative z-10 max-w-3xl rounded-[1.35rem] p-5 sm:p-7 lg:p-8">
            <p className="plaza-hero__kicker mb-3">{t("home.kicker")}</p>
            <h1 className="plaza-display max-w-2xl text-5xl font-black leading-[0.93] tracking-normal sm:text-6xl lg:text-7xl">
              Party igre za ekipu.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-7 text-[var(--plaza-muted)] sm:text-xl">
              Napravi sobu, pošalji kod i krenite igrati. Bez instalacije, bez naloga.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Jedan kod sobe", "Mobile-first", "Za game night"].map((pill) => (
                <span
                  key={pill}
                  className="plaza-hero-pill rounded-full px-3 py-1.5 text-sm font-semibold"
                >
                  {pill}
                </span>
              ))}
            </div>
            <RoomActionPanel />
          </div>
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-3" aria-labelledby="how-heading">
          <h2 id="how-heading" className="sr-only">
            Kako radi
          </h2>
          {["Napravi sobu", "Pošalji kod", "Igrajte"].map((step, index) => (
            <article key={step} className="plaza-how-step rounded-2xl p-4">
              <span className="plaza-how-step__number">{index + 1}</span>
              <h3 className="mt-3 text-lg font-bold">{step}</h3>
            </article>
          ))}
        </section>

        <section className="mt-12" aria-labelledby="games-heading">
          <div className="plaza-section-intro mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="plaza-label mb-2">Igre</p>
              <h2 id="games-heading" className="plaza-display text-3xl font-black sm:text-4xl">
                Izaberi ritam večeri
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6">
              Brze runde, jasna pravila i dovoljno haosa da se stol zagrije.
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {GAMES.map((game) => {
              const soon = game.availability === "soon";
              const copy = gameCopy(game.id);
              const expanded = expandedGame === game.id;
              return (
                <li
                  key={game.id}
                  className={`plaza-game-card ${GAME_CARD_TONES[game.id]} overflow-hidden rounded-2xl ${
                    expanded ? "plaza-game-card--selected" : ""
                  } ${soon ? "opacity-75" : ""}`}
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedGame(expanded ? null : game.id)}
                    className="min-h-[15rem] w-full p-5 text-left"
                  >
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <span className="plaza-game-card__icon" aria-hidden="true">
                          {GAME_ICONS[game.id]}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                            soon ? "plaza-status-review" : "plaza-status-valid"
                          }`}
                        >
                          {soon ? "Uskoro" : game.id === "guess-the-song" ? "Demo" : "Spremno"}
                        </span>
                      </div>
                      <div className="mt-5">
                        <h3 className="text-2xl font-black">{copy.displayName}</h3>
                        <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--plaza-muted)]">
                          {copy.tagline}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                        <span className="plaza-player-badge rounded-full px-3 py-1 text-xs font-bold">
                          {game.minPlayers}-{game.maxPlayers} igrača
                        </span>
                        <span className="plaza-card-arrow" aria-hidden="true">
                          {expanded ? "-" : "+"}
                        </span>
                      </div>
                    </div>
                  </button>
                  {expanded && <GameDetails gameId={game.id} />}
                </li>
              );
            })}
          </ul>
        </section>

        <footer className="mt-12 pb-4 text-center text-xs text-[#fff5e8]/65">
          <Link href="/" className="hover:text-[#fff5e8]">
            Plaza
          </Link>{" "}
          / {t("home.footer")}
        </footer>
      </main>
    </div>
  );
}

function RoomActionPanel() {
  const [nickname, setNickname] = useState("");
  const [createState, createFormAction] = useActionState<ActionState, FormData>(
    createAction,
    undefined,
  );
  const [joinState, joinFormAction] = useActionState<ActionState, FormData>(joinAction, undefined);
  const { localizeError, t } = usePreferences();

  return (
    <form action={createFormAction} className="plaza-action-panel mt-7 rounded-2xl p-4 sm:p-5">
      <label className="flex flex-col gap-2">
        <span className="plaza-muted text-sm font-semibold">{t("form.nickname")}</span>
        <input
          name="nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          required
          maxLength={20}
          autoComplete="off"
          placeholder={t("form.nicknamePlaceholder")}
          className="plaza-input h-12 rounded-xl px-4 text-base"
        />
      </label>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.1fr]">
        <div className="plaza-action-primary flex flex-col gap-2">
          <SubmitButton>{t("form.startRoom")}</SubmitButton>
          {createState?.error && (
            <p className="text-sm text-[var(--plaza-danger)]">
              {localizeError(createState.error)}
            </p>
          )}
        </div>

        <div className="plaza-join-strip rounded-xl p-2">
          <label className="sr-only" htmlFor="home-room-code">
            {t("form.roomCode")}
          </label>
          <span className="hidden px-2 text-sm font-bold text-[var(--plaza-muted)] sm:inline">
            Imaš kod?
          </span>
          <input
            id="home-room-code"
            name="code"
            maxLength={5}
            autoComplete="off"
            inputMode="text"
            placeholder={t("form.roomCodePlaceholder")}
            className="plaza-input h-11 min-w-0 flex-1 rounded-lg px-3 text-center text-base font-bold uppercase tracking-[0.22em]"
          />
          <button
            type="submit"
            formAction={joinFormAction}
            className="plaza-button-secondary h-11 rounded-lg px-4 text-sm font-bold"
          >
            {t("form.join")}
          </button>
          {joinState?.error && (
            <p className="w-full px-2 pt-1 text-sm text-[var(--plaza-danger)]">
              {localizeError(joinState.error)}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
