# Project Overview

> **Working title:** `Lobby` _(name not finalized — search & replace once decided)_

## What this is

A centralized **launchpad / hub** web app from which a group of friends jumps into
a collection of self-contained **mini-games**. The hub owns shared concerns
(landing page, game catalog, rooms/lobbies, presence, light profiles); each game
is an isolated feature module with its own rules, state, and UI.

Think "party games for the crew" — low-friction, mobile-first, you send a room
code to friends and start playing in seconds. Not a commercial product; built for
a friend group first, with the option to grow later.

## Who it's for

- Primary: a private friend group ("raja"), playing together on phones, often in
  the same room or on a call.
- Friction must be near-zero: join with a nickname + room code, no mandatory
  account.

## The games (initial scope)

| Game | One-liner | Type |
|------|-----------|------|
| **Imposteri** | Social deduction — find who doesn't know the secret word. | Realtime, multiplayer |
| **Asocijacije** | Classic 4-column word-association board; guess columns and the final solution. | Realtime, team-based |
| **Gradovi i Sela** | Pick a letter, race to fill categories (grad, selo, država, rijeka...). | Realtime, timed |
| **Guess the Song** | Play a snippet (Spotify), race to name the track/artist. | Realtime, Spotify integration |

Game rules are defined in `project-spec.md`; domain terms are defined in
`terms-of-reference.md`.

## Tech stack (locked)

- **Framework:** Next.js (App Router) + TypeScript + React
- **UI:** Tailwind CSS + **shadcn/ui** (Radix primitives)
- **Backend:** **Supabase** — Postgres + Realtime + Auth in one (handles DB, multiplayer, and guest auth)
- **Data layer:** Drizzle ORM (schema + typed queries) against Supabase Postgres; Supabase JS client for realtime + auth
- **Music:** Spotify (host connects account) for track/playlist metadata; 30s audio clip via iTunes Search API — see `project-spec.md` §4 for why
- **Deployment:** app on **Vercel**; data/realtime/auth on Supabase
- **Tooling:** pnpm, Node 20+

## Philosophy / non-goals

- Mobile-first. If it's awkward on a phone, it's wrong.
- Each game is an isolated module — a broken game must not break the hub or other games.
- Ship small, ship often. Working title and scope can change; keep modules decoupled so they can.
- **Non-goals (for now):** native apps, monetization, public matchmaking, anti-cheat, leaderboards across strangers.

## How we work — "vibe coded"

Claude Code drives implementation autonomously; the human does **QA / testing**,
not line-by-line review. So:

- Make sensible, decisive choices and keep moving — don't stop to ask about small
  stuff. Record any non-trivial decision in `terms-of-reference.md` §5.
- This `context/` folder is the source of truth. If something here is wrong or a
  clearly better path appears mid-build, flag it briefly, pick the sensible
  default, and note it — don't block on it.
- Optimize for "works correctly and is easy to QA on a phone" over cleverness.
- Keep each game module isolated so a bug in one is QA-able on its own without
  touching the hub or other games.
