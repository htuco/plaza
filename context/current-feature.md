# Current Feature: Veće ili Manje — overhaul (Google searches, synchronized rounds)

> Live working file for the `/feature` skill. The long-form log of shipped work
> lives in @context/last-feature.md — `/feature complete` appends there, not here.
> Full spec: @context/features/higher-lower-overhaul.md

## Status

In Progress — all goals implemented; typecheck + lint clean, reducer simulated; awaiting phone QA

## Goals

### Rules
- Synchronized rounds: all alive players guess *Više* / *Manje* on the same next item before a server deadline; round resolves when everyone answered or the deadline passes.
- Lives per player (host: 1 / 3 / 5, default 3). Wrong or no answer = −1 life; 0 lives = spectator.
- Scoring: correct = 100 + speed bonus (up to +50, from server deadline) × streak multiplier (3+ → ×1.5, 6+ → ×2). Miss resets streak.
- Game ends after host-chosen rounds (10 / 15 / 20, default 15) or when everyone is out. Winner = top score, tiebreak = lives left. Solo works the same.

### Content
- **One metric for every item: average monthly Google searches.** No years, km/h, net worth or other units — the `unit` field is removed.
- ≥150 items, shape `{ id, label, category, searches }`, rounded global figures as of 2026, static curated deck.
- Categories are topic filters only: poznati, sport, film-muzika, hrana, brendovi-tech, mjesta, historija-pojmovi, regional; **Miks** (default) = all. Each category ≥25 items.
- Deck builder rejects ties and near-ties (<10% apart) between neighbours.

### Host settings (setup)
- Category (or Miks), rounds, lives, timer (8 / 12 / 20 s, default 12). Host-only settings / start / play again.

### Multiplayer feel
- Always-visible scoreboard: score, hearts, streak, "answered ✓" per player (never the direction).
- Reveal phase (~3 s, host can skip): value count-up, then everyone's pick with ✓/✗ and points.
- End screen: top-3 podium, best streaks, host "Igraj ponovo".

### UI/UX
- Plaza room style (`RoomBody` / `RoomContent`, `plaza-panel`, `rm-*`), phone first.
- Current / next cards stacked, big Više ↑ / Manje ↓ in the bottom bar, countdown bar/ring, locked-in state after answering.
- Count-up, card slide, shake on wrong; respects `prefers-reduced-motion`.

## Notes

**Why the content change:** the old deck mixed units inside a category, so players compared e.g. a celebrity's follower count against a historical year. The user explicitly asked for one shared metric; Google searches chosen (classic Higher or Lower format).

**Constraints**
- Server is the only writer; timing uses `deadlineAt` + `ctx.now` (pattern from gradovi-i-sela / guess-the-song speed bonus). Never trust client time.
- Redaction: next item's `searches` stays server-side until reveal; during `guessing` others see only `answered: boolean`, directions only in `reveal`.
- Keep `normalizeState` tolerant so old stored states fall back to `setup` instead of crashing.
- Late joiners enter as spectators until play-again.
- New copy needs `en` + `bs` entries in `components/preferences-provider.tsx`.
- No live search-volume API (Google has none; no scraping).
- Log the rule change (synchronized rounds replace the solo race) in `terms-of-reference.md` §5.

**Housekeeping flagged at load:** this file previously held Guess the Song modifiers (A–E), marked "in progress" though PR #7 is merged; that entry is not in `last-feature.md` History yet.
