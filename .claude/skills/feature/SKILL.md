---
name: feature
description: Manage current feature workflow - load, start, review, explain, test or complete
argument-hint: load|start|review|explain|test|complete
---

# Feature Workflow

Manages the full lifecycle of a feature from spec to merge.

## Working File

@context/current-feature.md

### File Structure

current-feature.md has these sections:

- `# Current Feature` - H1 heading with feature name when active
- `## Status` - Not Started | In Progress | Complete
- `## Goals` - Bullet points of what success looks like
- `## Notes` - Additional context, constraints, or details from spec

Long-form history of shipped work lives in @context/last-feature.md, not here.
Specs to load from live in `context/features/`.

## Task

Execute the requested action: $ARGUMENTS

| Action | Description |
|--------|-------------|
| `load` | Load a feature spec or inline description |
| `start` | Begin implementation, create branch |
| `review` | Check goals met, code quality |
| `explain` | Document what changed and why |
| `test` | Add unit tests for the feature's server-side logic |
| `complete` | Build, commit, push branch, open PR into `main`, reset |

See [actions/](actions/) for detailed instructions.

If no action provided, explain the available options.