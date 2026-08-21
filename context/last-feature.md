# Last Feature

Rolling log of the **most recently completed feature**, so Claude Code has fresh
context on where the project stands. Update the **Current** section at the end of
each feature; move the old one into **History** (newest first).

Each entry: what was built, key files/areas touched, decisions made, and what's
next.

---

## Current

**Feature:** Room-surface redesign — shell, lobby, share/QR and all six game screens
**Status:** done, pending phone QA
**Date:** 2026-08-21

**Summary**
- Implemented `design_handoff_plaza_redesign/` across every authenticated screen (join, lobby host + guest, share/QR sheet, empty room, leave dialog, and all six games). The landing page is deliberately untouched apart from an `id="join"` anchor so the empty-room screen's secondary action has somewhere to go.
- **New room shell** (`components/room-shell.tsx` + `app/room.css`): a 56px top bar with a hairline, a body that scrolls, and a bottom bar holding the screen's single primary action within one-hand reach. Every game client now renders its own body + bottom bar inside the shell, so the CTA sits in the same place across games.
- **Room code is the hero of the lobby**: tap-to-copy cells (`components/room-code.tsx`, four placements — join hero, lobby, compact guest row, in-game chip) with Share + "Generate QR" as the primary action pair. Guests keep both. The QR sheet repeats the code in monospace under the QR so it can be read out loud.
- **Per-screen work**: role card that flips and re-hides (Imposteri 05), vote rows with a countdown ring (06), tinted round verdict + vote bars (07), claim/next cards with a danger/success answer pair (Veće ili Manje 08), word card with a deliberately 2:1 correct-vs-skip action pair (Alias 10), 66px letter tile + 52px answer rows (Gradovi i Sela 11), a real 4×4 board with column headers and a solution strip (Asocijacije 12), and a 12-bar clip waveform + match chips (Guess the Song 13).
- **Responsive beyond the handoff**: the handoff draws a fixed 390px phone. The shell is mobile-first, becomes a framed column at 640px, and widens on desktop — screens with two jobs (lobby, Asocijacije, Gradovi i Sela, Veće ili Manje) split into two panes via `RoomSplit`, the rest stay a capped single column.
- New shared pieces: `components/room-game-ui.tsx` (phase header, phase segments, standings row, loading/error/waiting), `components/room-icons.tsx` (the handoff's glyphs as components), `GameIcon` in `components/game-icons.tsx`.
- ~40 new translation keys (en + bs) for the redesign's copy.
- Verified in the browser at 320 / 390 / 1280 / 1440 across the lobby and every game screen: no horizontal overflow anywhere, bars stay fixed, and the geometry the handoff specifies (310px leave dialog, 180px artwork, 12 × 6px bars, 2:1 Alias actions) measures correct.

**Touched**
- `app/room.css` (new), `app/globals.css` (imports it)
- `components/room-shell.tsx`, `components/room-game-ui.tsx`, `components/room-icons.tsx` (new)
- `components/{room-code,share-room,game-room-header,game-details,game-icons,join-lobby-form,leave-room-button,submit-button,preferences-switcher,preferences-provider}.tsx`
- `app/play/[room]/{page-level shell,room-lobby,not-found}` and `app/play/[room]/[game]/page.tsx`
- `features/{imposteri,alias,gradovi-i-sela,asocijacije,guess-the-song,higher-lower}/client.tsx`
- `app/page.tsx` (anchor only), `eslint.config.mjs`

**Decisions**
- **Kept the warm "kasna večer za stolom" theme instead of the handoff's dark #0F0F16/#6C69FF scene**, on the user's explicit instruction mid-build ("keep the theme, this warm yellow theme, just move some things around"). The redesign was therefore implemented as *structure*: layout, hierarchy, geometry and copy follow the handoff; colour, type (Geist + Bricolage display + Geist Mono rather than Poppins + JetBrains Mono) and elevation come from the existing tokens. Room screens keep following the light/dark preference.
- **Desktop is a first-class size**, also on the user's instruction. The handoff's fixed phone column is the mobile-first base, not the ceiling.
- Guests see the players card as well as the selected game's rules (the handoff's screen 03 shows only rules) — knowing who is in the room matters more than matching that one screen exactly.
- Tap-to-copy shows a confirmation rather than a permanent "tap to copy" label, matching the handoff's idle screens; the space is reserved so copying never shifts the layout.
- Asocijacije column guesses live behind their solution cell (tap the "?" to open a field) — the 4×4 grid has no room for four inline inputs.
- `app/room.css` is imported at the top of `globals.css`, so the two rules that override existing `.plaza-*` base styles use doubled selectors to win on specificity rather than order.
- `design_handoff_*/` is excluded from ESLint: the bundled design-system JS is reference material, not app code, and was producing 22 errors / 163 warnings.

