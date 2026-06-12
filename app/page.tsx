"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { GameDetails } from "@/components/game-details";
import { PreferencesSwitcher } from "@/components/preferences-switcher";
import { usePreferences } from "@/components/preferences-provider";
import { SpotlightStage } from "@/components/spotlight-stage";
import { LandingActionCard } from "@/components/landing/landing-action-card";
import { LiveTableTray } from "@/components/landing/live-table-tray";
import { TableDecorBack, TableDecorFront } from "@/components/landing/table-decor";
import { TableScene } from "@/components/landing/table-scene";
import { GAME_ICONS } from "@/components/game-icons";
import { GAMES } from "@/features/registry";
import type { GameId } from "@/lib/db/schema";

const GAME_CARD_TONES: Record<GameId, string> = {
  imposteri: "plaza-game-card--mask",
  alias: "plaza-game-card--voice",
  "gradovi-i-sela": "plaza-game-card--paper",
  asocijacije: "plaza-game-card--puzzle",
  "guess-the-song": "plaza-game-card--music",
};

const LANDING_COPY = {
  en: {
    headerTag: "Game night hub",
    titleLead: "Party games",
    titleEmphasis: "for the crew.",
    subtitle: "Create a room, send the code, and start playing. No installs, no accounts.",
    pills: ["One room code", "Mobile-first", "For game night"],
    scroll: "scroll",
    scrollLabel: "Scroll to How it works",
    actionTitle: "Your table is waiting",
    joinPrompt: "Have a code?",
    howLabel: "How it works",
    howTitle: "Three steps to the table",
    howSteps: [
      ["Create a room", "Add your name and get a five-letter code. No account needed."],
      ["Send the code", "Friends enter it on their phones and take a seat at the table."],
      ["Play", "The host picks a game and the rounds start right away."],
    ],
    gamesLabel: "Games",
    gamesTitle: "Pick the rhythm of the night",
    gamesIntro: "Fast rounds, clear rules, and just enough chaos to warm up the table.",
    statuses: {
      ready: "Ready",
      soon: "Soon",
      demo: "Demo",
    },
  },
  bs: {
    headerTag: "Game night hub",
    titleLead: "Party igre",
    titleEmphasis: "za ekipu.",
    subtitle: "Napravi sobu, pošalji kod i krenite igrati. Bez instalacije, bez naloga.",
    pills: ["Jedan kod sobe", "Mobile-first", "Za game night"],
    scroll: "skrolaj",
    scrollLabel: "Skrolaj do sekcije Kako radi",
    actionTitle: "Tvoj sto te čeka",
    joinPrompt: "Imaš kod?",
    howLabel: "Kako radi",
    howTitle: "Tri koraka do stola",
    howSteps: [
      ["Napravi sobu", "Upiši ime, dobiješ kod od pet slova. Bez naloga."],
      ["Pošalji kod", "Raja ga ukuca na svom telefonu i sjedne za sto."],
      ["Igrajte", "Domaćin bira igru i runde kreću odmah."],
    ],
    gamesLabel: "Igre",
    gamesTitle: "Izaberi ritam večeri",
    gamesIntro: "Brze runde, jasna pravila i dovoljno haosa da se stol zagrije.",
    statuses: {
      ready: "Spremno",
      soon: "Uskoro",
      demo: "Demo",
    },
  },
} as const;

const HOW_STEP_PIECES: ReactNode[] = [
  <span
    key="tile"
    className="plaza-piece plaza-piece-tile"
    style={{ "--piece-rot": "-7deg" } as CSSProperties}
    aria-hidden="true"
  >
    P
  </span>,
  <span
    key="card"
    className="plaza-piece plaza-piece-card"
    style={{ "--piece-rot": "8deg" } as CSSProperties}
    aria-hidden="true"
  />,
  <span
    key="die"
    className="plaza-piece plaza-piece-die"
    style={{ "--piece-rot": "-10deg" } as CSSProperties}
    aria-hidden="true"
  />,
];

