#!/bin/bash
# LGTM Agent Skills - Claude Code Hook
# Validates SKILL.md files when they are created or modified.
#
# Input: JSON on stdin with file_path, tool_name, tool_call, etc.
# Output: JSON with validation result and system message.

set -euo pipefail

INPUT=$(cat)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Determine the file path depending on the hook event
FILE_PATH=""
HOOK_EVENT="${CLAUDE_HOOK_EVENT:-}"

if echo "$INPUT" | jq -e '.file_path' > /dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.file_path')
elif echo "$INPUT" | jq -e '.tool_call.file_path' > /dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_call.file_path')
fi

# Only validate SKILL.md files
if [[ -z "$FILE_PATH" ]] || [[ "$(basename "$FILE_PATH")" != "SKILL.md" ]]; then
  exit 0
fi

# Check if lgtm-skills is available
LGTM_BIN=""
if command -v lgtm-skills &> /dev/null; then
  LGTM_BIN="lgtm-skills"
elif [[ -f "$PROJECT_DIR/dist/cli.js" ]]; then
  LGTM_BIN="node $PROJECT_DIR/dist/cli.js"
elif [[ -f "$PROJECT_DIR/src/cli.ts" ]]; then
  LGTM_BIN="npx tsx $PROJECT_DIR/src/cli.ts"
fi

if [[ -z "$LGTM_BIN" ]]; then
  echo '{"continue": true, "systemMessage": "⚠️ lgtm-skills not found. Install with: npm install -g lgtm-agent-skills"}'
  exit 0
fi

# Run validation and capture output
RESULT=$($LGTM_BIN validate "$FILE_PATH" --format json 2>/dev/null) || true

if [[ -z "$RESULT" ]]; then
  exit 0
fi

SCORE=$(echo "$RESULT" | jq -r '.score // empty' 2>/dev/null) || true
PASSED=$(echo "$RESULT" | jq -r '.passed // empty' 2>/dev/null) || true

if [[ -z "$SCORE" ]]; then
  exit 0
fi

# Build response
if [[ "$PASSED" == "true" ]]; then
  cat <<EOF
{
  "continue": true,
  "systemMessage": "✅ LGTM: ${FILE_PATH} scored ${SCORE}/100 — validation passed."
}
EOF
else
  ISSUES=$(echo "$RESULT" | jq -r '[.findings[]? | .message] | join("; ")' 2>/dev/null) || ISSUES=""
  cat <<EOF
{
  "continue": true,
  "systemMessage": "⚠️ LGTM: ${FILE_PATH} scored ${SCORE}/100 — validation failed. Issues: ${ISSUES}"
}
EOF
fi

exit 0
