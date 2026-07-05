# claude-code-lgtm

Claude Code's `.claude/` folder has no validation. You can ship a `settings.json` with a misspelled hook event name, a hook script that isn't executable, or a slash command missing its frontmatter — and nothing will tell you until something silently misbehaves.

This is a linter for `.claude/`. It also ships a preset system for installing validated Claude Code configurations.

```bash
npm install -g github:dmgrok/LGTM_agent_skills
lgtm
```

```
  LGTM — Claude Code Project Health
  ──────────────────────────────────────────────────

  .claude/settings.json
    ✓ Valid schema
    ✓ Hook events are valid

  .claude/hooks/
    ✓ lgtm-validate.sh is executable
    ✓ lgtm-precommit.sh is executable

  .claude/commands/
    ✓ lgtm.md has description frontmatter

  skills/my-skill/SKILL.md
    ✓ Spec compliant
    ✓ Security: clean

  ──────────────────────────────────────────────────
  0 errors, 0 warnings  ✓
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

`scanProject()` walks `.claude/` and finds all configuration files. `runRules()` runs all five rule classes in parallel, collecting findings. Output renders as terminal text, JSON, or GitHub Actions annotations.

## What it catches

| Rule | What it validates |
|------|-------------------|
| **Settings** | `settings.json` — valid hook event names, matcher syntax, hook types, timeouts (1–600s), command paths that exist on disk |
| **Hooks** | `*.sh` files — executable bit set, stdin handling, dangerous patterns (`curl \| bash`, `rm -rf /`), hardcoded secrets |
| **Commands** | Slash command `.md` files — frontmatter present, `description` field, prompt injection patterns, file size |
| **Skill spec** | `SKILL.md` files — [Agent Skills spec](https://agentskills.io/specification) compliance (name format, required fields, metadata) |
| **Skill security** | `SKILL.md` files — prompt injection, code injection, data exfiltration (10 categories from the Cisco AI Defense taxonomy) |

## Install

The package is not yet published to npm. Install from GitHub:

```bash
npm install -g github:dmgrok/LGTM_agent_skills
# or run once:
npx github:dmgrok/LGTM_agent_skills
```

**Prerequisites:** Node >= 18. For optional features: `jq` (required by preset hooks), `gitleaks` (secret scanning), `LAKERA_GUARD_API_KEY` (ML-based prompt injection detection).

## CLI

```bash
lgtm                          # Check everything in the current directory
lgtm check [path]             # Check a specific path
lgtm check --rule hooks       # Only run hooks rules
lgtm check --rule settings    # Only run settings rules
lgtm check --rule skills      # Only run skills rules
lgtm check --format json      # Machine-readable output
lgtm check --format github    # GitHub Actions annotations
lgtm scan <path>              # Security scan only (skill-security rule)
lgtm init [path]              # Install LGTM hooks into a project
lgtm preset install <name>    # Install a configuration preset
lgtm preset remove <name>     # Remove a preset (clean undo)
lgtm preset list              # Show available and installed presets
lgtm compare                  # Benchmark: baseline vs optimized token usage
lgtm compare --session <uuid> # Analyze a past session's token efficiency
```

## `lgtm compare`

Proves what an optimized Claude Code config actually saves. Two modes:

**Live comparison** — runs the same task twice (once with `--safe-mode`, once with your `.claude/` config) and compares token counts and cost directly.

```bash
lgtm compare
lgtm compare --prompt "List all TypeScript files and what each exports"
```

```
  LGTM Compare — Token Efficiency Benchmark
  ──────────────────────────────────────────────────

                        Baseline        Optimized       Delta
  ──────────────────────────────────────────────────────────────────────
  Model                 sonnet-4-6      opusplan
  Turns                        3               2              -1
  Input tokens            24,312          18,104         -25.5%
  Output tokens            1,847           1,623         -12.1%
  Cache hit rate            0.0%           24.5%         +24.5%
  Duration                  8.2s            6.1s         -25.6%
  ──────────────────────────────────────────────────────────────────────
  Cost                   $0.0312         $0.0198         -36.5%
  ──────────────────────────────────────────────────────────────────────

  ↓ 36.5% cost reduction ($0.0114 per session)
