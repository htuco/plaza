# Coding Standards

> Derived from `CLAUDE.md` and `context/project-spec.md`. If those and this file
> disagree, `CLAUDE.md` wins — fix this file to match.

## TypeScript

- `strict` mode is on. Keep it on.
- No `any` without a comment justifying it. Prefer `unknown` + narrowing.
- Define types for all props, API payloads, realtime events, and DB rows.
- Type inference where obvious, explicit types at module boundaries.
- Game state types live in `features/<game>/types.ts`. `game_states.state` is a
  JSONB blob whose shape is owned by the game module.

## Next.js (App Router, v16)

- **Server Components by default.** `"use client"` only where interactivity,
  browser APIs, or realtime subscriptions genuinely require it.
- Route handlers in `app/api/` do the writing; clients send intents, never state.
- Keep the room shell (`app/play/[room]/`) generic — game-specific logic belongs
  in `features/<game>/`, mounted by the shell.
- A broken game must not break the hub or another game. Modules stay decoupled.

## Server authority & redaction (critical)

- The **server is the only writer** of authoritative state: intent → validate →
  write Postgres → broadcast a **redacted per-player view**.
- **Never send a player data they shouldn't see** — Imposteri role map and secret
  word, Asocijacije hidden answers, Gradovi answers before reveal.
- Realtime is Supabase **Broadcast** (`room:<code>`) + **Presence**. Never open a
  long-lived `ws://` from a route handler — Vercel serverless can't hold it.
- Row Level Security is a backstop, not the control. Never trust the client.

## Styling — Tailwind CSS v4

- v4 config is **CSS-based** via `@theme` in `app/globals.css`. Do **not** create
  a `tailwind.config.js`.
- **Mobile-first.** Design and verify at a phone viewport before anything else;
  touch targets big enough for thumbs; watch for iOS long-press and touch
  bubbling quirks.
- UI components come from **shadcn/ui** (`pnpm dlx shadcn@latest add ...`) — don't
  hand-roll what shadcn already ships.

## File organization

- Hub routes: `app/(hub)/`
- Room shell + game mounts: `app/play/[room]/<game>/`
- API route handlers: `app/api/`
- Game modules (logic, state machine, components, types): `features/<game>/`
- DB schema + client: `lib/db/`
- Realtime wrapper: `lib/realtime/`
- Room/lobby lifecycle: `lib/rooms/`
- Music providers behind one interface: `lib/music/`
- Shared UI: `components/`

Provider-specific code (Supabase, Spotify, iTunes) stays behind an interface in
`lib/` so it can be swapped.

## Naming

- Files and routes: `kebab-case`
- React components: `PascalCase` (`RoomLobby.tsx`)
- Variables and functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types and interfaces: `PascalCase`, no `I` prefix

## Database

- **Drizzle ORM** owns schema, migrations, and typed queries.
- Migrations are generated (`pnpm db:generate`), applied (`pnpm db:migrate`), and
  **checked into the repo**. Never hand-edit the database to dodge a migration.
- The **Supabase JS client** is for Realtime and Auth only — not for schema.

## Error handling

- try/catch around server mutations and external calls (Spotify, iTunes).
- Return a `{ success, data, error }` shape from server actions/handlers.
- Surface user-friendly messages; log the detail server-side, never leak it to
  the client payload.

## Code quality

- No commented-out code, unused imports, or stray `console.log` in committed work.
- Small, isolated changes — don't refactor unrelated code inside a feature PR.
- Keep functions under ~50 lines where it doesn't hurt readability.