export default function HomePage() {
  const { gameCopy, language, t } = usePreferences();
  const copy = LANDING_COPY[language];
  const [expandedGame, setExpandedGame] = useState<GameId | null>(null);

  return (
    <SpotlightStage className="flex flex-1 flex-col">
      <header className="plaza-nav">
        <div className="plaza-nav__inner mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="plaza-brand-link" aria-label="Plaza home">
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
            <span className="plaza-nav__tag hidden pl-3 text-xs font-semibold sm:inline">
              {copy.headerTag}
            </span>
          </Link>
          <PreferencesSwitcher />
        </div>
      </header>

      <main className="flex-1">
        {/* Immersive hero — an interactive game table: scattered pieces
            parallax with the cursor, the die rolls, cards flip, and the
            create/join flow sits on the table as an invitation card. */}
        <TableScene
          back={<TableDecorBack />}
          front={<TableDecorFront />}
          className="flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden"
        >
          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-14 lg:px-8">
            <div className="plaza-scene__drift" style={{ "--drift": 0.16 } as CSSProperties}>
              <p
                className="plaza-hero__kicker plaza-enter mb-4"
                style={{ "--enter-delay": "60ms" } as CSSProperties}
              >
                {t("home.kicker")}
              </p>
              <h1
                className="plaza-hero-title plaza-enter max-w-3xl"
                style={{ "--enter-delay": "140ms" } as CSSProperties}
              >
                {copy.titleLead} <em>{copy.titleEmphasis}</em>
              </h1>
              <p
                className="plaza-hero__subtitle plaza-enter mt-5 max-w-xl text-lg leading-7 sm:text-xl"
                style={{ "--enter-delay": "240ms" } as CSSProperties}
              >
                {copy.subtitle}
              </p>
              <div
                className="plaza-enter mt-5 flex flex-wrap gap-2"
                style={{ "--enter-delay": "320ms" } as CSSProperties}
              >
                {copy.pills.map((pill) => (
                  <span key={pill} className="plaza-hero-pill px-3.5 py-1.5 text-sm font-semibold">
                    {pill}
                  </span>
                ))}
              </div>
              <div
                className="plaza-enter"
                style={{ "--enter-delay": "420ms" } as CSSProperties}
              >
                <LandingActionCard actionTitle={copy.actionTitle} joinPrompt={copy.joinPrompt} />
              </div>
            </div>

            {/* The table tray — deck, featured card, chips, code tiles. */}
            <div
              className="plaza-enter plaza-scene__drift mt-8 lg:mt-0"
              style={{ "--enter-delay": "540ms", "--drift": -0.3 } as CSSProperties}
            >
              <LiveTableTray />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-5 hidden justify-center sm:flex">
            <a href="#how-heading" className="plaza-scroll-hint" aria-label={copy.scrollLabel}>
              {copy.scroll}
            </a>
          </div>
        </TableScene>

        {/* Kako radi — three steps wired together like a table plan. */}
        <section
          className="mx-auto w-full max-w-7xl px-4 pb-4 pt-14 sm:px-6 lg:px-8"
          aria-labelledby="how-heading"
        >
          <div className="plaza-section-intro mb-6">
            <p className="plaza-label mb-2">{copy.howLabel}</p>
            <h2 id="how-heading" className="plaza-display text-3xl font-extrabold sm:text-4xl">
              {copy.howTitle}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-x-11">
            {copy.howSteps.map(([title, note], index) => (
              <article key={title} className="plaza-how-step p-5">
                <span className="plaza-how-step__number">{index + 1}</span>
                {HOW_STEP_PIECES[index]}
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="plaza-how-step__note mt-1.5 text-sm leading-6">{note}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Game catalog */}
        <section
          className="mx-auto w-full max-w-7xl px-4 pb-16 pt-14 sm:px-6 lg:px-8"
          aria-labelledby="games-heading"
        >
          <div className="plaza-section-intro mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="plaza-label mb-2">{copy.gamesLabel}</p>
              <h2 id="games-heading" className="plaza-display text-3xl font-extrabold sm:text-4xl">
                {copy.gamesTitle}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6">
              {copy.gamesIntro}
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GAMES.map((game, index) => {
              const soon = game.availability === "soon";
              const gameInfo = gameCopy(game.id);
              const expanded = expandedGame === game.id;
              return (
                <li
                  key={game.id}
                  className={`plaza-game-card plaza-enter ${GAME_CARD_TONES[game.id]} ${
                    expanded ? "plaza-game-card--selected" : ""
                  } ${soon ? "opacity-80" : ""}`}
                  style={{ "--enter-delay": `${80 + index * 70}ms` } as CSSProperties}
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedGame(expanded ? null : game.id)}
                    className="min-h-56 w-full p-5 text-left"
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
                          {soon
                            ? copy.statuses.soon
                            : game.id === "guess-the-song"
                              ? copy.statuses.demo
                              : copy.statuses.ready}
                        </span>
                      </div>
                      <div className="mt-5">
                        <h3 className="plaza-display text-2xl font-extrabold">
                          {gameInfo.displayName}
                        </h3>
                        <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--plaza-muted)]">
                          {gameInfo.tagline}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                        <span className="plaza-player-badge rounded-full px-3 py-1 text-xs font-bold">
                          {t("home.players", game.minPlayers, game.maxPlayers)}
                        </span>
                        <span className="plaza-card-arrow" aria-hidden="true">
                          {expanded ? "−" : "+"}
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
      </main>

      <footer className="plaza-footer py-6 text-center text-xs">
        <Link href="/" className="plaza-wordmark plaza-footer__brand text-sm">
          Plaza
        </Link>
        <span className="px-2">/</span>
        {t("home.footer")}
      </footer>
    </SpotlightStage>
  );
}
