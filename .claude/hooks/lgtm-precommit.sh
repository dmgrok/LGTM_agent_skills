#!/bin/bash
# LGTM Agent Skills - Pre-commit Hook for Claude Code
# Blocks git commit if any staged SKILL.md files fail validation.
#
# Triggered on PreToolUse for Bash commands matching "git commit".
# Exit code 2 = block the tool call.

set -euo pipefail

INPUT=$(cat)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Only intercept git commit commands
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_call.command // empty')

if [[ "$TOOL_NAME" != "Bash" ]]; then
  exit 0
fi

if ! echo "$COMMAND" | grep -qE '^\s*git\s+commit'; then
  exit 0
fi

# Find staged SKILL.md files
STAGED_SKILLS=$(git -C "$PROJECT_DIR" diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep 'SKILL\.md$') || true

if [[ -z "$STAGED_SKILLS" ]]; then
  exit 0
fi

# Find lgtm-skills binary
LGTM_BIN=""
if command -v lgtm-skills &> /dev/null; then
  LGTM_BIN="lgtm-skills"
elif [[ -f "$PROJECT_DIR/dist/cli.js" ]]; then
  LGTM_BIN="node $PROJECT_DIR/dist/cli.js"
elif [[ -f "$PROJECT_DIR/src/cli.ts" ]]; then
  LGTM_BIN="npx tsx $PROJECT_DIR/src/cli.ts"
fi

if [[ -z "$LGTM_BIN" ]]; then
  exit 0
fi

# Validate each staged SKILL.md
FAILURES=""
while IFS= read -r skill_file; do
  FULL_PATH="$PROJECT_DIR/$skill_file"
  if [[ ! -f "$FULL_PATH" ]]; then
    continue
  fi

  RESULT=$($LGTM_BIN validate "$FULL_PATH" --format json 2>/dev/null) || true
  PASSED=$(echo "$RESULT" | jq -r '.passed // "true"' 2>/dev/null) || PASSED="true"
  SCORE=$(echo "$RESULT" | jq -r '.score // "?"' 2>/dev/null) || SCORE="?"

  if [[ "$PASSED" != "true" ]]; then
    FAILURES="${FAILURES}\n  • ${skill_file} (score: ${SCORE}/100)"
  fi
done <<< "$STAGED_SKILLS"

if [[ -n "$FAILURES" ]]; then
  echo "🚫 LGTM pre-commit: The following SKILL.md files failed validation:${FAILURES}" >&2
  echo "" >&2
  echo "Fix the issues or use --no-verify to skip (not recommended)." >&2
  exit 2
fi

exit 0
