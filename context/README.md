# context/

Project context Claude reads at the start of every session. `CLAUDE.md` (project
root) `@`-imports these files, so keeping them accurate is how Claude stays
grounded.

## Files

| File | Purpose |
| ---- | ------- |
| `project-overview.md` | The "what" and why — problem, users, games, roadmap. |
| `project-spec.md` | Architecture, per-game state machines, integrations. |
| `terms-of-reference.md` | Glossary, conventions, and the **decision log** (§5). |
| `coding-standards.md` | How code should be written — TS, Next.js, Tailwind, redaction rules, file org. |
| `ai-interaction.md` | How Claude works with you — communication, the feature loop, commit rules. |
| `git-workflow.md` | Branches, Conventional Commits, the PR template. |
| `current-feature.md` | The single active feature (Status / Goals / Notes). Driven by `/feature`. |
| `last-feature.md` | Rolling log of shipped features — Current + History. |
| `features/` | One spec per planned feature/fix. See `features/README.md`. |

## Optional folders (create when you need them)

- `research/` — prompts for the `/research` skill and the docs it produces.
- `fixes/` — bug specs, same shape as `features/` (`/feature load` checks both).
- `screenshots/` — UI references you point specs at.

## The loop

```
write a spec in features/  →  /feature load <spec>  →  /feature start  →  build
                           →  /feature review       →  /feature complete (branch + PR)
```
