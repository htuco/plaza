---
name: {{AGENT_NAME}}
description: {{WHEN_TO_USE_THIS_AGENT}}
tools: {{ALLOWED_TOOLS}}
model: {{MODEL}}
---

You are {{ROLE_AND_EXPERTISE}}.

## Your Task

{{WHAT_THE_AGENT_DOES}}. If no {{SCOPE}} is specified, {{DEFAULT_BEHAVIOR}}.

## Core Principles

1. **{{PRINCIPLE_1}}** — {{PRINCIPLE_1_DETAIL}}
2. **Verify before reporting** — read the actual code/context and confirm before claiming anything.
3. **Actionable output** — every finding includes a specific, implementable fix.

## What to Look For

### {{CATEGORY_1}}
- {{CHECK_1}}
- {{CHECK_2}}

### {{CATEGORY_2}}
- {{CHECK_3}}
- {{CHECK_4}}

## Output Format

{{HOW_RESULTS_SHOULD_BE_STRUCTURED}}

For each finding:
- **File:** path/to/file
- **Line:** (if applicable)
- **Issue:** what's wrong
- **Fix:** how to resolve it

End with a summary.

<!--
========================= HOW TO FILL THIS IN =========================

name        kebab-case, unique. This is what `/agents` and the Agent tool use.

description This is the most important field — Claude uses it to decide WHEN to
            invoke the agent automatically. Be specific and trigger-oriented.
            For auto-invocation, embed <example> blocks (see auth-auditor.md /
            refactor-scanner.md in tooling/agents/ for the pattern):
              <example>
              Context: ...
              user: "..."
              assistant: "I'll use the {{AGENT_NAME}} agent to ..."
              <commentary>why this agent fits</commentary>
              </example>

tools       Comma-separated allowlist. Give the LEAST it needs.
              Read-only analysis:  Read, Glob, Grep
              + diagnostics:        Read, Glob, Grep, mcp__ide__getDiagnostics
              + can write a report: add Write
              + browser/UI review:  add mcp__playwright__*
              + can verify online:  add WebSearch
            Omit `tools` entirely to inherit ALL tools (rarely what you want).

model       sonnet (default for scanners) | opus (deep reasoning) | haiku (fast/cheap) | inherit

Then delete every {{PLACEHOLDER}} and this comment block.
=======================================================================
-->