**Open / Next**
- **Phone QA needed**: real-device pass on the room shell (iOS safe-area padding on the bottom bar, the scrolling body vs. Safari's dynamic toolbar, tap targets on the 4×4 board).
- Game icons are still emoji placeholders — the handoff asks for real icons.
- `app/globals.css` now carries dead rules for the app screens the redesign replaced (old `.plaza-code-hero`, `.plaza-role-flip`, `.plaza-asoc-*`, etc.). Left in place deliberately to avoid touching landing styles in this PR; worth a follow-up `/cleanup` pass.
- Refresh `context/project-overview.md`'s game table to match the live registry (still stale, flagged in prior features).


---

## History

### 2026-08-21 - Guess the Song — synchronized countdown & autoplay

**Feature:** Guess the Song — synchronized countdown & autoplay
**Status:** done, pending phone QA
**Date:** 2026-08-21

**Summary**
- Every round (first round and every subsequent one) now opens with a server-timestamped `countdown` phase (3s, `COUNTDOWN_SECONDS`) instead of the host having to press "start"/"next round" and each player having to press play on their own `<audio controls>` element.
- New state fields on `GuessTheSongState`/`GuessTheSongView`: `playbackStartAt` (epoch ms — when countdown ends and playback should start) and `roundEndAdvanceAt` (epoch ms — when round-end auto-advances to the next round). Same "server sets a deadline, any client can resolve once it passes" pattern already used for Imposteri's vote deadline.
- New intents: `resolve-countdown` (anyone, once `playbackStartAt` passes → flips `countdown` to `playing`) and `next-round` is now callable by **anyone** once `roundEndAdvanceAt` passes (previously host-only); host can still press it early to skip the reveal pause.
- Full round progression is automatic end-to-end: `countdown` → `playing` → (everyone guesses or timer expires) → `round-end` (5s reveal pause, `ROUND_END_PAUSE_SECONDS`) → auto `next-round` → `countdown` → … → `finished`. No more manual "Next round" tap required (host keeps a ghost-button early-skip only).
- **Autoplay unlock:** mobile browsers block autoplaying audio with sound until a real user gesture happens on the page. Added a persistent banner ("Tap to enable music for this game") shown whenever `!audioUnlocked`; one tap plays+immediately-pauses a silent clip, satisfying the browser's autoplay policy for the rest of the session. State persisted in `localStorage` (`plaza:song-audio-unlocked`) so it survives across rounds/reloads. A fallback "Tap to play" button still appears during `playing` if a client is unlocked-false or autoplay got blocked anyway.
- The `<audio>` element is now mounted once across `countdown`/`playing`/`round-end` (not remounted per phase) so it doesn't lose its buffered clip; it's visually hidden and has no `controls` (manual scrubbing would desync players since playback is meant to be simultaneous).
- **Music now stops the instant the round leaves `"playing"`** (round-end, host early end-round, or the next round's countdown) — a bug where the previous round's clip kept playing into the reveal screen is fixed with an effect that pauses+resets `currentTime` whenever `view.phase !== "playing"`.
- **Guess matching tightened to exact-match only** (after case/diacritic/punctuation normalization) — the previous fuzzy containment logic (`normalizedAnswer.length >= 4 && normalizedGuess.includes(normalizedAnswer)`, plus a loose 0.6 length-ratio branch) was accepting near-misses like "Cirkez" for "Cirke". Multi-word titles still accept a guess that exactly matches just one significant (3+ char) word of the title (e.g. guessing "queen" still credits "Bohemian Rhapsody" by an artist named Queen), but no more typo tolerance at all — confirmed explicitly with the user over the softer alternative (typo-tolerant for longer words).
- `app/api/rooms/[room]/songs/start/route.ts` now starts the room in `countdown` (not `playing`) with `playbackStartAt` set.
- Added `song.countdownTitle`, `song.getReady`, `song.autoNextRound`, `song.autoResults`, `song.unlockAudio`, `song.unlockAudioHint`, `song.tapToPlay` translation keys (en + bs), plus bs error strings for the three new reducer errors (`No countdown is running.`, `Countdown is still running.`, `Still showing the answer.`).
- Added `.plaza-count-pulse` scale-in animation for the 3-2-1 digits in `app/globals.css`, registered in the existing `prefers-reduced-motion` exclusion block.
- Validated with `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/eslint features/guess-the-song components/preferences-provider.tsx "app/api/rooms/[room]/songs/start/route.ts"`.

**Touched**
- `features/guess-the-song/{types,module,client}.tsx`
- `app/api/rooms/[room]/songs/start/route.ts`
- `components/preferences-provider.tsx`
- `app/globals.css`
- `context/last-feature.md`

**Decisions**
- Confirmed directly with the user: audio-unlock via a one-time tap banner (not autoplay-then-fallback-button), full auto-advance through the whole game (not just the countdown), and strict exact-match guessing (not typo-tolerant) — all recorded here since they're non-obvious product calls, not just implementation details.
- Kept a host-only early-skip button in `round-end` (bypasses `roundEndAdvanceAt`) even though progression is otherwise fully automatic — useful if the table is ready before the 5s pause ends; does not contradict "no manual button needed" since it's optional, not required.
- `previewUrl` is now exposed to the client during `countdown` too (not just `playing`/`round-end`) so the clip can preload without revealing title/artist (`reveal` stays null until `round-end`).

**Open / Next**
- **Phone QA needed**: verify two+ phones actually start the clip at the same instant after the countdown, that the unlock banner tap reliably satisfies iOS Safari's autoplay policy across rounds, and that music stops immediately on round-end.
- If the unlock-tap still gets blocked on some browsers even after a real gesture, consider muting+autoplaying (allowed without a gesture) and unmuting on the unlock tap instead.
- Refresh `context/project-overview.md`'s game table to match the live registry (still stale, flagged in a prior feature).

### 2026-08-20 - Higher or Lower — new game module

**Feature:** Higher or Lower — new game module
**Status:** done
**Date:** 2026-08-20

**Summary**
- Added a sixth game to the registry: **Higher or Lower** (`higher-lower`, display name "Veće ili Manje"). Guess whether the next item's value is higher or lower than the current one; a wrong guess ends that player's run.
- Content is a curated static deck (`features/higher-lower/items.ts`) — no live API, matching the "vibe coded" philosophy and Asocijacije's/Alias's content pattern. Three categories: `internet` (YouTuber/streamer subscribers, social follower counts, song streams, movie box office), `trivia` (country/city population, animal facts, historical years, mountains/rivers), `regional` (Balkan-relevant population/geography/history). ~16 items per category.
- Core mechanic: every player in the room plays the **same shuffled item sequence independently and simultaneously** — no turn-passing. Each player's `position` (chain length) and `alive` flag are tracked per-player; a wrong guess freezes that player's score. Round ends when everyone is out. This single mechanic supports solo play (`minPlayers: 1`) and any group size/1v1 without a turn-order special case.
- Redaction: each player's view only ever shows their own confirmed chain (values) plus the next item's label with no value — never the value of an item they haven't personally guessed on yet.
- New module follows the established `GameModule` contract exactly (`initialState`/`reduce`/`redact`/`ClientComponent`), reusing the `normalizeState`/`isXIntent` guard pattern from `asocijacije/module.ts` and the client fetch/intent/realtime plumbing from `alias/client.tsx`.
- Wired into every registration point: `lib/db/schema.ts` (`GAME_IDS` + generated migration for the `game_id` enum), `features/registry.ts`, `features/index.ts`, `components/game-icons.tsx`, `components/preferences-provider.tsx` (en/bs `gameCopies`, `gameDetails`, UI strings, error strings), and all four `Record<GameId, string>` tone maps (`app/play/[room]/room-lobby.tsx`, `app/page.tsx`, `components/landing/game-card-deck.tsx`, `components/landing/live-table-tray.tsx`) plus a new `plaza-game-card--chart` tone in `app/globals.css`.
- Validated with `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/eslint` across all touched files.
- Cleaned two stray leftover lines that had landed at the very top of this file (a note and an orphaned image reference, unrelated to any feature).

**Touched**
- `features/higher-lower/{types,items,module,client}.tsx` (new)
- `lib/db/schema.ts`, `lib/db/migrations/0004_dashing_strong_guy.sql`
- `features/registry.ts`, `features/index.ts`
- `components/game-icons.tsx`, `components/preferences-provider.tsx`
- `app/play/[room]/room-lobby.tsx`, `app/page.tsx`
- `components/landing/{game-card-deck,live-table-tray}.tsx`
- `app/globals.css`
- `context/{terms-of-reference,last-feature}.md`

**Decisions**
- Simultaneous independent chains over classic alternating turns — confirmed with the user directly; keeps solo and group play on one mechanic with no waiting on other players' turns.
- Static curated deck, no live API (YouTube Data API, Spotify streams, etc.) — ruled out explicitly to keep v1 offline-safe and avoid new API keys/quota; values are intentionally rounded so the deck doesn't need constant upkeep.
- Random category per game start (like Gradovi's random letter), no host-configurable category picker in v1 — same upgrade path Alias/Gradovi used for settings, left for later if wanted.
- No new DB content table — the deck is small enough to live in a TS file (`items.ts`), same as Alias's `words.ts`, not seeded/DB-backed like Asocijacije's boards.
- Flagged (not fixed) that `context/project-overview.md`'s four-game table is stale vs. the live registry, which already had five games before this change; logged in `terms-of-reference.md` §5 rather than blocking this feature on an unrelated docs refresh.

**Open / Next**
- Refresh `context/project-overview.md`'s game table to match the live registry (now six games).
- Consider a host-configurable category picker for Higher or Lower once the random-category version has been played a few times.
- Run `pnpm drizzle-kit migrate` against a real Supabase project, then verify the Vercel Preview for `feat/higher-lower`.
- Test on two phones: does watching your own "you're out" state while others keep playing feel good, or does it want a shared live leaderboard update (currently only refreshes on your own guesses/realtime invalidation)?

---

## History

### 2026-05-25 - Imposteri offline-clues rework

**Feature:** Imposteri offline-clues rework
**Status:** done
**Date:** 2026-05-25

**Summary**
- Clarified the actual play model: clues happen offline at the table — the app no longer collects clue text. It only orchestrates phases, picks the first speaker, runs the vote, and shows transition overlays.
- Removed turn-by-turn clue input, `submit-clue` intent, `clueOrder`/`cluePosition`/`clueHistory` state, and the `ClueComposer` component.
- New round flow: `reveal` → host taps "Pokreni hintove" → fullscreen "Počinju hintovi" overlay → app shows category, my secret (crew only), and the first-to-clue player while the table plays offline → host taps "Pokreni glasanje" → fullscreen "Počinje glasanje" overlay → 10s vote → fullscreen result overlay.
- Random first speaker picked server-side and shown to everyone during the clues phase.
- Vote uses a server-side deadline (`voteDeadlineAt` ISO string, `VOTE_DURATION_SECONDS = 10`). Server resolves when either everyone has voted or the deadline expires.
- Added a `resolve-vote` intent any client can call past the deadline; server only resolves if the deadline really passed, so it tolerates clock drift and double-trigger races.
- Tie/no-vote outcome simplified to "impostor wins" (no extra clue passes). Result carries a `timedOut: boolean` flag for the result message.
- Client shows a fixed-top countdown chip during the vote phase, with an urgent (danger-tinted, pulsing) variant for the final ~3 seconds.
- Big rounded **word card** in every phase: crew sees CATEGORY + their secret word in large display type; impostor sees CATEGORY + "Sakriveno" in danger color. Card has an accent-tinted frame depending on role.
- Three transition overlays: clues-start ("Počinju hintovi"), vote-start ("Počinje glasanje"), and the final result (green for victory, red for defeat — added a new `data-tone="defeat"` variant to `.plaza-screen-overlay` in globals.css).
- Overlay logic moved out of `useEffect` and into a sync `applySnapshot` helper that runs before `setSnapshot`, satisfying the `react-hooks/set-state-in-effect` rule.
- Pruned dead translation keys (`yourClue`, `cluePlaceholder`, `submitClue`, `noClue`, `clues`, `passOf`, `yourTurn`, `waitingForPlayer`, `tiebreaker`) and added new ones (`cluesOfflineHint`, `firstPlayer`, `timeLeft`, `voted`, `voteTimedOut`, all three `overlay.*` groups).
- Updated en + bs error map: removed obsolete clue-turn errors, added "Voting is still open." for the resolve-vote race.
- Validated with `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/eslint features/imposteri components/preferences-provider.tsx`.

**Touched**
- `features/imposteri/types.ts`
- `features/imposteri/module.ts`
- `features/imposteri/client.tsx`
- `components/preferences-provider.tsx`
- `app/globals.css`
- `context/last-feature.md`

**Decisions**
- App doesn't collect clue text. Clues live in the offline conversation — keeps the UX phone-friendly and matches how the group actually plays.
- Vote timeout = impostor wins. No tiebreaker pass; simpler and snappier on a phone.
- 10s vote window. Long enough to read names, short enough to keep pressure.
- Overlay state managed via `applySnapshot` (called from `loadState` + `sendIntent` response paths) instead of a phase-watching `useEffect`, to stay clear of `react-hooks/set-state-in-effect`.
- `resolve-vote` is callable by anyone — server gates it on the actual deadline — so a single host disconnect doesn't strand the round.

**Open / Next**
- Test on two phones at the table: does 10s feel right? Is the urgent-pulse threshold (≤3s) too aggressive?
- Maybe expose 8s / 10s / 15s vote window as a host setting later if play groups want variation.
- Consider an optional host nudge to "skip ahead" if the table finishes hints in under the expected time (currently they just tap "Pokreni glasanje").

---

## History

### 2026-05-24 - Imposteri turn-based rework

**Feature:** Imposteri turn-based rework
**Status:** superseded
**Date:** 2026-05-24

**Summary**
- Reworked Imposteri flow around turn-by-turn clue passes instead of free-form clue boxes + a separate discuss phase.
- Impostor card now shows only the **category** (no related word). Crew still sees the full secret word.
- Round flow: reveal → 2 sequential clue passes (random starting player, fixed order) → host-triggered vote → result.
- During clues, the active player is highlighted in a turn-order strip. Only the active player gets the input; everyone else sees who is currently speaking and the running clue log.
- After both passes complete, the host gets a **Start vote** button; non-hosts get a waiting line.
- Vote: every player sees every other player as a button. Self-vote is blocked. When all votes are in, the round resolves.
- **Tie handling:** a tied vote does not produce a result. It reopens one extra clue pass with a freshly shuffled order, increments `tiebreakerCount`, and the cycle repeats until someone has a clear plurality.
- After a clean vote, every player gets a fullscreen confirmation overlay: "Izbacili ste impostera / Imposter je pobjegao" tinted green or red depending on whether their team won. Auto-dismisses after ~3.2s.
- Scoring stays the same: +1 to every player whose team won.
- Result screen still shows the secret word, the impostor list, the vote breakdown, the scoreboard, and host-only "Next round" / "Back to launchpad" buttons.
- Added en + bs translations for all new keys; pruned the dead `phase.discuss`, `discussHint`, `forceResult`, `updateClue`, `clueReady` keys.
- Added bs translations for new server-side error strings ("Wait for your turn to give a clue.", "Wait for everyone to share their clues.", etc).
- Validated the change with `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/eslint features/imposteri components/preferences-provider.tsx`.

**Touched**
- `features/imposteri/types.ts`
- `features/imposteri/module.ts`
- `features/imposteri/client.tsx`
- `components/preferences-provider.tsx`
- `context/last-feature.md`

**Decisions**
- Impostor sees **only the category** (the "kategorija + impostor" option from the design chat). Easier to blend in than a totally blind impostor but still requires reading the room.
- **2 fixed clue passes** before the vote button appears. No setup screen needed — fast to start.
- **Always 1 impostor** per round regardless of player count. Keeps the math simple for 3–6 player groups, which is the target.
- **Tie → another clue pass**, not an immediate retry vote. Forces players to give new information instead of just re-pressing the same button.
- Used a separate `ClueComposer` component with `key={pass-position}` so the input remounts cleanly on each turn — avoids the React `set-state-in-effect` lint rule and keeps the input controlled.

**Open / Next**
- Test the new flow with a real group on two phones to see if the 2-pass cadence feels right.
- Maybe expose the impostor count or pass count as host setup later, once the base flow is validated.
- Consider a turn timer per clue if play stalls.

---

### 2026-05-24 - Plaza branding refresh

**Feature:** Plaza branding refresh
**Status:** done
**Date:** 2026-05-24

**Summary**
- Replaced the homepage logo (`public/plaza-logo.png` and `public/logo.png`) with the new transparent Plaza wordmark the user dropped in the repo root.
- Replaced the favicon (`app/favicon.ico` and `public/favicon.ico`) with the new square Plaza icon.
- Kept the full-resolution PNG in `public/favicon.png` for any future high-DPI/PWA use.
- Cleaned the source `ChatGPT_Image_*` drops from the repo root so they don't ship in the project tree.
- No code changes needed — `app/layout.tsx` already wires `/favicon.ico` and `app/page.tsx` already renders `/plaza-logo.png`.

**Touched**
- `public/plaza-logo.png`, `public/logo.png`
- `app/favicon.ico`, `public/favicon.ico`, `public/favicon.png`
- `context/last-feature.md`

**Decisions**
- Overwrite the existing branding assets in place rather than introducing new filenames, so no `layout.tsx`/`page.tsx` wiring has to change.
- Keep both `public/logo.png` and `public/plaza-logo.png` in sync for now; the homepage uses `plaza-logo.png`, but `logo.png` was the previous shared name and other surfaces may still expect it.

**Open / Next**
- Confirm the new favicon renders in the browser tab after a hard reload (browsers aggressively cache favicons).
- Decide if the dark theme needs a tuned (lighter) logo variant.

### 2026-05-24 - Gradovi AI prompt/context

**Feature:** Gradovi AI prompt/context
**Status:** done
**Date:** 2026-05-24

**Summary**
- Expanded the Gradovi AI validator with a dedicated system prompt describing Plaza, Gradovi i Sela, advisory-only validation, host authority, and B/H/S spelling/dialect expectations.
- Added a structured round-context payload with the letter, active categories, category guide, policy rules, confidence guidance, and candidate answers.
- Added per-category AI guidance for base and optional Gradovi categories.
- Added Gemini Flash support through `GEMINI_API_KEY` and `GEMINI_MODEL`.
- AI unavailability now returns the current game state with a host-facing warning instead of surfacing a hard 503 in the UI.
- Added optional `GRADOVI_AI_EXTRA_CONTEXT` env support for short custom context without code changes.
- Changed the final-15-seconds screen warning from continuous blinking to a single smooth two-pulse red flash.
- Added a fullscreen smooth “Time is up / Vrijeme je isteklo” overlay when a writing round expires, while autosave/reveal continues in the background.
- Time-up overlay now stays visible until the app actually leaves the writing phase, avoiding a blank waiting gap before the review/score summary appears.
- Added short fullscreen transition screens for game start, new rounds, and final scores using the same understated overlay style.
- Widened the game page canvas and relaxed Gradovi review rows so answer text, status chips, action buttons, and AI explanations no longer crowd each other.
- AI validation reasons are now requested in short B/H/S Latin text; built-in Gradovi validation reasons were also changed to B/H/S.
- Tightened AI spelling validation: missing diacritics are only accepted for common ASCII forms of the same real answer, while changed/invented diacritics or letters that alter identity should be rejected.
- Validated the change with `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/eslint .`.

**Touched**
- `features/gradovi-i-sela/validation-server.ts`
- `app/api/rooms/[room]/gradovi-ai/route.ts`
- `app/play/[room]/[game]/page.tsx`
- `features/gradovi-i-sela/client.tsx`
- `features/gradovi-i-sela/module.ts`
- `components/preferences-provider.tsx`
- `app/globals.css`
- `.env.example`
- `context/last-feature.md`

**Decisions**
- Keep app/game context in TypeScript constants instead of runtime markdown file reads so it works cleanly in serverless builds.
- Keep AI advisory: low-confidence answers remain reviewable and host/word-pool decisions stay authoritative.
- Prefer Gemini Flash when a hosted Gemini API key is available, so production does not depend on the host laptop being online.

**Open / Next**
- Tune the category guide after real gameplay examples.
- Add a small admin surface later for managing approved/rejected Gradovi word-pool entries.

### 2026-05-24 - Gradovi fixed timer warning

**Feature:** Gradovi fixed timer warning
**Status:** done
**Date:** 2026-05-24

**Summary**
- Added a fixed top-left Gradovi timer badge during the writing phase, separate from the top-right theme/language controls.
- Added a final-15-seconds warning state: the timer turns danger-colored and the screen flashes a red overlay while time is almost up.
- Added reduced-motion fallback so users who prefer less motion get a static warning overlay instead of flashing animation.
- Added localized timer labels for English and Bosnian.
- Validated the change with `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/eslint .`.

**Touched**
- `features/gradovi-i-sela/client.tsx`
- `app/globals.css`
- `components/preferences-provider.tsx`
- `context/last-feature.md`

**Decisions**
- Keep the fixed timer Gradovi-local for now because only Gradovi has a live round deadline.
- Use a body class for the warning overlay so the signal covers the whole viewport without changing game layout.

**Open / Next**
- If future games get timers, promote the timer badge into a shared app-bar component.
- Test the warning with a short round on a real mobile device.

### 2026-05-24 - Plaza branding assets

**Feature:** Plaza branding assets
**Status:** done
**Date:** 2026-05-24

**Summary**
- Added the transparent PNG logo from Downloads as `public/logo.png` and the square icon as `public/favicon.png`.
- Wired the square asset into `app/layout.tsx` metadata so the browser favicon uses the new branding.
- Replaced the homepage title text with the supplied logo image so the app presents the new wordmark on the launchpad.
- Kept the existing app title and copy intact; this change is branding-only.
- Validated the change with `./node_modules/.bin/tsc --noEmit`.

**Touched**
- `app/layout.tsx`, `app/page.tsx`
- `public/logo.png`, `public/favicon.png`
- `context/last-feature.md`

**Decisions**
- Use the supplied square asset as the favicon and the full asset as the homepage logo.

**Open / Next**
- Optionally add the logo to any shared app shell if we decide the launchpad should appear on more routes.
- Continue with the next gameplay feature or deployment QA.

### 2026-05-24 - Gradovi i Sela + Imposteri playable verticals

**Feature:** Gradovi i Sela + Imposteri playable verticals
**Status:** done
**Date:** 2026-05-24

**Summary**
- Added generic per-room game APIs:
  - `GET /api/rooms/[room]/state` returns the authenticated player's redacted view.
  - `POST /api/rooms/[room]/intent` validates the room/player, dispatches to the selected module reducer, persists `game_states`, and broadcasts an invalidation-only `game-event`.
- **Gradovi i Sela** is now playable: timed rounds, random letter draw, answer autosave, submit, reveal, duplicate/unique scoring, scoreboard, answer reveal, and host-only next round.
- Gradovi now starts in a host-only setup phase. Host can set round duration and total rounds before round 1, and can adjust future-round settings between rounds.
- Settings validation: round duration is clamped to 30-600 seconds; total rounds is clamped to 1-20 and cannot be lowered below the next playable round.
- Gradovi setup now has host-selectable optional categories. Base categories stay on, while extras such as car brand, mountain, sport, job, food/drink, film/series, song, club, famous person, and color can be enabled before round 1.
- Gradovi rule validation now auto-invalidates one-character/too-short answers before scoring, so a single-letter answer no longer gets 10 points. Word-pool validation no longer overrides rule-invalid answers.
- Gradovi round time and round count controls are text inputs with numeric mobile keyboards instead of native number inputs, avoiding mobile number-field quirks.
- Gradovi letters now use an app-wide database-backed rotation queue instead of independent random picks. A drawn letter moves to the end of the global queue and cannot appear again in any Gradovi room until the rest of the alphabet has cycled.
- Gradovi review now has optional host-only AI validation. It calls `/api/rooms/[room]/gradovi-ai`, checks only unknown/rule-valid answers, writes advisory `source: "ai"` validations, recalculates provisional round scores, and leaves host review as final authority.
- Gradovi validation now uses a review workflow: reveal opens a review phase, host can mark answers valid/invalid, players can report answers, and scores are only added after the host locks the round.
- Added persistent validation tables: `gradovi_words` for approved/rejected category answers and `gradovi_answer_reports` for per-round challenges. Host review decisions upsert the word pool; player reports are logged.
- Saved word-pool decisions are applied automatically when a round enters review, before the host locks scoring.
- At the end of Gradovi, the host gets a **Back to launchpad** button. It marks the room `finished`, broadcasts a session-ended state event, and redirects everyone to `/`.
- UI theme refreshed to a warm minimal Claude-inspired palette: off-white/ink surfaces, muted sand borders, burnt-orange accent, and shared `plaza-*` styling utilities for panels, buttons, inputs, chips, alerts, and status tags.
- Added local preferences for light/dark theme and English/Bosnian UI language. Preferences live in `localStorage`, are applied on `<html>` before render, and the UI can be switched from the compact top-right controls.
- Game cards on the launchpad and in the lobby now expand on click to show rules and an example. In the lobby, host clicks still select playable games while also opening the details.
- Game registry now tracks availability. Gradovi i Sela and Imposteri are playable; Asocijacije and Guess the Song show `Soon` badges and are blocked in the lobby/server start flow.
- **Imposteri** is now playable: server picks a category/secret word, assigns impostor roles, redacts the secret from impostors, runs reveal -> clues -> discuss -> vote -> result, and scores crew vs impostors by round.
- Imposteri clue phase hides other players' clue text until discussion starts, while still showing who has submitted.
- Imposteri supports host-only next round and back-to-launchpad session close. New players who join between rounds are added to the next round.
- Gradovi scoring: valid unique answer = 10, duplicate answer = 5, empty/wrong starting letter = 0. Host dispute/adjudication is still not implemented.
- The client subscribes to room realtime events and refetches its own redacted state, so private answers are not placed into shared broadcast payloads.
- Intent persistence uses a DB transaction with `FOR UPDATE` row locking to avoid clobbering simultaneous JSONB state updates.
- Decision log updated in `terms-of-reference.md`: game-state broadcasts are invalidation-only.

**Touched**
- `app/api/rooms/[room]/state/route.ts`
- `app/api/rooms/[room]/intent/route.ts`
- `app/api/rooms/[room]/finish/route.ts`
- `app/api/rooms/[room]/gradovi-ai/route.ts`
- `app/globals.css`, `app/page.tsx`, `components/{create-room-form,join-room-form,submit-button}.tsx`
- `components/{preferences-provider,preference-script,preferences-switcher,game-details,game-room-header}.tsx`
- `app/play/[room]/{page,room-lobby}.tsx`, `app/play/[room]/[game]/page.tsx`
- `features/registry.ts`, `app/actions.ts`
- `features/gradovi-i-sela/{types,module,client,validation-server}.tsx`
- `features/imposteri/{types,module,client}.tsx`
- placeholder clients for Asocijacije and Guess the Song
- `lib/db/schema.ts`, `lib/db/migrations/0001_flashy_doctor_strange.sql`
- `lib/db/migrations/0002_dear_stature.sql`
- `context/{terms-of-reference,last-feature}.md`

**Decisions**
- Supabase Broadcast is shared by the room, so game broadcasts carry only `{ gameId, updatedAt }`; clients fetch their own redacted view via API.
- Gradovi `initialState` seeds a setup phase instead of starting round 1 immediately, so host settings are visible before play begins.
- Imposteri starts round 1 immediately after the host starts the game; there are no per-game settings yet.
- Game reducers now receive the current room `playerIds` in their context, so games that create fresh rounds can include players who joined between rounds.
- AI validation should be advisory only. The durable authority is the local word pool plus host review; AI suggestions can enter as pending/reviewable evidence.
- Gradovi reducer backfills a late player into state with 0 points if they manage to join/send an intent mid-game.

**Open / Next**
- Optional: tune hosted AI validation for answers that are not already in the word pool.
- Revisit state storage if games grow beyond small-room traffic; JSONB + row-locked writes are enough for v1.
- The next full game implementation can reuse the new state/intent API; **Asocijacije** is still the likely next target.
- Run Drizzle migrate against a real Supabase project and test with two devices/browser profiles.

### 2026-05-24 - App scaffold

**Feature:** App scaffold — Next.js + Supabase + game registry skeleton
**Status:** done
**Date:** 2026-05-24

**Summary**
- Project renamed from working title "Lobby" → **Plaza** (package name, metadata, UI copy).
- Next.js (App Router) + TS + Tailwind scaffolded with `pnpm`. Strict TS. Turbopack on `dev`.
- Supabase clients (browser/server/middleware) + **anonymous auth** wired via middleware on every request — every visitor gets a stable anon id automatically.
- Drizzle schema for `rooms`, `players`, `game_states`, plus stubs for `asocijacije_boards` and `song_rounds`. `drizzle-kit` configured (`pnpm db:generate` / `db:migrate` / `db:studio`).
- **Realtime helper** at `lib/realtime/channels.ts` wraps Supabase Broadcast on `room:<CODE>` so the rest of the app talks to one shape.
- **Hub:** landing page with create-room and join-room forms (server actions). 5-char unambiguous room codes (no 0/O/1/I). Anon user → host player on create; same anon rejoining a room reuses their seat.
- **Room shell** at `/play/[room]` shows code, player list, and game picker (host-only). Subscribes to lobby-update broadcasts.
- **Game registry contract** in `features/registry.ts`: every module exposes `initialState`, `reduce`, `redact`, and a `ClientComponent`. Redaction is mandatory — server is the only writer; client gets a per-player view.
- All four games stubbed (`imposteri`, `asocijacije`, `gradovi-i-sela`, `guess-the-song`): types, module shells with correct redaction shape, placeholder client UI. Mounted at `/play/[room]/[game]`.
- `lib/music/types.ts` defines the provider-agnostic interface for the Spotify-metadata + iTunes-preview pipeline.
- `.env.example` documents required keys; README updated.

**Touched**
- `app/layout.tsx`, `app/page.tsx`, `app/actions.ts`, `app/play/[room]/{page,room-lobby,not-found}.tsx`, `app/play/[room]/[game]/page.tsx`
- `components/{create-room-form,join-room-form,submit-button}.tsx`
- `lib/supabase/{client,server,middleware}.ts`, `middleware.ts`
- `lib/db/{schema,client}.ts`, `drizzle.config.ts`
- `lib/rooms/{code,server}.ts`, `lib/realtime/channels.ts`, `lib/music/types.ts`
- `features/registry.ts`, `features/index.ts`, `features/<game>/{types,module,client}.tsx`
- `package.json` (scripts: `typecheck`, `db:*`), `.env.example`, `README.md`, `CLAUDE.md`

**Decisions**
- App name resolved: **Plaza** (was working title "Lobby"). Decision logged here; update `terms-of-reference.md` §5 with the row.
- Skipped the shadcn CLI for v1. The hub uses Tailwind primitives sized to be shadcn-compatible later. Reason: `shadcn init` is interactive and we wanted the build clean first; will add components when a real UI need shows up.
- Anon auth handled in `middleware.ts` so every visitor (incl. someone landing directly on a room URL) already has a session by the time a server action runs.
- Room codes: 5 chars, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 chars, no ambiguous glyphs). Generator retries on collision up to 8 times.
- Postgres client uses `prepare: false` for Supabase pooler compatibility, and is cached on `globalThis` in dev to survive hot reload.
- `next.js` 16, React 19, Tailwind v4, Drizzle 0.45, Drizzle-Kit 0.31.

**Open / Next at the time**
- Add the **app-name** row to `terms-of-reference.md` §5 (done in the next pass).
- First real game implementation.
- Room actions for the host: pick game and start game (completed before Gradovi work continued).
- Server route for client → server intents per game (done via `/api/rooms/[room]/intent`).
- Run the first `drizzle-kit generate` + `migrate` against a real Supabase project, then push to Vercel for a Preview deploy.
- Replace eslint warning escape hatches in `features/index.ts` once a cleaner cross-game type union is settled.
