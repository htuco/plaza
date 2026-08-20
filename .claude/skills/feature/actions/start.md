# Start Action

1. Read current-feature.md - verify Goals are populated
2. If empty, error: "Run /feature load first"
3. Set Status to "In Progress"
4. Confirm you are on `main` and up to date, then create and checkout the branch.
   Name it `type/short-scope` per @context/git-workflow.md — `feat/*` for new work,
   `fix/*` for repairs, otherwise the matching Conventional Commit type. Derive the
   scope from the H1 heading (e.g. `feat/imposteri-vote-phase`).
5. List the goals, then implement them one by one
