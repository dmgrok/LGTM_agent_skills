#!/bin/bash
# LGTM Agent Skills - Claude Code Hook Uninstaller

set -euo pipefail

PROJECT_DIR="${1:-.}"
CLAUDE_DIR="$PROJECT_DIR/.claude"

echo "🗑️  Removing LGTM Claude Code hooks..."

rm -f "$CLAUDE_DIR/hooks/lgtm-validate.sh"
rm -f "$CLAUDE_DIR/hooks/lgtm-precommit.sh"
rm -f "$CLAUDE_DIR/commands/lgtm.md"

echo "   ✓ Removed hook scripts and command"
echo ""
echo "⚠️  You may need to manually remove LGTM entries from $CLAUDE_DIR/settings.json"
echo "   (Look for PostToolUse and PreToolUse entries referencing lgtm-*.sh)"
