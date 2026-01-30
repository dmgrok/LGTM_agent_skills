# LGTM Agent Skills

**Looks Good To Me** - A validation, security scanning, and quality analysis tool for Agent Skills.

## Overview

LGTM Agent Skills provides comprehensive tooling for validating AI agent skills according to the [Agent Skills Specification](https://agentskills.io/specification). It can be used as a **CLI tool** or **GitHub Action**.

### Features

- **Scoring System** - Global score (0-100) with 5 KPI breakdown
- **Spec Compliance Validation** - Deterministic validation against the official Agent Skills spec
- **Security Scanner** - Based on [Cisco AI Defense skill-scanner](https://github.com/cisco-ai-defense/skill-scanner) threat taxonomy
- **Lakera Guard Integration** - Optional professional prompt injection detection via [Lakera API](https://lakera.ai)
- **Secret Detection** - Uses industry-standard tools (gitleaks, trufflehog) instead of regex
- **Duplicate Detection** - Checks against 1000+ skills from [skills.sh](https://skills.sh) registry
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

### Lakera Guard (Optional)

For professional-grade prompt injection detection, get a free API key from [Lakera](https://platform.lakera.ai/):

```bash
# Set environment variable
export LAKERA_GUARD_API_KEY=your-api-key

# Or pass directly
lgtm-skills validate ./skill --lakera-key your-api-key
```

Lakera Guard detects:
- **Prompt injection attacks** - Attempts to manipulate AI behavior
- **Jailbreak attempts** - Bypassing safety guidelines
- **PII leakage** - Personal identifiable information
- **Malicious links** - Unknown or suspicious URLs

## CLI Usage

### Validate a Skill

```bash
# Validate a single skill
lgtm-skills validate ./my-skill/

# Validate with custom threshold
lgtm-skills validate ./my-skill --min-score 80

# Skip duplicate check (faster, works offline)
lgtm-skills validate ./my-skill --skip-duplicates

# JSON output for CI
lgtm-skills validate ./my-skill --format json

# GitHub format (for Actions)
lgtm-skills validate ./my-skill --format github
```

### Example Output

```
═══════════════════════════════════════════════════════════════
  LGTM Agent Skills Validator - Score: 92/100
═══════════════════════════════════════════════════════════════

✅ Spec Compliance        [████████████████████] 100/100 (weight: 35%)
   ✓ Passes Agent Skills specification | ✓ No spec errors

✅ Security               [████████████████████] 100/100 (weight: 35%)
   ✓ No security issues detected

✅ Content Quality        [████████████████░░░░] 80/100 (weight: 10%)
   ✓ Contains examples | ✓ Contains instructions/steps

✅ Testing & Dependencies [██████████████░░░░░░] 70/100 (weight: 10%)
   ⚠️ No test cases defined

✅ Originality            [████████████████████] 100/100 (weight: 10%)
   ✓ No duplicates found in skills.sh registry

───────────────────────────────────────────────────────────────
  ✅ Score: 92/100 - Skill passes validation
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

### With Lakera Guard

For enhanced prompt injection detection:

```yaml
name: Validate Skills (with Lakera)
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
          lakera-api-key: ${{ secrets.LAKERA_GUARD_API_KEY }}
```

### Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `path` | Path to SKILL.md file or directory | `.` |
| `min-score` | Minimum score to pass (0-100) | `70` |
| `fail-on-error` | Fail the action if validation fails | `true` |
| `skip-duplicates` | Skip duplicate check against public registries | `false` |
| `lakera-api-key` | Lakera Guard API key for prompt injection detection | `''` |

### Outputs

| Output | Description |
|--------|-------------|
| `score` | Global validation score (0-100) |
| `passed` | Whether validation passed (true/false) |
| `spec-compliance` | Spec compliance KPI score |
| `security` | Security KPI score |
| `content` | Content quality KPI score |
| `testing` | Testing & dependencies KPI score |
| `originality` | Originality KPI score (duplicate detection) |

## Scoring System

The global score is a weighted average of five KPIs:

| KPI | Weight | Description |
|-----|--------|-------------|
| **Spec Compliance** | 35% | Valid frontmatter, name format, description |
| **Security** | 35% | No threats, secrets, or malicious patterns |
| **Content Quality** | 10% | Word count, examples, instructions |
| **Testing** | 10% | Test cases, dependency validation |
| **Originality** | 10% | No duplicates in [skills.sh](https://skills.sh) registry |

### Scoring Rules

- **Critical security issues**: -50 points
- **High security issues**: -25 points
- **Spec errors**: -25 points each
- **Spec warnings**: -5 points each
- **No tests defined**: -30 points
- **No examples**: -15 points
- **Exact duplicate found**: -50 points
- **Similar skill found**: -25 points

## Duplicate Detection

LGTM connects to the [skills.sh](https://skills.sh) API to check your skill against **1000+ published skills**:

```bash
# Check if your skill duplicates an existing one
lgtm-skills validate ./my-skill/

# Skip duplicate check (faster, offline mode)
lgtm-skills validate ./my-skill/ --skip-duplicates
```

The registry includes skills from:
- vercel-labs/agent-skills
- anthropics/skills
- expo/skills
- supabase/agent-skills
- And 100+ more repositories...

## Architecture

```
src/
  cli.ts                      # CLI entry point
  action.ts                   # GitHub Action entry point
  analyzer.ts                 # Main analysis orchestrator
  scoring.ts                  # Scoring calculation (5 KPIs)
  registry.ts                 # skills.sh API integration
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
import { 
  analyzeSkill, 
  validateSkill, 
  SkillAnalyzer,
  checkDuplicatesAgainstRegistry,
  listRegistrySkills 
} from 'lgtm-agent-skills';

// Quick validation
const result = await validateSkill('./my-skill/SKILL.md');
console.log(`Score: ${result.score}, Passed: ${result.passed}`);

// Full analysis
const analysis = await analyzeSkill('./my-skill/SKILL.md');
console.log(analysis.score.kpis);

// Custom options (skip duplicate check for speed)
const analyzer = new SkillAnalyzer({
  scoring: { minGlobalScore: 80 },
  skipDuplicateCheck: true,
  format: 'json'
});
const result = await analyzer.analyze('./my-skill/SKILL.md');

// Check duplicates directly
const duplicates = await checkDuplicatesAgainstRegistry({
  name: 'my-skill',
  description: 'Does something cool'
});
console.log(duplicates.hasDuplicates, duplicates.matches);

// List all skills from skills.sh
const allSkills = await listRegistrySkills();
console.log(`Registry has ${allSkills.length} skills`);
```

## License

MIT
