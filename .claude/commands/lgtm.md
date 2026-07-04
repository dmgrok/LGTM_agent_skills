---
description: Validate Agent Skills (SKILL.md) files for security, spec compliance, and quality
---

Run the LGTM Agent Skills validator against the specified path (or current directory if none given).

## Instructions

1. Determine the target path: use `$ARGUMENTS` if provided, otherwise look for SKILL.md files in the current working directory.
2. Run the validator using the Bash tool:
   ```
   lgtm-skills validate <path> --format cli
   ```
   If `lgtm-skills` is not globally installed, use:
   ```
   npx tsx src/cli.ts validate <path> --format cli
   ```
3. Display the full output to the user including the score breakdown.
4. If validation fails, explain each issue found and suggest fixes.
5. If the user asks, run with `--format json` for machine-readable output or `--skip-duplicates` for offline mode.

## Examples

- `/lgtm ./my-skill/` — Validate a specific skill directory
- `/lgtm ./skills/SKILL.md` — Validate a specific file
- `/lgtm` — Find and validate SKILL.md in current directory
