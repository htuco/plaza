# Plaza

Party-games launchpad for the crew. Mobile-first hub + isolated game modules.
See [`context/`](./context) for the full spec — it's the source of truth.

## Stack

Next.js (App Router) + TS + Tailwind + Supabase (Postgres + Realtime + anon auth) + Drizzle ORM + Vercel. See [CLAUDE.md](./CLAUDE.md) and [`context/project-overview.md`](./context/project-overview.md) for the locked decisions.

## Setup

```bash
pnpm install                    # install deps
cp .env.example .env.local      # fill in Supabase + Spotify keys
pnpm db:generate                # generate migration from schema
pnpm db:migrate                 # apply to Supabase Postgres
pnpm dev                        # local dev server (http://localhost:3000)
```

## Scripts

```bash
pnpm dev          # next dev (with Turbopack)
pnpm build        # next build
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm db:generate  # drizzle-kit generate (new migration from schema)
pnpm db:migrate   # drizzle-kit migrate (apply pending migrations)
pnpm db:studio    # drizzle-kit studio (browse DB)
```

## Layout

```
app/                  # routes (App Router)
  page.tsx            # hub: landing + create/join
  play/[room]/        # room shell (lobby, presence)
  play/[room]/[game]/ # game route — mounts the registered module client
features/             # game modules (one folder per game)
  registry.ts         # GameModule contract + catalog meta
  index.ts            # id -> module lookup
  <game>/
    types.ts          # state, intents, redacted view
    module.ts         # GameModule implementation
    client.tsx        # client UI
lib/
  db/                 # drizzle schema + client
  supabase/           # browser/server clients + middleware
  realtime/           # supabase realtime wrapper (channel helpers)
  rooms/              # room code gen + lifecycle
  music/              # spotify + iTunes (provider interface)
```

## How games plug in

A new game adds a folder under `features/<id>/`, implements `GameModule` from [`features/registry.ts`](./features/registry.ts), registers itself in [`features/index.ts`](./features/index.ts), and adds the id to `GAME_IDS` in [`lib/db/schema.ts`](./lib/db/schema.ts). The hub/room shell stays untouched.

The server is the only writer of authoritative state; clients receive **redacted** views via the module's `redact(state, playerId)`. Never short-circuit this — secrets (Imposteri roles, Asocijacije answers, Gradovi answers during writing) must not leak.

## Realtime

Supabase Realtime — Broadcast channels (`room:<CODE>`) for game events, Presence for the player list. Wrapped behind [`lib/realtime/channels.ts`](./lib/realtime/channels.ts). Vercel serverless can't hold WebSockets, so don't try.
