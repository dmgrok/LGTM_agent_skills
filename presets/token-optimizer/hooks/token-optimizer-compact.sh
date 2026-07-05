#!/bin/bash
# token-optimizer-compact.sh — PostToolUse hook on *
# Nudges Claude to /compact when context reaches ~70% of the 200K token limit

COMPACT_THRESHOLD=140000  # 70% of 200K
NUDGE_INTERVAL=10000      # Only re-nudge every 10K tokens past threshold

# Find active session JSONL
PROJECT_ENCODED=$(echo "$PWD" | sed 's|/|-|g' | sed 's|^-||')
SESSION_DIR="$HOME/.claude/projects/$PROJECT_ENCODED"
SESSION=$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -1)
[ -z "$SESSION" ] && exit 0

# Incremental state to avoid re-parsing the full file every call
SESSION_HASH=$(echo "$SESSION" | cksum | awk '{print $1}')
STATE_FILE="/tmp/cct-compact-$SESSION_HASH"
CURRENT_SIZE=$(stat -f%z "$SESSION" 2>/dev/null || stat -c%s "$SESSION" 2>/dev/null || echo "0")

if [ -f "$STATE_FILE" ]; then
  LAST_OFFSET=$(jq -r '.offset // 0' "$STATE_FILE")
  TOTAL_INPUT=$(jq -r '.total_input // 0' "$STATE_FILE")
  LAST_NUDGE=$(jq -r '.last_nudge // 0' "$STATE_FILE")
else
  LAST_OFFSET=0
  TOTAL_INPUT=0
  LAST_NUDGE=0
fi

# Sum new input tokens from new lines only
if [ "$CURRENT_SIZE" -gt "$LAST_OFFSET" ]; then
  NEW_INPUT=$(dd if="$SESSION" bs=1 skip="$LAST_OFFSET" 2>/dev/null | \
    grep '"type":"assistant"' | \
    jq -s '[.[].message.usage.input_tokens // 0] | add // 0' 2>/dev/null || echo "0")
  TOTAL_INPUT=$((TOTAL_INPUT + NEW_INPUT))
  printf '{"offset":%d,"total_input":%d,"last_nudge":%d}\n' \
    "$CURRENT_SIZE" "$TOTAL_INPUT" "$LAST_NUDGE" > "$STATE_FILE"
fi

# Check if we should nudge
if [ "$TOTAL_INPUT" -ge "$COMPACT_THRESHOLD" ]; then
  TOKENS_SINCE_NUDGE=$((TOTAL_INPUT - LAST_NUDGE))
  if [ "$LAST_NUDGE" -eq 0 ] || [ "$TOKENS_SINCE_NUDGE" -ge "$NUDGE_INTERVAL" ]; then
    PCT=$((TOTAL_INPUT * 100 / 200000))
    printf '{"continue":true,"systemMessage":"⚡ Context at ~%d%% capacity (%s tokens). Run /compact now to maintain cache efficiency and reduce costs."}\n' \
      "$PCT" "$(printf '%d' "$TOTAL_INPUT" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')"
    # Update last nudge position
    printf '{"offset":%d,"total_input":%d,"last_nudge":%d}\n' \
      "$CURRENT_SIZE" "$TOTAL_INPUT" "$TOTAL_INPUT" > "$STATE_FILE"
  fi
fi

exit 0
