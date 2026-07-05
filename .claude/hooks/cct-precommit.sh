#!/bin/bash
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_call.command // empty')
if [[ "$TOOL_NAME" != "Bash" ]] || ! echo "$COMMAND" | grep -qE '^\s*git\s+commit'; then
  exit 0
fi
STAGED=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep 'SKILL\.md$') || exit 0
[[ -z "$STAGED" ]] && exit 0
FAILURES=""
while IFS= read -r f; do
  RESULT=$(cc-tricks check "$f" --format json 2>/dev/null) || continue
  PASSED=$(echo "$RESULT" | jq -r '.passed')
  [[ "$PASSED" != "true" ]] && FAILURES="$FAILURES\n  \u2022 $f"
done <<< "$STAGED"
if [[ -n "$FAILURES" ]]; then
  echo "\ud83d\udeab LGTM: Failing skills block commit:$FAILURES" >&2
  exit 2
fi
