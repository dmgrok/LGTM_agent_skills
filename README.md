# LGTM Agent Skills

**Looks Good To Me** - A validation, security scanning, and quality analysis tool for Agent Skills.

## Overview

LGTM Agent Skills provides comprehensive tooling for validating, scanning, and analyzing AI agent skills according to the [Agent Skills Specification](https://agentskills.io/specification).

### Features

- **Spec Compliance Validation** - Deterministic validation against the official Agent Skills spec
- **Security Scanner** - Based on [Cisco AI Defense skill-scanner](https://github.com/cisco-ai-defense/skill-scanner) threat taxonomy
- **Circular Dependency Detection** - DFS-based cycle detection for skill dependencies
- **Test Runner** - Assertion-based testing (output_contains, output_matches, etc.)
- **Skill Scaffolder** - Generate new skill templates following the spec
- **Duplicate Detection** - Content similarity analysis
- **Semantic Extraction** - Technology and domain classification

## Installation

```bash
npm install
npm run build
```

## Usage

### Validate a Skill

```typescript
import { SpecValidator, RawSkill } from './src/skill-intelligence.js';

const validator = new SpecValidator();
const result = validator.validate(skill);

if (result.isValid) {
  console.log('✓ Skill is valid');
} else {
  console.log('Errors:', result.errors);
}
```

### Security Scan

```typescript
import { SecurityScanner } from './src/skill-intelligence.js';

const scanner = new SecurityScanner();
const evaluation = await scanner.evaluate(skill);

console.log(evaluation.observations);
console.log(evaluation.suggestions);
```

### Check Circular Dependencies

```typescript
import { CircularDependencyDetector } from './src/skill-intelligence.js';

const detector = new CircularDependencyDetector();
const result = detector.check(skills);

if (result.hasCircular) {
  console.log('Cycles found:', result.cycles);
}
```

### Run Tests

```typescript
import { SkillTestRunner, SkillTestCase } from './src/skill-intelligence.js';

const runner = new SkillTestRunner();
const testCase: SkillTestCase = {
  name: 'basic_test',
  input: 'Test input',
  assertions: {
    output_contains: ['expected'],
    output_not_contains: ['error']
  }
};

const result = await runner.runTestCase(testCase, skillContent, agentRunner);
```

### Scaffold New Skill

```typescript
import { SkillScaffolder } from './src/skill-intelligence.js';

const scaffolder = new SkillScaffolder();
const result = scaffolder.scaffold({
  name: 'my-new-skill',
  description: 'A skill that does something useful',
  includeTests: true
});

console.log(result.skillMd);      // SKILL.md content
console.log(result.testCasesYaml); // test/cases.yaml
```

## Security Threat Taxonomy

Based on the Cisco AI Defense framework, LGTM detects:

| Category | AITech | Severity |
|----------|--------|----------|
| Prompt Injection | AITech-1.1, 1.2 | HIGH |
| Code Injection | AITech-9.1.4 | CRITICAL |
| Data Exfiltration | AITech-8.2, 8.2.3 | CRITICAL |
| Hardcoded Secrets | AITech-8.2 | CRITICAL |
| Tool Abuse | AITech-12.1 | HIGH |
| Obfuscation | - | HIGH |
| Social Engineering | AITech-2.1 | MEDIUM |
| Transitive Trust | AITech-1.2 | HIGH |
| Autonomy Abuse | AITech-9.1 | MEDIUM |
| Tool Chaining | AITech-8.2.3 | HIGH |
| Resource Abuse | AITech-13.3.2 | MEDIUM |

## References

- [Agent Skills Specification](https://agentskills.io/specification)
- [Cisco skill-scanner](https://github.com/cisco-ai-defense/skill-scanner)
- [scalble_skills RFC](https://github.com/AndoSan84/scalble_skills)

## License

MIT
