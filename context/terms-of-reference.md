# Terms of Reference

Defines **scope**, **glossary**, **conventions**, and **constraints** for the
project. When `project-spec.md` says "see glossary" or "see conventions", it means
here. This is also the **decision log** — record resolved open decisions here.

---

## 1. Scope

### In scope (v1)
- Hub: landing, game catalog, create/join room via room code.
- Guest play: nickname + room code, no account required.
- Four games: Imposteri, Asocijacije, Gradovi i Sela, Guess the Song.
- Realtime multiplayer within a room.
- Deploy to Vercel (app + Postgres).

### Out of scope (for now)
- Native mobile apps.
- Monetization / payments.
- Public matchmaking with strangers; global leaderboards.
- Moderation, anti-cheat, abuse reporting.
- Localization beyond the group's language (UI language TBD; game content is in
  the group's local language).

## 2. Glossary

**Domain / app terms**
- **Hub / Launchpad** — the central app you start from; lists games and hosts rooms.
- **Room** — a session a group plays in, identified by a room code.
- **Room code** — short human-friendly code used to join a room.
- **Host** — the player who created the room; controls game choice and start.
- **Game module** — a self-contained feature implementing one game.
- **Round / Phase** — a game's internal stages (see each game's state machine).

**The games (so Claude Code understands the domain — these are regionally known party games):**
- **Imposteri** ("Impostors") — a social-deduction game. Everyone shares a secret
  word/location except hidden impostor(s) who must bluff; the group tries to find
  them by discussion and voting. (Family of Spyfall / Among Us-style party games.)
- **Asocijacije** ("Associations") — a well-known word game played on a board with
  **four columns (A, B, C, D)**. Each column has hidden hint words and a hidden
  **column solution**; one **final solution** connects all four columns. Players
  reveal hints and try to guess column solutions or the final solution.
- **Gradovi i Sela** ("Cities and Villages") — a categories game (in the family of
  Scattergories / "Stadt-Land-Fluss"). A letter is drawn; within a time limit
  everyone writes a word in each category (city, village, country, river, plant,
  animal, name...) starting with that letter. Unique valid answers score highest.
- **Guess the Song** — name-that-tune: a snippet plays (via Spotify) and players
  race to identify the title/artist.

## 3. Conventions

### Code
- **TypeScript everywhere**, `strict` mode. No `any` unless justified with a comment.
- React function components + hooks. Server Components by default; Client
  Components only where interactivity requires it (`"use client"`).
- File/folder naming: `kebab-case` for files and routes, `PascalCase` for React
  components, `camelCase` for variables/functions.
- Game state types live in `features/<game>/types.ts`; server is the single writer
  of authoritative state.
- Keep provider-specific code (realtime, Spotify, db) behind interfaces in `lib/`
  so it can be swapped.

### UI
- Mobile-first. Design and test for a phone viewport first, enhance upward.
- Use **shadcn/ui** components as the base; add them via the shadcn CLI rather
  than hand-rolling. Keep custom styling in Tailwind utility classes.
- Touch-friendly targets; account for iOS quirks (e.g. long-press, touch
  bubbling) when building interactive controls.

### Data & secrets
- All authoritative state server-side; clients get redacted views.
- No secrets in the repo. Use `.env.local` (git-ignored) and Vercel env vars;
  document keys in `.env.example`.
- Never send a player data they shouldn't see (e.g. impostor roles, hidden answers).

### Process
- This `context/` folder is the source of truth. If an instruction in chat
  conflicts with it, flag the conflict before proceeding.
- Prefer small, isolated changes. Don't refactor unrelated code in a feature PR.

## 4. Constraints & assumptions

- **Vercel serverless = no persistent WebSockets** → realtime via **Supabase
  Realtime** (see spec §2.2).
- **Spotify `preview_url` is deprecated** (2024-11-27) and null for new apps → use
  the **iTunes Search API** for the 30s audio clip; Spotify supplies metadata.
  Full Spotify in-browser playback would require Premium (upgrade path only).
  Tokens expire and must be refreshed.
- Games are turn-based/timed, not real-time-action, so moderate latency is
  acceptable.
- Player counts are small (a friend group), not internet-scale.

## 5. Decision log

Record each resolved decision with date + short rationale. Newest on top.

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-20 | Every change ships via a `feat/*`/`fix/*` (or typed) branch and a PR into `main`; no direct commits to `main`, no matter how small | The PR + Vercel Preview is the only QA surface in a vibe-coded build where the human does not review line by line |
| 2026-05-24 | Game-state broadcasts are invalidation-only; clients fetch per-player redacted views via API | Supabase room broadcasts are shared, so private answers/roles must not be embedded in one broadcast payload |
| 2026-05-24 | App name finalized: **Plaza** | resolved during scaffold; replaced working title "Lobby" |
| 2026-05-23 | UI: **shadcn/ui** + Tailwind on Next.js/React | requested; fast, clean, mobile-friendly components |
| 2026-05-23 | Backend: **Supabase** (Postgres + Realtime + Auth) | one provider for DB, multiplayer, and guest auth — least wiring for vibe-coded build |
| 2026-05-23 | Auth: **guest-only** (Supabase anonymous auth) | zero signup friction for a friend group |
| 2026-05-23 | Guess the Song audio: **iTunes preview** + Spotify metadata | Spotify `preview_url` deprecated / null for new apps |
| 2026-05-23 | Working model: **vibe coded** — Claude builds, human does QA | Claude makes decisive calls, logs them here, flags real problems |
