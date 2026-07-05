#!/bin/bash
# budget-guard.sh — PreToolUse hook: blocks tool calls when session cost exceeds budget
# Reads config from .claude/budget-guard.json, uses incremental JSONL parsing for speed

# Locate project root (directory containing .claude/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$CLAUDE_DIR")"

CONFIG="$CLAUDE_DIR/budget-guard.json"
BUDGET=$(jq -r '.budget // 10' "$CONFIG" 2>/dev/null || echo "10")
WARN_AT=$(jq -r '.warn_at // 0.8' "$CONFIG" 2>/dev/null || echo "0.8")

# Find active session JSONL — most recently modified in the encoded project dir
PROJECT_ENCODED=$(echo "$PROJECT_ROOT" | sed 's|/|-|g' | sed 's|^-||')
SESSION_DIR="$HOME/.claude/projects/$PROJECT_ENCODED"
SESSION=$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -1)
[ -z "$SESSION" ] && exit 0

# Incremental state: avoid re-parsing the full file every tool call
STATE_HASH=$(echo "$SESSION" | cksum | awk '{print $1}')
STATE_FILE="/tmp/lgtm-budget-$STATE_HASH"
CURRENT_SIZE=$(stat -f%z "$SESSION" 2>/dev/null || stat -c%s "$SESSION" 2>/dev/null || echo "0")

if [ -f "$STATE_FILE" ]; then
  LAST_OFFSET=$(jq -r '.offset // 0' "$STATE_FILE")
  RUNNING_COST=$(jq -r '.cost // 0' "$STATE_FILE")
  MODEL=$(jq -r '.model // ""' "$STATE_FILE")
else
  LAST_OFFSET=0
  RUNNING_COST=0
  MODEL=""
fi

# Detect model from session on first run (cached in state file)
if [ -z "$MODEL" ] && [ -f "$SESSION" ]; then
  MODEL=$(grep '"type":"assistant"' "$SESSION" 2>/dev/null | head -1 | \
    jq -r '.message.model // ""' 2>/dev/null || echo "")
fi

# Model-aware per-token pricing (pre-divided by 1,000,000)
case "$MODEL" in
  *opus-4*)   IN="0.000005";  OUT="0.000025";  CC="0.00000625"; CR="0.0000005"  ;;
  *opusplan*) IN="0.0000034"; OUT="0.000017";  CC="0.00000425"; CR="0.00000034" ;;
  *)          IN="0.000003";  OUT="0.000015";  CC="0.00000375"; CR="0.0000003"  ;; # sonnet default
esac

# Only parse new bytes since last check
if [ "$CURRENT_SIZE" -gt "$LAST_OFFSET" ]; then
  BYTE_START=$((LAST_OFFSET + 1))
  NEW_COST=$(dd if="$SESSION" bs=1 skip="$LAST_OFFSET" 2>/dev/null | \
    grep '"type":"assistant"' | \
    jq -sr --arg in "$IN" --arg out "$OUT" --arg cc "$CC" --arg cr "$CR" '
      [ .[] | .message.usage // empty |
        ((.input_tokens // 0) * ($in | tonumber)) +
        ((.output_tokens // 0) * ($out | tonumber)) +
        ((.cache_creation_input_tokens // 0) * ($cc | tonumber)) +
        ((.cache_read_input_tokens // 0) * ($cr | tonumber))
      ] | add // 0' 2>/dev/null || echo "0")
  RUNNING_COST=$(echo "$RUNNING_COST + $NEW_COST" | bc -l 2>/dev/null || echo "$RUNNING_COST")
  printf '{"offset":%d,"cost":%s,"model":"%s"}\n' "$CURRENT_SIZE" "$RUNNING_COST" "$MODEL" > "$STATE_FILE"
fi

# Evaluate thresholds
WARN_THRESHOLD=$(echo "$BUDGET * $WARN_AT" | bc -l 2>/dev/null || echo "8")
OVER=$(echo "$RUNNING_COST >= $BUDGET" | bc -l 2>/dev/null || echo "0")
WARN=$(echo "$RUNNING_COST >= $WARN_THRESHOLD" | bc -l 2>/dev/null || echo "0")

if [ "$OVER" = "1" ]; then
  COST_FMT=$(printf '%.4f' "$RUNNING_COST")
  echo "Budget exceeded (\$$COST_FMT / \$$BUDGET). Run \`lgtm preset remove budget-guard\` to disable." >&2
  exit 2
elif [ "$WARN" = "1" ]; then
  COST_FMT=$(printf '%.4f' "$RUNNING_COST")
  PCT=$(echo "scale=0; $RUNNING_COST * 100 / $BUDGET" | bc -l 2>/dev/null || echo "?")
  printf '{"continue":true,"systemMessage":"⚠️ Budget: $%s / $%s (%s%%) — approaching limit"}\n' \
    "$COST_FMT" "$BUDGET" "$PCT"
fi
