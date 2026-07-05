#!/bin/bash
# CC-Tricks - Claude Code Hook Installer
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/dmgrok/claude-code-tricks-cookbook/main/hooks/install.sh | bash
#
# Or manually:
#   cd your-project && bash path/to/install.sh
#
# This installs:
#   - Post-edit validation hook (warns on SKILL.md issues)
#   - Pre-commit gate (blocks commits with failing SKILL.md)
#   - /lgtm slash command

set -euo pipefail

PROJECT_DIR="${1:-.}"
CLAUDE_DIR="$PROJECT_DIR/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
COMMANDS_DIR="$CLAUDE_DIR/commands"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"

echo "🔍 CC-Tricks — Claude Code Hook Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for lgtm-skills
if ! command -v lgtm-skills &> /dev/null; then
  echo "⚠️  lgtm-skills CLI not found. Install with:"
  echo "   npm install -g lgtm-agent-skills"
  echo ""
  echo "   Hooks will still be installed but won't run until lgtm-skills is available."
  echo ""
fi

# Create directories
mkdir -p "$HOOKS_DIR" "$COMMANDS_DIR"

# Download hook scripts
REPO_BASE="https://raw.githubusercontent.com/dmgrok/claude-code-tricks-cookbook/main"

echo "📥 Installing hooks..."

curl -sSL "$REPO_BASE/.claude/hooks/cct-validate.sh" -o "$HOOKS_DIR/cct-validate.sh"
chmod +x "$HOOKS_DIR/cct-validate.sh"
echo "   ✓ Post-edit validation hook"

curl -sSL "$REPO_BASE/.claude/hooks/cct-precommit.sh" -o "$HOOKS_DIR/cct-precommit.sh"
chmod +x "$HOOKS_DIR/cct-precommit.sh"
echo "   ✓ Pre-commit gate hook"

curl -sSL "$REPO_BASE/.claude/commands/lgtm.md" -o "$COMMANDS_DIR/lgtm.md"
echo "   ✓ /lgtm slash command"

# Merge settings.json
if [[ -f "$SETTINGS_FILE" ]]; then
  echo ""
  echo "📝 Merging into existing $SETTINGS_FILE..."

  EXISTING=$(cat "$SETTINGS_FILE")
  # Check if hooks already configured
  if echo "$EXISTING" | jq -e '.hooks' > /dev/null 2>&1; then
    echo "   ⚠️  hooks key already exists in settings.json"
    echo "   Please add manually. Required configuration:"
    echo ""
    echo '   "PostToolUse": [{"matcher": "Edit|Write", "hooks": [{"type": "command", "command": ".claude/hooks/cct-validate.sh", "timeout": 30}]}]'
    echo '   "PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": ".claude/hooks/cct-precommit.sh", "timeout": 30}]}]'
  else
    # Add hooks to existing settings
    echo "$EXISTING" | jq '. + {
      "hooks": {
        "PostToolUse": [{"matcher": "Edit|Write", "hooks": [{"type": "command", "command": ".claude/hooks/cct-validate.sh", "timeout": 30}]}],
        "PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": ".claude/hooks/cct-precommit.sh", "timeout": 30}]}]
      }
    }' > "$SETTINGS_FILE"
    echo "   ✓ Hooks added to settings.json"
  fi
else
  cat > "$SETTINGS_FILE" <<'EOF'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/cct-validate.sh",
            "timeout": 30
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/cct-precommit.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
EOF
  echo "   ✓ Created $SETTINGS_FILE with hook configuration"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CC-Tricks hooks installed!"
echo ""
echo "What's active:"
echo "  • SKILL.md files are validated after every edit"
echo "  • git commit is gated — failing skills block commits"
echo "  • /lgtm command available for on-demand validation"
echo ""
echo "Try it: create or edit a SKILL.md and watch the hook fire."
