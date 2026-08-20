# AI Interaction Guidelines

## Communication

- Be concise and direct
- Explain non-obvious decisions briefly
- Ask before large refactors or architectural changes
- Don't add features not in the project spec
- Never delete files without clarification

## Working model — "vibe coded"

The human does QA, not line-by-line review. Make decisive choices, keep moving,
and log them. Optimize for "works correctly and is easy to QA on a phone" over
cleverness. Don't block on small calls — pick a sensible default and note it.

If a non-trivial decision gets made mid-build, record it in
@context/terms-of-reference.md §5 with the date.

## Workflow

The loop for every feature/fix — driven by the `/feature` skill:

1. **Spec** — write the spec in `context/features/<name>-spec.md` (copy `_TEMPLATE.md`)
2. **Load** — `/feature load <name>` pulls it into @context/current-feature.md
3. **Branch** — `/feature start` sets Status to In Progress and cuts the branch off `main`
4. **Implement** — build the goals one by one
5. **Verify** — `pnpm build` and `pnpm typecheck` must pass; check it in the browser at a phone viewport
6. **Iterate** — fix what QA turns up
7. **Review** — `/feature review` (goals met, quality, scope creep)
8. **Commit** — only after the build passes, and only with permission
9. **PR** — `/feature complete` pushes the branch and opens a PR into `main`
10. **Merge** — the human merges the PR after verifying the Vercel Preview; branch is deleted on merge
11. **Log** — the completed feature is appended to History in @context/last-feature.md

Do NOT commit without permission and until the build passes. If the build fails,
fix it first.

## Branching and PRs

**Every change reaches `main` through a pull request — no exceptions.** Never
commit or push directly to `main`, not for a one-line docs tweak. Branch naming
is `type/short-scope` (`feat/imposteri-vote-phase`, `fix/gradovi-timer-reset`).

Full rules, scopes, and the PR template: @context/git-workflow.md

## Commits

- Ask before committing (don't auto-commit)
- **Conventional Commits**, lowercase, no trailing period
- Summary says **what**; the body explains **why** (not how — the diff shows how)
- One logical change per commit
- Never put "Generated with Claude" or a Claude co-author line in commit messages

## When stuck

- If something isn't working after 2-3 attempts, stop and explain the issue
- Don't keep trying random fixes
- Ask for clarification if requirements are unclear

## Code changes

- Make minimal changes to accomplish the task
- Don't refactor unrelated code unless asked
- Don't add "nice to have" features
- Preserve existing patterns in the codebase

## Code review

Review AI-generated code periodically, especially for:

- **Redaction** — is any player receiving state they shouldn't see?
- Security (auth checks, input validation, RLS as backstop)
- Performance (unnecessary re-renders, N+1 queries, realtime chattiness)
- Logic errors (edge cases, disconnect/reconnect, host leaving mid-game)
- Patterns (does it match the existing codebase?)

Subagents available: `code-scanner`, `refactor-scanner`, `ui-reviewer`, `auth-auditor`.
