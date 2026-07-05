#!/bin/bash
# safe-mode-agent.sh — PreToolUse hook for Agent
# Rate-limits agent spawning to prevent runaway recursive agent loops

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG="$CLAUDE_DIR/safe-mode.json"
AGENT_LIMIT=$(jq -r '.agent_limit // 5' "$CONFIG" 2>/dev/null || echo "5")

# Find the active session JSONL to use as a session identifier
PROJECT_ENCODED=$(echo "$PWD" | sed 's|/|-|g' | sed 's|^-||')
SESSION_DIR="$HOME/.claude/projects/$PROJECT_ENCODED"
SESSION=$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -1)

# Derive a session-scoped state file
if [ -n "$SESSION" ]; then
  SESSION_HASH=$(echo "$SESSION" | cksum | awk '{print $1}')
else
  SESSION_HASH="default"
fi
STATE_FILE="/tmp/cct-safe-agents-$SESSION_HASH"

# Read and increment counter
COUNT=0
[ -f "$STATE_FILE" ] && COUNT=$(cat "$STATE_FILE" 2>/dev/null || echo "0")
COUNT=$((COUNT + 1))
echo "$COUNT" > "$STATE_FILE"

if [ "$COUNT" -gt "$AGENT_LIMIT" ]; then
  echo "🛑 safe-mode blocked: agent spawn #$COUNT — runaway limit of $AGENT_LIMIT reached. Run \`cc-tricks preset remove safe-mode\` to disable." >&2
  exit 2
elif [ "$COUNT" -eq "$AGENT_LIMIT" ]; then
  printf '{"continue":true,"systemMessage":"⚠️ safe-mode: agent spawn #%d of %d (limit). This is the last agent spawn allowed this session."}\n' "$COUNT" "$AGENT_LIMIT"
  exit 0
fi

exit 0
