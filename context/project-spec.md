# Project Spec

Detailed technical reference. Read alongside `project-overview.md` (the "what")
and `terms-of-reference.md` (glossary, conventions, scope).

---

## 1. Architecture

Single Next.js (App Router) application, organized so each game is a decoupled
feature module.

```
app/
  (hub)/                 # landing, game catalog, room create/join
  play/[room]/           # shared room shell (presence, players, chat)
    imposteri/           # game module mounts inside the room shell
    asocijacije/
    gradovi-i-sela/
    guess-the-song/
  api/                   # route handlers (REST-ish), realtime auth, spotify
features/
  imposteri/             # game logic, state machine, components, types
  asocijacije/
  gradovi-i-sela/
  guess-the-song/
lib/
  db/                    # drizzle schema + client
  realtime/              # provider client + channel helpers
  rooms/                 # room/lobby lifecycle
  spotify/               # spotify api client + auth
```

Rules:
- A game module owns its state, components, and types under `features/<game>/`.
- Shared concerns (rooms, presence, players, persistence) live in `lib/` and the
  room shell, never duplicated per game.
- Games communicate with the room only through a defined interface (game
  registry: id, display name, min/max players, server state reducer, client UI).

## 2. Core systems

### 2.1 Rooms / Lobbies
- A **room** is created by a host and identified by a short **room code** (e.g. 4–6
  chars, human-friendly, no ambiguous characters).
- Players join with a **nickname + room code**. No account required.
- A room has: host, players[], selected game, status (`lobby` | `in_game` |
  `finished`), and a per-game state blob.
- Host controls game selection and start; can transfer host on disconnect.

### 2.2 Realtime  ✅ Supabase Realtime
Vercel serverless can't hold persistent WebSockets, so realtime is handled by
**Supabase Realtime** — same provider as the DB/auth, one less moving part. The
games are turn-based / timed, not twitch-action, so this is plenty.

- Use **Broadcast** channels per room (`room:<code>`) for game events, and
  **Presence** for the player list / who's connected.
- Server (route handler / server action) is the authoritative writer: validate
  intent → update Postgres → broadcast the redacted event. Clients subscribe and
  render; clients never trust each other.
- Wrap it behind a thin `lib/realtime/` interface anyway, so swapping is cheap.
- **Do not** attempt long-lived `ws://` from a Next.js route handler on Vercel.

### 2.3 Persistence
- **Supabase Postgres**. **Drizzle ORM** owns schema, migrations (checked into the
  repo), and typed queries; the Supabase JS client is used for realtime + auth.
- Authoritative writes go through server code. Enable Row Level Security as a
  backstop, but never rely on the client — clients receive derived/redacted views
  (e.g. impostors must not receive the secret word).

### 2.4 Auth  ✅ guest-only
- v1 is **guest-only** via **Supabase anonymous auth**: on first load, sign in
  anonymously to get a stable user id (survives reconnects → the player keeps
  their seat). Player picks a nickname per room.
- No email/password, no signup. A Supabase anon user can be upgraded to a real
  account later in one call if ever needed.
- **Spotify** is a separate connection used only by the **host** of Guess the Song
  (see §4) — it is not the app's login.

### 2.5 Data model (draft — refine in migrations)
High-level entities, not final:

```ts
// lib/db/schema.ts (sketch)
rooms        // id, code, hostPlayerId, gameId, status, createdAt
players      // id, roomId, nickname, anonId, isHost, connectedAt
game_states  // roomId (pk/fk), gameId, state (jsonb), updatedAt
// game-specific content tables as needed:
asocijacije_boards   // curated/generated boards
song_rounds          // spotify track ids, options, answers (per session)
```

`game_states.state` is a JSONB blob whose shape is owned by each game module's
TypeScript types. Server is the only writer.

## 3. Per-game specs

Each game is a server-authoritative **state machine**. Clients send intents; the
server validates, transitions state, persists, and broadcasts a redacted view.

### 3.1 Imposteri (social deduction)
- Setup: host starts a round; server picks a **secret word/location** from a deck.
- Roles: all players get the secret word **except** 1+ **impostor(s)** who get
  nothing (or a decoy). Impostor count scales with player count.
- Loop: players take turns giving a one-word/short clue tied to the secret;
  impostor bluffs. Open discussion phase.
- Resolution: vote phase → most-voted player is revealed. Crew wins if they
  eject an impostor; impostors win if they survive or guess the word.
