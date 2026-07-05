#!/bin/bash
# CC-Tricks - Claude Code Hook Uninstaller

set -euo pipefail

PROJECT_DIR="${1:-.}"
CLAUDE_DIR="$PROJECT_DIR/.claude"

echo "🗑️  Removing CC-Tricks Claude Code hooks..."

rm -f "$CLAUDE_DIR/hooks/cct-validate.sh"
rm -f "$CLAUDE_DIR/hooks/cct-precommit.sh"
rm -f "$CLAUDE_DIR/commands/lgtm.md"

echo "   ✓ Removed hook scripts and command"
echo ""
echo "⚠️  You may need to manually remove CC-Tricks entries from $CLAUDE_DIR/settings.json"
echo "   (Look for PostToolUse and PreToolUse entries referencing lgtm-*.sh)"
