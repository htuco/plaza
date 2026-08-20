---
name: cleanup
description: Clean up project housekeeping tasks (add "run" to execute fixes)
argument-hint: run|check
---

Review the codebase for cleanup tasks:

1. Make sure the History in @context/last-feature.md is in order (newest first) and that @context/current-feature.md reflects reality
2. Find unnecessary console.log statements in app/, lib/, features/, components/
3. Find unused imports
4. Check for stale TODO comments
5. Find orphaned/unused files
6. Check that context files match actual project state
7. Check that .env.example lists every variable used in the code and present in .env.local (names only, never values). If something is missing, tell me.
8. Check that CLAUDE.md and context/ still describe the actual repo state (stale "not scaffolded yet" claims, dead file paths, renamed folders)
9. Find `@ts-ignore` / `@ts-expect-error` comments that might be stale
10. Find `any` types without a justifying comment

**Mode: $ARGUMENTS**

If no argument or argument is "check":

- Only report findings, don't modify anything
- List what WOULD be cleaned up

If the argument is "run" or "fix":

- First, report all findings with numbered items
- Then ask: "Which items would you like me to fix? (enter numbers like 1,3,5 or 'all' or 'none')"
- Wait for user response before making any changes
- Only fix the items the user specifies
- Report what you changed
