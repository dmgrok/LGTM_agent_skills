#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_call.file_path // .file_path // empty')
if [[ -z "$FILE_PATH" ]] || [[ "$(basename "$FILE_PATH")" != "SKILL.md" ]]; then
  exit 0
fi
RESULT=$(cc-tricks check "$FILE_PATH" --format json 2>/dev/null) || exit 0
PASSED=$(echo "$RESULT" | jq -r '.passed')
if [[ "$PASSED" == "true" ]]; then
  echo "{\"continue\": true, \"systemMessage\": \"\u2705 LGTM: $FILE_PATH \u2014 no issues found.\"}"
else
  ERRORS=$(echo "$RESULT" | jq -r '.errors')
  echo "{\"continue\": true, \"systemMessage\": \"\u26a0\ufe0f LGTM: $FILE_PATH \u2014 $ERRORS error(s) found. Run /cc-tricks for details.\"}"
fi
