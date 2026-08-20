# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth

This repo is currently **docs-only** — no application code has been scaffolded yet. The `context/` folder is the canonical spec; read it before doing any work:

- [context/project-overview.md](context/project-overview.md) — the "what" and why
- [context/project-spec.md](context/project-spec.md) — architecture, per-game state machines, integrations
- [context/terms-of-reference.md](context/terms-of-reference.md) — glossary, conventions, **decision log** (§5)
- [context/git-workflow.md](context/git-workflow.md) — branches, Conventional Commits, PR template
- [context/last-feature.md](context/last-feature.md) — rolling log of the most recently completed feature; update at end of each feature
- [context/coding-standards.md](context/coding-standards.md) — TS/Next/Tailwind rules, redaction rules, file organization
- [context/ai-interaction.md](context/ai-interaction.md) — how Claude works here: the feature loop, commit rules, review focus
- [context/current-feature.md](context/current-feature.md) — the single active feature, driven by `/feature`
- [context/features/](context/features/) — one spec per planned feature/fix; `/feature load` reads from here

If a chat instruction conflicts with `context/`, flag it before proceeding. If a non-trivial decision is made mid-build, record it in `terms-of-reference.md` §5 with the date.

## Working model — "vibe coded"

The human does QA, not line-by-line review. Make decisive choices, keep moving, and log them. Optimize for "works correctly and is easy to QA on a phone" over cleverness. Don't block on small calls — pick a sensible default and note it.

After completing a feature, move the **Current** entry in `context/last-feature.md` into **History** (newest first) and start a new Current.

## Tech stack (locked — see decision log)

- **Next.js (App Router)** + TypeScript (`strict`) + React (Server Components by default; `"use client"` only where needed)
- **Tailwind CSS** + **shadcn/ui** (add components via `pnpm dlx shadcn@latest add ...`, not hand-rolled)
- **Supabase** — Postgres + Realtime + **anonymous auth** (one provider for DB, multiplayer, guest sign-in)
- **Drizzle ORM** owns schema + migrations + typed queries against Supabase Postgres; **Supabase JS client** is used for Realtime + Auth
- **Music:** Spotify (OAuth, host-only, metadata/playlist selection) + **iTunes Search API** for the 30s audio clip (Spotify `preview_url` is deprecated and null for new apps)
- **Deploy:** Vercel (Production tracks `main`; every branch push gets a Preview)
- **Tooling:** **pnpm**, Node 20+

## Architecture rules

The shape (once scaffolded) — enforce these boundaries:

```
app/(hub)/                     # landing, game catalog, room create/join
app/play/[room]/<game>/        # shared room shell; each game mounts inside
app/api/                       # route handlers, realtime auth, spotify
features/<game>/               # game logic, state machine, components, types
lib/db/                        # drizzle schema + client
lib/realtime/                  # provider client + channel helpers (thin wrapper)
lib/rooms/                     # room/lobby lifecycle
lib/music/                     # spotify + itunes behind one interface
```

- A **game module** owns its state, components, and types under `features/<game>/`. Shared concerns (rooms, presence, players, persistence) live in `lib/` and the room shell — never duplicated per game.
- Games communicate with the room only through the game registry interface (id, display name, min/max players, server reducer, client UI).
- A broken game must not break the hub or other games. Keep modules decoupled.
- Provider-specific code (Realtime, Spotify, DB) lives behind interfaces in `lib/` so it can be swapped.

## Server authority & redaction (critical)

- **Server is the only writer** of authoritative state. Clients send intents → server validates → updates Postgres → broadcasts a **redacted per-player view**.
- **Never send a player data they shouldn't see.** Examples that have to stay server-side:
  - Imposteri: role map and secret word (impostors must not receive the secret; non-impostors must not learn who the impostor is)
  - Asocijacije: hidden column answers and the final solution
  - Gradovi i Sela: other players' answers until reveal
- Realtime: **Vercel serverless can't hold WebSockets.** Use Supabase Realtime — **Broadcast** channels per room (`room:<code>`) for events, **Presence** for the player list. Do **not** attempt long-lived `ws://` from a Next.js route handler.
- Enable Supabase Row Level Security as a backstop, but never rely on the client.

## Conventions

