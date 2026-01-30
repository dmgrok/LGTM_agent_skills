# LGTM Agent Skills

**Looks Good To Me** - A validation, security scanning, and quality analysis tool for Agent Skills.

## Overview

LGTM Agent Skills provides comprehensive tooling for validating AI agent skills according to the [Agent Skills Specification](https://agentskills.io/specification). It can be used as a **CLI tool** or **GitHub Action**.

### Features

- **Scoring System** - Global score (0-100) with KPI breakdown
- **Spec Compliance Validation** - Deterministic validation against the official Agent Skills spec
- **Security Scanner** - Based on [Cisco AI Defense skill-scanner](https://github.com/cisco-ai-defense/skill-scanner) threat taxonomy
- **Secret Detection** - Uses industry-standard tools (gitleaks, trufflehog) instead of regex
- **Circular Dependency Detection** - DFS-based cycle detection for skill dependencies
- **Test Validation** - Checks for test cases and dependencies
- **GitHub Action** - Integrates into CI/CD pipelines

## Installation

```bash
npm install
npm run build
```

### Global CLI Installation

```bash
npm install -g .
lgtm-skills --help
```

### Secret Detection Tools (Recommended)

For best secret detection accuracy, install one of these tools:

```bash
# Option 1: Gitleaks (recommended)
brew install gitleaks

# Option 2: TruffleHog
brew install trufflehog

# The scanner will use these automatically if available,
# otherwise falls back to pattern-based detection.
```

## CLI Usage

### Validate a Skill

```bash
# Validate a single skill
lgtm-skills validate ./my-skill/

# Validate with custom threshold
lgtm-skills validate ./my-skill --min-score 80

# JSON output for CI
lgtm-skills validate ./my-skill --format json

# GitHub format (for Actions)
lgtm-skills validate ./my-skill --format github
```

### Example Output

```
═══════════════════════════════════════════════════════════════
  LGTM Agent Skills Validator - Score: 95/100
═══════════════════════════════════════════════════════════════

✅ Spec Compliance        [████████████████████] 100/100 (weight: 40%)
   ✓ Passes Agent Skills specification | ✓ No spec errors

✅ Security               [████████████████████] 100/100 (weight: 40%)
   ✓ No security issues detected

✅ Content Quality        [████████████████░░░░] 80/100 (weight: 10%)
   ✓ Contains examples | ✓ Contains instructions/steps

✅ Testing & Dependencies [██████████████░░░░░░] 70/100 (weight: 10%)
   ⚠️ No test cases defined

───────────────────────────────────────────────────────────────
  ✅ Score: 95/100 - Skill passes validation
───────────────────────────────────────────────────────────────
```

### Security Scan Only

```bash
lgtm-skills scan ./my-skill/
```

### Scaffold a New Skill

```bash
lgtm-skills scaffold my-new-skill
```

## GitHub Action

Add to your workflow:

```yaml
name: Validate Skills
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: dmgrok/LGTM_agent_skills@v1
        with:
          path: './skills/'
          min-score: 70
```

### Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `path` | Path to SKILL.md file or directory | `.` |
| `min-score` | Minimum score to pass (0-100) | `70` |
| `fail-on-error` | Fail the action if validation fails | `true` |

### Outputs

| Output | Description |
|--------|-------------|
| `score` | Global validation score (0-100) |
| `passed` | Whether validation passed (true/false) |
| `spec-compliance` | Spec compliance KPI score |
| `security` | Security KPI score |
| `content` | Content quality KPI score |
| `testing` | Testing & dependencies KPI score |

## Scoring System

The global score is a weighted average of four KPIs:

| KPI | Weight | Description |
|-----|--------|-------------|
| **Spec Compliance** | 40% | Valid frontmatter, name format, description |
| **Security** | 40% | No threats, secrets, or malicious patterns |
| **Content Quality** | 10% | Word count, examples, instructions |
| **Testing** | 10% | Test cases, dependency validation |

### Scoring Rules

- **Critical security issues**: -50 points
- **High security issues**: -25 points
- **Spec errors**: -25 points each
- **Spec warnings**: -5 points each
- **No tests defined**: -30 points
- **No examples**: -15 points

## Architecture

```
src/
  cli.ts                      # CLI entry point
  action.ts                   # GitHub Action entry point
  analyzer.ts                 # Main analysis orchestrator
  scoring.ts                  # Scoring calculation
  index.ts                    # Package exports
  scanners/
    types.ts                  # Shared types and interfaces
    spec-validator.ts         # Agent Skills spec validation
    security-scanner.ts       # Security threats and secrets
    dependency-validator.ts   # Dependencies and tests
    test-runner.ts            # Test execution and scaffolding
    index.ts                  # Module exports
```

## Programmatic Usage

```typescript
import { analyzeSkill, validateSkill, SkillAnalyzer } from 'lgtm-agent-skills';

// Quick validation
const result = await validateSkill('./my-skill/SKILL.md');
console.log(`Score: ${result.score}, Passed: ${result.passed}`);

// Full analysis
const analysis = await analyzeSkill('./my-skill/SKILL.md');
console.log(analysis.score.kpis);

// Custom options
const analyzer = new SkillAnalyzer({
  scoring: { minGlobalScore: 80 },
  format: 'json'
});
const result = await analyzer.analyze('./my-skill/SKILL.md');
```

## License

MIT
