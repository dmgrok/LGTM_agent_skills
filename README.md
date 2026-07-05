# cc-tricks

Make Claude Code cheaper and faster with one command.

```bash
npm install -g github:dmgrok/claude-code-tricks-cookbook
cc-tricks preset install token-optimizer
```

That's it. Your next Claude Code session uses ~30% fewer tokens and costs ~30% less. No config files to hand-edit, no docs to read.

## What it installs

The `token-optimizer` preset writes a complete `.claude/` configuration that:

- **Switches to `opusplan`** — Opus plans the approach, Sonnet executes. 32% cheaper per token than pure Opus, same quality.
- **Pre-approves 14 common tools** — `git *`, `grep *`, `find *`, `npm test *`, etc. Eliminates permission roundtrip tokens (each one costs ~500 tokens of back-and-forth).
- **Adds a PreToolUse hook** — nudges Claude toward targeted line-range reads instead of reading entire files.
- **Adds a PostToolUse hook** — warns when a tool response exceeds 50K chars, preventing context bloat.
- **Appends CLAUDE.md guidelines** — behavioral rules like "grep before read", "batch tool calls", "don't re-read after writes".
- **Installs `/token-status`** — a slash command to check your optimization config is active.

Everything is reversible:

```bash
cc-tricks preset remove token-optimizer   # clean undo via lock file
```

## Prove it works

```bash
cc-tricks compare
```

Runs the same task twice — once with bare Claude Code (`--safe-mode`), once with your config — and prints the difference:

```
                      Baseline        Optimized       Delta
  ────────────────────────────────────────────────────────────────
  Model               sonnet-4-6      opusplan
  Turns                      3               2              -1
  Input tokens          24,312          18,104         -25.5%
  Cache hit rate          0.0%           24.5%         +24.5%
  Cost                 $0.0312         $0.0198         -36.5%
  ────────────────────────────────────────────────────────────────
```

Or analyze a past session without re-running anything:

```bash
cc-tricks compare --session <uuid>
```

## Install

```bash
npm install -g github:dmgrok/claude-code-tricks-cookbook
```

Requires Node >= 18. Optional: `jq` (for preset hooks).

## Quick start

```bash
cc-tricks preset install token-optimizer              # optimize Claude Code
cc-tricks preset install github:user/my-preset        # install from GitHub
cc-tricks compare                                     # measure the difference
cc-tricks                                             # lint your .claude/ config
```

---

## Linting

Beyond optimization, `cc-tricks` validates your entire `.claude/` folder — catching misconfigurations before they silently break your setup.

```bash
cc-tricks
```

```
  CC-Tricks — Claude Code Cookbook
  ──────────────────────────────────────────────────

  .claude/settings.json
    ✓ Valid schema
    ✓ Hook events are valid

  .claude/hooks/
    ✓ token-optimizer-concise.sh is executable
    ✓ token-optimizer-monitor.sh is executable

  .claude/commands/
    ✓ token-status.md has description frontmatter

  ──────────────────────────────────────────────────
  0 errors, 0 warnings  ✓
```

| Rule | What it validates |
|------|-------------------|
| **Settings** | Valid hook event names, matcher syntax, timeouts (1–600s), command paths exist |
| **Hooks** | Executable bit, stdin handling, dangerous patterns (`curl \| bash`, `rm -rf /`), secrets |
| **Commands** | Frontmatter present, `description` field, prompt injection patterns |
| **Skill spec** | [Agent Skills spec](https://agentskills.io/specification) compliance |
| **Skill security** | Prompt injection, code injection, data exfiltration (Cisco AI Defense taxonomy) |

## CLI reference

```bash
cc-tricks                              # Check everything
cc-tricks check [path]                 # Check a specific path
cc-tricks check --rule hooks           # Only run hooks rules
cc-tricks check --format json          # Machine-readable output
cc-tricks check --format github        # GitHub Actions annotations
cc-tricks scan <path>                  # Security scan only
cc-tricks init                         # Install validation hooks into project
cc-tricks preset install <name>                    # Install a built-in preset
cc-tricks preset install <name> --set key=value    # Install with config
cc-tricks preset install github:user/repo          # Install from GitHub
cc-tricks preset install github:user/repo#v2       # Specific ref
cc-tricks preset install github:user/repo/subpath  # Subpath in monorepo
cc-tricks preset remove <name>                     # Remove a preset (clean undo)
cc-tricks preset list                              # Show available presets
cc-tricks compare                      # Benchmark baseline vs optimized
cc-tricks compare --session <uuid>     # Analyze a past session
cc-tricks compare --prompt "..."       # Custom benchmark prompt
```

## How it works

```
.claude/             scanProject()         runRules()            output
├── settings.json ──→                    ┌─→ SettingsLintRule ─┐
├── hooks/*.sh    ──→  DiscoveredFiles  ─┼─→ HooksLintRule    ─┼─→ CLI / JSON / GitHub
├── commands/*.md ──→                    ├─→ CommandsLintRule  ─┤   annotations
└── SKILL.md      ──→                    ├─→ SkillSpecRule     ─┤   exit 0 or 1
                                         └─→ SkillSecurityRule ─┘
```

## GitHub Action

```yaml
name: CC-Tricks
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dmgrok/claude-code-tricks-cookbook@main
        with:
          path: '.'
          fail-on-error: true
```

| Input | Default | Description |
|-------|---------|-------------|
| `path` | `.` | Path to SKILL.md file or directory containing skills |
| `min-score` | `70` | Minimum score to pass (0–100) |
| `fail-on-error` | `true` | Fail the action if validation fails |
| `skip-duplicates` | `false` | Skip duplicate check against public registries |
| `lakera-api-key` | `''` | Lakera Guard API key for ML-based prompt injection |

| Output | Description |
|--------|-------------|
| `score` | Global validation score (0–100) |
| `passed` | Whether validation passed (true/false) |
| `spec-compliance` | Spec compliance KPI score |
| `security` | Security KPI score |
| `content` | Content quality KPI score |
| `testing` | Testing & dependencies KPI score |
| `results-file` | Path to JSON results file for artifact upload |

## Programmatic API

```typescript
import { scanProject, runRules, formatResults, ALL_RULES } from 'cc-tricks';
import { compareCommand, parseSession, estimateSavings } from 'cc-tricks';

const files = await scanProject({ path: './my-project' });
const result = await runRules({ files }, ALL_RULES);
console.log(formatResults(result, files, 'cli'));

const metrics = await parseSession('f88a77db-...');
const estimate = estimateSavings(metrics);
```

## License

MIT
