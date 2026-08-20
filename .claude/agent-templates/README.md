# Subagent Templates

Use `_new-subagent.template.md` to scaffold a fresh subagent in any project. It bakes in the conventions used by the kit's ready-made agents (`tooling/agents/`).

## How to create a new subagent

1. Copy `_new-subagent.template.md` → `.claude/agents/<your-agent-name>.md`.
2. Fill in the frontmatter (`name`, `description`, `tools`, `model`) and the body.
3. Delete every `{{PLACEHOLDER}}` and the trailing HOW-TO comment block.
4. Run `/agents` in Claude Code to confirm it's picked up.

Or just say to Claude: **"create a new subagent that <does X>"** and point it at this template.

## The ready-made agents (in `tooling/agents/`)

| Agent | Does | Tools | Stack-specific? |
| ----- | ---- | ----- | --------------- |
| `code-scanner` | Security / performance / quality scan, grouped by severity | Read, Glob, Grep | `{{STACK}}` placeholder |
| `refactor-scanner` | DRY / duplication audit with extraction suggestions | Glob, Grep, Read, ide diagnostics | TS/React-flavored |
| `ui-reviewer` | Visual / responsive / a11y review via Playwright | Read, Glob, Grep, playwright | Generic |
| `auth-auditor` | Auth security audit (password, tokens, reset/verify flows) | Glob, Grep, Read, Write, WebSearch | NextAuth v5-specific |

## Tips

- **`description` drives auto-invocation.** The richer and more trigger-oriented it is (with `<example>` blocks), the more reliably Claude reaches for the agent on its own.
- **Least-privilege tools.** Read-only scanners should not have `Write`/`Edit`. Only add `Write` if the agent is meant to produce a report file.
- **Match the model to the job.** `sonnet` for most scanners, `opus` for deep multi-file reasoning, `haiku` for fast/cheap passes.
