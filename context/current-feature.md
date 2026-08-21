# Current Feature: Guess the Song — artist search, audio unlock fix, scoring modifiers

> Live working file for the `/feature` skill. The long-form log of shipped work
> lives in @context/last-feature.md — `/feature complete` appends there, not here.

## Status

In Progress — goals A–E implemented; awaiting phone QA

## Goals

### A. Source search by artist

- `searchItunesTracks()` sent a bare `term=`, so a source query like `Magazin`
  also pulled songs whose *title* matched ("White Denim — Magazin").
- **`attribute=artistTerm` does not work** — verified against the live API, it is
  ignored for `entity=song` and returns byte-identical results to a bare `term=`
  (searching `hello` with it still returns Adele's "Hello"). Resolve the artist
  first instead: `search?entity=musicArtist` → `artistId` →
  `lookup?id=<artistId>&entity=song`, which returns only that artist's catalogue.
- All 20 curated `SONG_SOURCE_PRESETS` terms were checked against the live API —
  each resolves to the right artist with 25 previewable tracks.
- An unresolvable artist returns no tracks, which surfaces the existing "no
  playable previews" error — no silent fallback to a broad search.

### B. First song is silent (root cause found)

The `<audio>` element only mounts during `countdown` / `playing` / `round-end`
([client.tsx:546-553](features/guess-the-song/client.tsx#L546-L553)), but the
"♪ Unlock audio" banner renders from the **setup** phase onward
([client.tsx:425](features/guess-the-song/client.tsx#L425)). Tapping it in setup —
the natural first tap — hits `unlockAudio()` with `audioRef.current === null`, so:

1. no gesture-bound `play()` ever reaches the element, autoplay stays blocked;
2. `audioUnlocked` is set to `true` anyway and persisted to
   `localStorage["plaza:song-audio-unlocked"]`;
3. the `!audioUnlocked` "▶ tap to play" fallback ([client.tsx:617](features/guess-the-song/client.tsx#L617))
   therefore never renders — round 1 is silent with no visible way to start it;
4. the localStorage flag makes it stick across rooms and sessions.

Fix:
- Mount the `<audio>` element in every phase so the unlock tap always has a real
  element to bind to.
- Only treat audio as unlocked when a real `play()` actually resolves; on
  rejection clear the flag and keep the fallback button visible.
- Gate the round-start `play()` on the clip being ready (`canplay`), so a cold
  first-round buffer doesn't swallow playback at `playbackStartAt`.

### C. Shorter clips + guess windows

- `MIN_GUESS_DURATION_SECONDS` 30 → 10, and the setup stepper moves to a 5s step
  so short rounds are actually reachable.
- New `clipLengthSeconds` setting (5 / 10 / 15 / 30 — the preview is 30s).
  Playback stops at the limit; the guess window keeps running after the clip cuts.
- Clip length can never exceed the guess window; the server clamps it.

### D. Scoring modifiers

- **Speed bonus** — every scoring guess earns a bonus that decays with the time
  left in the window (`SPEED_BONUS_MAX` × remaining fraction), computed
  server-side from `roundDeadlineAt` and `ctx.now`.
- **Short-clip multiplier** — the whole round is worth more when the host picked
  a shorter clip: 30s ×1, 15s ×1.25, 10s ×1.5, 5s ×2.
- `FIRST_MATCH_BONUS` stays as a flat bonus for the first player to score.

### E. QA round 1 — the clips were unusable

Reported after testing: *"ako sam stavio isječak 5s, zašto otkucava 50, nema
smisla, ne mogu ga ponovit"* — plus a request for shorter clips and a volume
control.

- **No replay.** The single worst part: the clip cut at 5s and left ~45s of dead
  air with no way to hear it again — the `<audio>` element is hidden, so there
  was no control at all. A **Replay** button is now visible for the whole
  `playing` phase (it doubles as the autoplay-unlock tap when audio is locked).
- **Clip and timer were unrelated.** A 5s clip could sit under a 50s countdown.
  Picking a clip length now retunes the guess window to suit it (1s/2s → 15s,
  4s/7s → 20s, 11s → 25s, 16s → 30s, 30s → 45s). The host can still override the
  round time afterwards — setting both in one intent skips the retune.
- **Shorter clips.** `CLIP_LENGTH_OPTIONS` moves from `5/10/15/30` to Heardle's
  ladder `1/2/4/7/11/16/30`, with multipliers ×3 / ×2.5 / ×2 / ×1.75 / ×1.5 /
  ×1.25 / ×1. Default clip is 11s.
- **Volume slider** next to Replay, persisted in `localStorage` (safe to persist,
  unlike the autoplay unlock) and styled via a new `.plaza-range` rule.
- **Random clip offset.** Clips no longer always start at 0:00. The server picks
  `clipStartSeconds` per round and stores it in state, so every device plays the
  identical segment and Replay repeats that same segment.

## Notes

**Rebased on new work.** `origin/main` had moved 4 commits ahead —
`feat(guess-the-song): synchronize round playback and tighten guess matching`
(Ennyz) added the `countdown` phase, `playbackStartAt` / `roundEndAdvanceAt`
timestamps, the audio-unlock mechanism, auto-advancing rounds, and exact-match
guessing; a `higher-lower` game module also landed. The goals above are written
against that code, not the version the spec was first drafted on.

**Already done upstream, dropped from scope**
- Answer-mode (`both` / `title` / `artist`) segmented control — shipped in the
  setup UI.
- Shared round start across devices — that's what the countdown phase does.

**Scope call — "da se moze malo smanjit" was read as the clip/guess window, not
the UI.** It sits between the audio bug and the modifier idea ("krace slusanje =
vise poena"), and the Music Quizly settings modal referenced is exactly clip
length + time to guess.

**Reference material**
- [heardle.info/daily](https://www.heardle.info/daily/) — progressive reveal
  (1s → 2s → 4s → 7s → 11s → 16s, unlocking more audio costs you points).
- Music Quizly screenshots — settings modal (rounds, clip length, time to guess,
  Both/Artist/Title, same-room host-only-music) and playlist picker (genre/decade
  tags, difficulty rating, track count).

**Constraints**
- Server is the only writer. All scoring lives in
  `features/guess-the-song/module.ts`; the client sends guess text only.
- Track titles/artists must not reach the client before `round-end` — `redact()`
  handles this, keep it that way.
- Async iTunes work stays in the route handler, not the sync reducer.
- New copy needs `en` + `bs` entries in
  [components/preferences-provider.tsx](components/preferences-provider.tsx).

**Next (out of scope)**
- Same-room mode (host-only audio) — a playback mode, not a scoring modifier;
  worth its own branch.
- Heardle-style progressive reveal as a distinct game mode.
- Playlist browser with genre/decade tags and difficulty ratings.