```

**Session analysis** — reads token data from a past Claude Code session (`~/.claude/projects/...`) and estimates what it would have cost with the `token-optimizer` preset. Works offline, no API calls needed.

```bash
lgtm compare --session f88a77db-85ce-43c5-9101-a855d6bd26b4
```

```
  LGTM Compare — Session Analysis
  ──────────────────────────────────────────────────

  Session: f88a77db-85ce-43c5-9101-a855d6bd26b4
  Model: claude-sonnet-4-6  |  Turns: 133

                        Actual          Estimated       Delta
  ──────────────────────────────────────────────────────────────────────
  Input tokens             4,077           3,062         -24.9%
  Cache creates        2,763,168       2,348,693
  Cache reads         12,724,208      14,632,839
  Output tokens           62,853          62,853              —
  ──────────────────────────────────────────────────────────────────────
  Cost                   $14.22           $9.87         -30.6%
  ──────────────────────────────────────────────────────────────────────

  Estimated savings with token-optimizer: $4.35 (30.6%)

  Assumptions:
    • Input tokens reduced 25% — permission pre-approval (5%) + targeted reads (20%)
    • Cache hit rate improved 15% from stable permission config
    • Model: claude-sonnet-4-6 → opusplan (80% Sonnet + 20% Opus, $3.40/MTok)
    • Output tokens unchanged — optimization targets input, not generated content

  Install: lgtm preset install token-optimizer
```

If `claude` CLI is not installed, `lgtm compare` automatically falls back to session analysis on your most recent session.

## `lgtm init`

Installs LGTM's own hooks into your project:

```bash
lgtm init
```

Adds:
- `.claude/hooks/lgtm-validate.sh` — PostToolUse hook, validates any modified SKILL.md and injects findings as a system message
- `.claude/hooks/lgtm-precommit.sh` — PreToolUse hook, blocks `git commit` (exit 2) if staged SKILL.md files fail validation
- `.claude/commands/lgtm.md` — `/lgtm` slash command for on-demand checks

## Presets

A preset bundles Claude Code configuration: hooks, permissions, model settings, slash commands, CLAUDE.md guidelines. Installing merges the config into your project; removing cleanly undoes all changes via a lock file at `.claude/presets.lock.json`.

```bash
lgtm preset install token-optimizer
lgtm preset remove token-optimizer
lgtm preset list
```

### Built-in: `token-optimizer`

| Change | Details |
|--------|---------|
| `model: opusplan` | Opus plans, Sonnet executes — 32% cheaper per token than pure Opus |
| 14 `permissions.allow` entries | Pre-approves `git *`, `grep *`, `find *`, etc. — eliminates permission roundtrips |
| PreToolUse hook on `Read\|Agent` | Nudges Claude toward targeted line-range reads |
| PostToolUse hook on `Read` | Warns when tool output exceeds 50K chars |
| CLAUDE.md snippet | Behavioral guidelines: grep before read, batch calls, no re-reads after writes |
| `/token-status` command | Reports installed model, permissions, and hook status |

```bash
lgtm preset install token-optimizer
# Then run:
lgtm compare
```

To install a local preset:

```bash
lgtm preset install ./my-preset   # directory containing preset.json
```

See [presets/token-optimizer/preset.json](presets/token-optimizer/preset.json) for the manifest schema.

## GitHub Action

```yaml
name: LGTM
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dmgrok/LGTM_agent_skills@main
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
import { scanProject, runRules, formatResults, ALL_RULES } from 'lgtm';
import { compareCommand, parseSession, estimateSavings } from 'lgtm';

// Lint .claude/ config
const files = await scanProject({ path: './my-project' });
const result = await runRules({ files }, ALL_RULES);
console.log(formatResults(result, files, 'cli'));

// Analyze a session
const metrics = await parseSession('f88a77db-...');
const estimate = estimateSavings(metrics);
```

## License

MIT