- State: `phase` (`reveal` | `clues` | `discuss` | `vote` | `result`), roles map
  (server-only), votes, round number.
- **Redaction critical:** never send roles/secret to clients who shouldn't see them.

### 3.2 Asocijacije (associations)
- Board: 4 columns (A, B, C, D). Each column has 4 hidden fields + 1 **column
  solution**. One **final solution** ties all four columns together.
- Loop: two teams alternate. A team opens a field (reveals a hint word), then may
  guess a column solution or the final solution. Correct column = points; correct
  final solution = big points and ends the board.
- Wrong final-solution guess passes the turn to the other team.
- State: `board` (server-held answers), revealed fields, scores, activeTeam,
  `phase`.
- Content: needs a source of boards — start with a curated seed set (JSON), add an
  authoring/generation path later.

### 3.3 Gradovi i Sela (categories / Scattergories-style)
- Setup: a random **letter** is drawn (skip awkward letters by config).
- Categories (configurable): `Grad`, `Selo/Mjesto`, `Država`, `Rijeka/Planina`,
  `Biljka`, `Životinja`, `Ime`, `Stvar` ... starting with the drawn letter.
- Loop: fixed timer; everyone fills categories simultaneously. On time-up,
  answers are revealed.
- Scoring: unique valid answer = full points; duplicate = half; empty/invalid = 0.
  Validity disputes resolved by host or simple group vote (v1: host decides).
- State: letter, categories, per-player answers (hidden until reveal), timer,
  scores, round.

### 3.4 Guess the Song (Spotify)
- Setup: host authenticates with Spotify; choose a source playlist (host's
  playlist / curated / genre).
- Loop: server selects a track, clients hear a snippet; players race to submit a
  guess (title and/or artist). Fuzzy match the answer; faster correct = more
  points.
- **Playback (locked): Spotify metadata + iTunes preview audio.** Spotify's
  `preview_url` is deprecated and returns null for new apps (see §4), so the 30s
  audio clip comes from the free **iTunes Search API** (`previewUrl`), matched by
  track + artist. Spotify is still used to pick playlists/tracks and show cover
  art.
  - _Upgrade path (not v1):_ Spotify **Web Playback SDK** for full in-browser
    songs — but it **requires Spotify Premium** on the playing device.
- State: current round (track id, accepted answers, options if multiple-choice),
  submissions with timestamps, scores.
- See §4 for Spotify integration details.

## 4. Music integration (Spotify + iTunes)

**Why two services:** Spotify's `preview_url` was deprecated on 2024-11-27 and is
null for newly registered apps, so Spotify can no longer supply the audio clip.
v1 therefore uses Spotify for *metadata/selection* and iTunes for *audio*.

- **Spotify (host connects):** OAuth Authorization Code + PKCE. Store/refresh
  tokens server-side; never expose the client secret. Minimal scopes — read
  playlists/tracks. Used to pick a source playlist and build the round list
  (track name, artist, cover art).
- **iTunes Search API (no auth):** for each chosen track, query by `track + artist`
  to get a 30s `previewUrl` (m4a/aac). Filter rounds to tracks that resolve a
  preview; skip the ones that don't.
- **Guess checking:** fuzzy-match the player's input against track title / artist
  (normalize case, punctuation, "feat.", etc.).
- Keep all of this behind `lib/music/` exposing a clean interface
  (`getRound()`, `getPreviewUrl()`, `checkGuess()`); the game module never sees
  HTTP details.
- _Upgrade path:_ swap iTunes audio for the Spotify Web Playback SDK (full songs,
  Premium-gated) without touching game code.

## 5. Environments & config

- `.env.local` for local dev; Vercel project env vars for preview/production.
- Expected vars:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_URL` (Supabase Postgres connection string, used by Drizzle)
  - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`
  - (iTunes Search API needs no key)
- Three environments: local → Vercel **Preview** (per-branch) → **Production**.
- Never commit secrets. `.env.example` documents required keys with empty values.

## 6. Resolved decisions

See `terms-of-reference.md` §5 for the dated log. Summary:
1. Backend / realtime → **Supabase** (Postgres + Realtime + Auth).
2. Guess the Song audio → **iTunes preview**, Spotify for metadata
   (`preview_url` deprecated).
3. Accounts → **guest-only** (Supabase anonymous auth).
4. UI → **shadcn/ui** on Tailwind. Package manager **pnpm**, Node 20+ on Vercel.
