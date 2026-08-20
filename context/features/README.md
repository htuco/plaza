# Feature Specs

One markdown file per planned feature/fix. These are the specs the `/feature` skill loads.

## Workflow

1. **Write a spec** — copy `_TEMPLATE.md` to `my-feature-spec.md` and fill it in (or ask Claude to draft it).
2. **Load it** — `/feature load my-feature-spec` reads `context/features/my-feature-spec.md` into `current-feature.md` (sets H1, Goals, Notes).
3. **Build it** — `/feature start` creates the branch and implements goal by goal.
4. **Wrap up** — `/feature review`, optional `/feature test`, then `/feature complete` (commit → merge → reset → append to History).

## Naming

- Use kebab-case ending in `-spec`: `global-search-spec.md`, `auth-phase-1-spec.md`.
- For multi-phase work, suffix with the phase: `dashboard-phase-1-spec.md`.
- `/feature load <name>` matches the filename **without** the `.md`.

## Spec structure

See `_TEMPLATE.md`. Required sections: `# Title`, `## Overview`, `## Requirements`.
Everything else (`Files to Create`, `Key Gotchas`, `Environment Variables`, `Testing`, `References`) is optional — delete what you don't need.

> Keep specs scoped. One feature = one spec = one branch = one merge.
