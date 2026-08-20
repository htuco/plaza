# Git Workflow

Conventions for branches, commits, and pull requests. Follow these exactly.

---

## Branching

**The rule, no exceptions: every change lands on `main` through a pull request.**

- **Never commit or push directly to `main`.** Not for a typo, not for a one-line
  copy tweak, not for docs. No change is too small to skip the branch + PR.
- Every change starts a branch off `main` — `feat/*` for new work, `fix/*` for
  repairs, and the other Conventional Commit types for everything else
  (`chore/*`, `docs/*`, `refactor/*`, …).
- One logical change per branch, and one PR per branch. If a branch grows a
  second unrelated change, split it.
- `main` — always deployable; Vercel **Production** tracks it. It only ever moves
  by merging a PR.
- Branch naming: `type/short-scope`
  - `feat/imposteri-vote-phase`
  - `fix/gradovi-timer-reset`
  - `chore/drizzle-migration-setup`
  - `docs/pr-workflow-rule`

Every push to a branch gets a Vercel **Preview** deployment; verify there before merge.

## Commits — Conventional Commits

Format:

```
<type>(<scope>): <short summary>   # imperative, lowercase, no trailing period

<body>                             # what changed AND why (the reasoning)
<footer>                           # BREAKING CHANGE / refs, optional
```

- **Language:** English. **Tone:** professional. Be specific.
- The summary says **what**; the body explains **why** (not how — the diff shows how).
- One logical change per commit.

**Types:** `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`, `build`, `ci`.

**Scopes** (use the game or system): `imposteri`, `asocijacije`, `gradovi`,
`guess-the-song`, `hub`, `rooms`, `realtime`, `db`, `spotify`, `auth`.

Examples:

```
feat(rooms): add room-code generation and join flow

Generate 5-char unambiguous codes and resolve them to a room on join so
guests can enter with nickname + code without an account.
```

```
fix(imposteri): stop sending impostor roles to non-impostor clients

Role map was included in the broadcast payload, leaking who the impostor was.
Redact server-side state into a per-player view before broadcasting.
```

## Pull requests

- **Every branch gets a PR, and every PR targets `main`.** A PR for a two-line
  fix is normal and expected — the PR is the review and QA surface, so skipping
  it is what costs time, not opening it.
- Title: same Conventional Commits style as the commit summary.
- Fill the PR template below. Keep PRs scoped to one feature/game.
- A PR must build and pass checks, and its Preview deployment must work.
- Open the PR as soon as the branch has its first commit; it is fine for a PR to
  sit in draft while work continues.

### PR template

```markdown
## What
<!-- what this PR changes, in one or two sentences -->

## Why
<!-- the motivation / problem being solved -->

## How
<!-- key implementation decisions, anything non-obvious -->

## Testing
<!-- how it was verified; Preview URL; manual steps -->

## Notes
<!-- follow-ups, risks, open questions, related context files -->
```

## Technical instructions style

When this repo's tooling/setup steps are written down, prefer **commands with
inline comments**, not prose explanation blocks:

```bash
pnpm install                                   # install deps
pnpm dlx shadcn@latest init                    # set up shadcn/ui
pnpm dlx shadcn@latest add button card dialog  # add components as needed
pnpm drizzle-kit generate                      # create migration from schema
pnpm drizzle-kit migrate                       # apply migration to the database
pnpm dev                                       # start local dev server
```
