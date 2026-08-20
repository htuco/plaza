---
name: list-components
description: List project components
argument-hint: [subdirectory]
---

## Task

List all React component files (.tsx, .jsx) in this project. Components live in two places:

- `components/` — shared UI used across the hub and rooms
- `features/<game>/` — components owned by a single game module

Group the output by location so it's obvious which game owns what.

If a [subdirectory] is provided via $ARGUMENTS (e.g. `imposteri`), only list files under that subdirectory of either location.

## Output Format

- Numbered list of files with relative paths
- Brief one-line description of each (infer from filename)
- Summary count at the end

If no files found, say "No components found."
