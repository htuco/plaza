# Veće ili Manje — Overhaul Spec

## Overview

Rework `features/higher-lower` from a silent solo race ("everyone plays their own
deck until their first mistake") into a shared party game: every player guesses
the **same next item at the same time**, on a timer, with lives, streaks, points,
a live scoreboard and a dramatic reveal. Ship with a much larger deck and host
settings. Replaces the current rules, state shape, view and client entirely.

## Requirements

### Rules (new)

- **Synchronized rounds.** A round shows the current item (value visible) and the
  next item (value hidden). All alive players pick *Više* / *Manje* before the
  deadline. When everyone alive has answered, or the deadline passes, the server
  reveals the value and scores the round. The revealed item becomes the current
  item for the next round.
- **Lives.** Each player starts with `settings.lives` (host picks 1 / 3 / 5,
  default 3). Wrong answer or no answer = −1 life. 0 lives = out; out players stay
  in the room as spectators and still see reveals.
- **Scoring.** Correct = 100 pts + speed bonus (up to +50, linear on time left,
  computed from the server deadline — same pattern as guess-the-song) × streak
  multiplier (streak 3+ → ×1.5, 6+ → ×2). Wrong/no answer resets the streak.
- **Game length.** Host picks rounds: 10 / 15 / 20 (default 15). Game ends when
  rounds run out or all players are out. Solo (1 player) works the same way.
- **Ties** are never generated (see gotchas), so there is no "equal" answer.
- Winner(s) = highest score; tiebreak = most lives left.

### Host settings (setup phase)

- Category: one of the categories below, or **Miks** (default).
- Rounds: 10 / 15 / 20. Lives: 1 / 3 / 5. Timer: 8 / 12 / 20 s (default 12).
- Only host can change settings / start / play again (existing rule).

### Content

- **One shared metric for every item: average monthly Google searches**
  (classic "Higher or Lower" format). Every comparison is apples-to-apples —
  a person vs. a food vs. a historical event vs. a brand all compare on
  "koliko se mjesečno guglaju". No years, km/h, net worth or mixed units.
- Grow from 48 to **≥150 items**. Categories are only *topic filters* over the
  same metric: `poznati` (people), `sport`, `film-muzika`, `hrana`, `brendovi-tech`,
  `mjesta`, `historija-pojmovi` (events/terms as search terms, not years),
  `regional` (ex-YU terms). Miks (default) = all of them.
- Item shape: `{ id, label, category, searches }` — the `unit` field goes away;
  the UI always shows "mjesečnih pretraga".
- Static curated deck, numbers rounded (e.g. 2.7M, 450K), global figures,
  sourced once from public keyword-volume data as of 2026. No live API
  (Google has no official search-volume API; don't scrape).
- Keep Bosnian/ijekavian labels as today. Prefer recognizable terms so guesses
  are fun, and spread values across orders of magnitude (1K … 100M+).

### Multiplayer / live feel

- Scoreboard always visible: score, lives (hearts), streak flame, and an
  "answered ✓" marker per player during the round (never *what* they answered).
- Reveal phase (~3 s, host can skip): shows the value counting up, then every
  player's pick with ✓/✗ and points gained.
- End screen: podium (top 3), per-player best streak, "Igraj ponovo" for host.

### UI/UX

- Built in the Plaza room style (`plaza-panel`, `rm-*`, `RoomBody`/`RoomContent`)
  like the redesigned rooms from PR #8.
- Phone first: two stacked cards (current / next), two big thumb-zone buttons
  Više ↑ / Manje ↓ at the bottom, visible countdown ring/bar.
- Locked-in state after answering (buttons disabled, highlight chosen one).
- Animations: number count-up on reveal, card slide when next becomes current,
  shake on wrong. Respect `prefers-reduced-motion`.
- All strings through the existing `t("higherLower.*")` i18n keys.

## Server authority & redaction

- `items` values beyond the current item stay server-side until reveal.
- During `guessing`, a player's view contains only **their own** answer plus
  `answered: boolean` for others. Others' directions are sent only in `reveal`.
- Timer: store `deadlineAt` in state; any intent after the deadline (e.g. a
  client `tick`/`advance` intent fired when the local timer hits 0) makes the
  reducer resolve the round — same approach as gradovi-i-sela / guess-the-song.
  Never trust client time.

## Files to Change / Create

- `features/higher-lower/types.ts` — new phases `setup | guessing | reveal | finished`,
  settings, per-player `{ score, lives, streak, bestStreak, answer, answeredAt }`,
  new intents (`update-settings`, `start-game`, `guess`, `advance`, `play-again`).
- `features/higher-lower/items.ts` — ≥150 items with monthly Google search counts; deck builder
  that filters by category and rejects ties / near-ties between neighbours.
- `features/higher-lower/module.ts` — rewritten reducer + redact; keep
  `normalizeState` so old stored states don't crash (fall back to `setup`).
- `features/higher-lower/client.tsx` — rewritten UI; split into
  `components/` (e.g. `item-card.tsx`, `guess-buttons.tsx`, `scoreboard.tsx`,
  `reveal.tsx`) if it grows past ~300 lines.
- i18n dictionary — new `higherLower.*` keys.
- `context/terms-of-reference.md` §5 — log the rule change (synchronized rounds
  replace solo race).

## Key Gotchas

- **Unit mixing** was the core complaint: the old deck could pair "Gepard km/h"
  with "Pad Berlinskog zida (godina)". A single metric (Google searches) removes
  the problem entirely — don't reintroduce per-item units.
- **Ties**: deck builder must skip an item whose value equals the current one;
  also avoid near-ties (<10% apart) which feel like coin flips.
- Deck needs `rounds + 1` items; with ≥150 items even a single category filter
  should hold ≥25 items so 20 rounds never run dry.
- Players joining mid-game: add them as spectators (0 lives) until play-again.
- A disconnected player who never answers just loses a life per round — the
  deadline guarantees the game never stalls.

## Testing

- Solo: start, answer right/wrong, lose all lives → finished screen.
- 3 phones: confirm others only see "answered", not the direction, until reveal.
- Let the timer expire without answering → −1 life, round resolves.
- Every card shows "mjesečnih pretraga"; no other units appear anywhere.
- Inspect the broadcast payload in devtools: no hidden next value during `guessing`.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` pass.

## References

- `features/guess-the-song/module.ts` — speed bonus + deadline handling
- `features/gradovi-i-sela/module.ts` — `deadlineAt` resolution pattern
- `features/higher-lower/*` — current implementation being replaced
