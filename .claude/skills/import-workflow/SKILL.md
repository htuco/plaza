---
name: import-workflow
description: Bootstrap a project with the AI workflow kit — copies skills, subagents, context templates, agent template, and MCP config, then fills in placeholders.
argument-hint: [path-to-ai-workflow-kit]
---

# Import Workflow

Provisions the current project with the reusable AI-assisted development workflow:
the `/feature` lifecycle, code-review subagents, context-file templates, a
subagent-creation template, and MCP server config.

Works for both an **empty/new project** and an **already-started one** — it detects
which and adapts (reading an existing `CLAUDE.md`/`package.json` to auto-derive the
stack instead of asking).

## Task

1. **Locate the kit (install.md Step 0).** In order: an `ai-workflow-kit/` folder in the
   cwd → a path from `$ARGUMENTS` → `~/Desktop/ai-workflow-kit` / `~/dev/ai-workflow-kit`
   → else offer to `git clone https://github.com/htuco/ai-workflow-kit.git` into a temp dir.
2. Read `install.md` inside the resolved kit and execute every step in order. It covers
   scenario detection (empty vs. started), tooling, context templates, CLAUDE.md merge,
   agent template, MCP, and a final report.

## Rules

- **Detect the scenario first.** For an already-started project, read existing config
  (`package.json`, `CLAUDE.md`, lockfile) and auto-fill stack/commands — only ask for
  what you can't infer.
- **Non-destructive.** Never overwrite an existing file without showing a diff and asking.
- Skip-and-report files that already exist; offer to *merge* into `CLAUDE.md`, `context/*`,
  and `.mcp.json` rather than clobbering.
- After copying, fill `{{PLACEHOLDER}}` tokens from detected values + a short interview —
  or leave them if the user defers, and tell them how to finish later.
- Do NOT touch source code, dependencies, or git history.
- Finish with a report: created / skipped / merged / still-needs-filling.
