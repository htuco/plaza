"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { GameDetails } from "@/components/game-details";
import { GAMES } from "@/features/registry";
import { CreateRoomForm } from "@/components/create-room-form";
import { JoinRoomForm } from "@/components/join-room-form";
import { usePreferences } from "@/components/preferences-provider";
import type { GameId } from "@/lib/db/schema";

export default function HomePage() {
  const { gameCopy, t } = usePreferences();
  const [expandedGame, setExpandedGame] = useState<GameId | null>(null);

  return (
    <div className="plaza-page flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:py-16">
        <header className="mb-10 text-center">
          <div className="mx-auto mb-4 h-px w-16 bg-[var(--plaza-accent)]" />
          <h1 className="sr-only">Plaza</h1>
          <span className="plaza-logo-shell mx-auto inline-flex items-center justify-center">
            <Image
              src="/plaza-logo.png"
              alt="Plaza"
              width={1448}
              height={1086}
              priority
              className="h-auto w-full max-w-[200px]"
            />
          </span>
          <p className="plaza-muted mt-2">
            {t("home.subtitle")}
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <Panel title={t("home.startRoom")}>
            <CreateRoomForm />
          </Panel>
          <Panel title={t("home.joinRoom")}>
            <JoinRoomForm />
          </Panel>
        </section>

        <section className="mt-12">
          <h2 className="plaza-label mb-4">{t("home.games")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {GAMES.map((game) => {
              const soon = game.availability === "soon";
              const copy = gameCopy(game.id);
              const expanded = expandedGame === game.id;
              return (
                <li
                  key={game.id}
                  className={`plaza-card overflow-hidden rounded-lg transition-colors ${
                    soon ? "opacity-75" : "hover:border-[var(--plaza-line-strong)]"
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedGame(expanded ? null : game.id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-medium">{copy.displayName}</h3>
                      <div className="flex items-center gap-2">
                        {soon && (
                          <span className="plaza-status-review rounded px-2 py-1 text-xs font-medium">
                            {t("game.soon")}
                          </span>
                        )}
                        <span className="plaza-muted-2 text-xs">
                          {game.minPlayers}-{game.maxPlayers}
                        </span>
                      </div>
                    </div>
                    <p className="plaza-muted mt-1 text-sm">{copy.tagline}</p>
                  </button>
                  {expanded && <GameDetails gameId={game.id} />}
                </li>
              );
            })}
          </ul>
        </section>

        <footer className="plaza-muted-2 mt-12 text-center text-xs">
          <Link href="/" className="hover:text-[var(--plaza-accent)]">
            Plaza
          </Link>{" "}
          / {t("home.footer")}
        </footer>
      </main>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="plaza-panel rounded-lg p-5">
      <h2 className="mb-3 font-medium">{title}</h2>
      {children}
    </div>
  );
}