- TypeScript everywhere, `strict`. No `any` without a justifying comment.
- Naming: `kebab-case` files/routes, `PascalCase` React components, `camelCase` vars/functions.
- Game state types live in `features/<game>/types.ts`. `game_states.state` is a JSONB blob whose shape is owned by the game module.
- **Mobile-first.** Design and test for a phone viewport first; touch-friendly targets; account for iOS quirks (long-press, touch bubbling).
- Small, isolated changes — don't refactor unrelated code in a feature PR.

## Commands (once scaffolded)

```bash
pnpm install                                   # install deps
pnpm dlx shadcn@latest init                    # one-time shadcn setup
pnpm dlx shadcn@latest add button card dialog  # add shadcn components as needed
pnpm drizzle-kit generate                      # generate migration from schema
pnpm drizzle-kit migrate                       # apply migration to the database
pnpm dev                                       # local dev server
```

Migrations are checked into the repo. Pick package scripts (`lint`, `test`, `typecheck`, `build`) when scaffolding and add them here.

## Environment variables

Documented in `.env.example` (empty values; never commit secrets). Required:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (Supabase Postgres connection string, used by Drizzle)
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`
- (iTunes Search API needs no key)

Three environments: local → Vercel Preview (per-branch) → Production.

## Git workflow

- **Every change — feature, fix, or one-line tweak — goes on its own branch and reaches `main` through a PR. Never commit or push directly to `main`.** No change is too small to skip the branch + PR; open a PR for every one.
- Branch off `main` as `type/short-scope` (e.g. `feat/imposteri-vote-phase`, `fix/gradovi-timer-reset`). New work → `feat/*`, repairs → `fix/*`, everything else takes its Conventional Commit type (`chore/*`, `docs/*`, …).
- One logical change per branch, one PR per branch, PR always targets `main`.
- **Conventional Commits**, lowercase, no trailing period. Summary = what; body = **why** (not how).
- Types: `feat | fix | refactor | chore | docs | style | test | perf | build | ci`.
- Scopes: `imposteri | asocijacije | gradovi | guess-the-song | hub | rooms | realtime | db | spotify | auth`.
- PR title mirrors commit summary; fill the PR template in [context/git-workflow.md](context/git-workflow.md). Verify the Vercel Preview before merge.

## AI workflow tooling

Imported from [ai-workflow-kit](https://github.com/htuco/ai-workflow-kit). The core loop:

```
write a spec in context/features/  →  /feature load <spec>  →  /feature start  →  build
                                   →  /feature review       →  /feature complete   # branch + PR
```

**Skills** (`.claude/skills/`)

| Skill | Does |
| ----- | ---- |
| `/feature load\|start\|review\|explain\|test\|complete` | The feature lifecycle, spec → PR |
| `/cleanup check\|run` | Housekeeping audit (stale TODOs, console.log, drifted context files) |
| `/list-components` | Inventory of `components/` and `features/<game>/` components |
| `/research <prompt-name>` | Run a research prompt from `context/research/`, docs only, no code changes |
| `/import-workflow` | Re-run or update this kit import |

**Subagents** (`.claude/agents/`)

| Agent | Does |
| ----- | ---- |
| `code-scanner` | Security / performance / quality scan, including server-authority and redaction checks |
| `refactor-scanner` | DRY / duplication audit with extraction suggestions |
| `ui-reviewer` | Visual, responsive, and a11y review via Playwright |
| `auth-auditor` | Supabase auth, RLS, and per-player redaction audit |

Scaffold a new subagent from `.claude/agent-templates/_new-subagent.template.md`.

**`/feature complete` opens a PR — it does not merge to `main`.** The kit ships with a
merge-to-main flow; it was adapted to this repo's no-exceptions PR rule.

**MCP** (`.mcp.json`): `context7` (live library docs) and `playwright` (drives `ui-reviewer`).
`.mcp.json` is committed and holds a `${CONTEXT7_API_KEY}` placeholder — **never a real key**.
The actual key lives in `.claude/settings.local.json` (gitignored) under `env`, which is where
any future secret belongs. New machine: copy the key there, or export `CONTEXT7_API_KEY` in your shell.

## Out of scope (v1)

Native apps, monetization, public matchmaking with strangers, global leaderboards, moderation/anti-cheat, localization beyond the friend group's language. Don't build for these.

## Naming note

Working title is **Lobby** — not finalized. When the name lands, search-and-replace the working title across the repo.
