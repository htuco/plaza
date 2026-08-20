# Complete Action

> **This repo never merges to `main` locally.** Every change lands via a pull
> request — see @context/git-workflow.md. Do not run `git merge` into `main` and
> do not push to `main`.

1. Verify the build first: `pnpm build` and `pnpm typecheck` must pass. If either
   fails, stop and fix before continuing.
2. Ask for permission to commit. Then stage and commit with a **Conventional
   Commits** message — `type(scope): summary` (lowercase, no trailing period),
   body explains **why**. No Claude co-author or "Generated with" line.
3. Push the branch: `git push -u origin <branch>`
4. Open a PR into `main` with `gh pr create`, using the PR template from
   @context/git-workflow.md (What / Why / How / Testing / Notes). Title mirrors
   the commit summary.
5. Report the PR URL and remind the human to verify the **Vercel Preview** before
   merging.
6. Move the **Current** entry in @context/last-feature.md into **History**
   (newest first) and start a new Current for the shipped feature.
7. Reset @context/current-feature.md:
   - H1 back to `# Current Feature`
   - Status back to `Not Started`
   - Clear Goals and Notes (keep the placeholder comments)
8. Commit that reset onto the **same branch** so it rides along in the PR:
   `chore(hub): reset current-feature after <feature>` — then push again.

The human merges the PR and deletes the branch. Do not do it for them unless
explicitly asked.
