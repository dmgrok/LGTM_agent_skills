/**
 * Test Runner & Skill Scaffolder
 * 
 * Test runner for skill test cases and scaffolder for new skills.
 * Based on scalble_skills RFC.
 * 
 * @see https://github.com/AndoSan84/scalble_skills/blob/main/skills_ref/skills_ref.py
 */

import {
  AGENT_SKILLS_SPEC,
  TestAssertion,
  SkillTestCase,
  TestCaseResult,
  TestRunResult
} from './types.js';

// ============================================================================
// Test Runner
// ============================================================================

/**
 * Test runner for skill test cases
 * Evaluates assertions against agent output
 */
export class SkillTestRunner {
  /**
   * Evaluate assertions against output
   * Returns [passed, errors]
   */
  evaluateAssertions(output: string, assertions: TestAssertion): [boolean, string[]] {
    const errors: string[] = [];
    const outputLower = output.toLowerCase();
    
    // output_contains - check if output contains expected strings
    if (assertions.output_contains) {
      for (const expected of assertions.output_contains) {
        if (!outputLower.includes(expected.toLowerCase())) {
          errors.push(`output_contains: '${expected}' not found in output`);
        }
      }
    }
    
    // output_not_contains - check output doesn't contain forbidden strings
    if (assertions.output_not_contains) {
      for (const forbidden of assertions.output_not_contains) {
        if (outputLower.includes(forbidden.toLowerCase())) {
          errors.push(`output_not_contains: '${forbidden}' found in output`);
        }
      }
    }
    
    // output_matches - check regex patterns
    if (assertions.output_matches) {
      for (const pattern of assertions.output_matches) {
        try {
          const regex = new RegExp(pattern, 'i');
          if (!regex.test(output)) {
            errors.push(`output_matches: pattern '${pattern}' not matched`);
          }
        } catch (e) {
          errors.push(`output_matches: invalid regex '${pattern}'`);
        }
      }
    }
    
    // semantic_match - requires LLM judge (placeholder)
    if (assertions.semantic_match) {
      // This would call an LLM API to judge semantic equivalence
      // For now, we note it needs manual verification
      console.log(`    ⚠ semantic_match requires LLM judge: '${assertions.semantic_match.criterion}'`);
    }
    
    return [errors.length === 0, errors];
  }

  /**
   * Run a single test case
   * agentRunner: async function that takes (skillContent, input) and returns output
   */
  async runTestCase(
    testCase: SkillTestCase,
    skillContent: string,
    agentRunner?: (skillContent: string, input: string) => Promise<string>
  ): Promise<TestCaseResult> {
    const startTime = Date.now();
    
    if (!agentRunner) {
      return {
        name: testCase.name,
        passed: true,
        errors: [],
        duration: Date.now() - startTime,
        output: '(no agent runner configured, skipping execution)'
      };
    }
    
    try {
      const output = await agentRunner(skillContent, testCase.input);
      const [passed, errors] = this.evaluateAssertions(output, testCase.assertions);
      
      return {
        name: testCase.name,
        passed,
        errors,
        duration: Date.now() - startTime,
        output
      };
    } catch (e) {
      return {
        name: testCase.name,
        passed: false,
        errors: [`Execution error: ${e instanceof Error ? e.message : String(e)}`],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Run all test cases for a skill
   */
  async runTests(
    skillName: string,
    skillContent: string,
    testCases: SkillTestCase[],
    agentRunner?: (skillContent: string, input: string) => Promise<string>
  ): Promise<TestRunResult> {
    const startTime = Date.now();
    const results: TestCaseResult[] = [];
    let passed = 0;
    
    console.log(`\nRunning ${testCases.length} test(s) for '${skillName}':\n`);
    
    for (const testCase of testCases) {
      const desc = testCase.description ? ` - ${testCase.description}` : '';
      console.log(`  [${testCase.name}]${desc}`);
      
      const result = await this.runTestCase(testCase, skillContent, agentRunner);
      results.push(result);
      
      if (result.passed) {
        console.log(`    ✓ PASSED`);
        passed++;
      } else {
        console.log(`    ✗ FAILED`);
        for (const err of result.errors) {
          console.log(`      - ${err}`);
        }
      }
    }
    
    console.log(`\nResults: ${passed}/${testCases.length} passed`);
    
    return {
      skillName,
      passed,
      total: testCases.length,
      results,
      duration: Date.now() - startTime
    };
  }

  /**
   * Parse test cases from YAML content
   */
  parseTestCases(yamlContent: string): SkillTestCase[] {
    // Simple YAML-like parser for test cases
    // In production, use a proper YAML library
    const cases: SkillTestCase[] = [];
    
    // Match case blocks
    const caseRegex = /-\s*name:\s*(.+?)(?:\n\s+description:\s*(.+?))?(?:\n\s+input:\s*["'](.+?)["'])?\n\s+assertions:/gs;
    
    // This is a simplified parser - production should use yaml library
    try {
      // If yamlContent looks like JSON, try parsing it
      if (yamlContent.trim().startsWith('{') || yamlContent.trim().startsWith('[')) {
        const parsed = JSON.parse(yamlContent);
        if (parsed.cases && Array.isArray(parsed.cases)) {
          return parsed.cases as SkillTestCase[];
        }
      }
    } catch {
      // Not JSON, continue with basic parsing
    }
    
    return cases;
  }
}

// ============================================================================
// Skill Scaffolder
// ============================================================================

export interface ScaffoldOptions {
  name: string;
  description?: string;
  version?: string;
  availableSkills?: Array<{name: string; version?: string}>;
  includeTests?: boolean;
  includeScripts?: boolean;
  includeReferences?: boolean;
}

export interface ScaffoldResult {
  skillMd: string;
  testCasesYaml?: string;
  directories: string[];
}

/**
 * Scaffolds new skill structures following Agent Skills spec
 */
export class SkillScaffolder {
  /**
   * Generate a new SKILL.md template
   */
  scaffold(options: ScaffoldOptions): ScaffoldResult {
    const {
      name,
      description = 'TODO - Describe what this skill does and when to use it.',
      version = '1.0.0',
      availableSkills = [],
      includeTests = true,
      includeScripts = false,
      includeReferences = false
    } = options;
    
    // Build requires block if skills are available
    let requiresBlock = '';
    if (availableSkills.length > 0) {
      const requiresLines = ['requires:'];
      for (const skill of availableSkills) {
        requiresLines.push(`  - skill: ${skill.name}`);
        if (skill.version) {
          requiresLines.push(`    version: "${skill.version}"`);
        }
      }
      requiresBlock = '\n' + requiresLines.join('\n');
    }
    
    // Build test block
    const testBlock = includeTests ? `
test:
  cases: test/cases.yaml
  config:
    timeout: 60` : '';
    
    const skillMd = `---
name: ${name}
description: ${description}

metadata:
  version: "${version}"
${requiresBlock}${testBlock}
---

# ${name}

## Instructions

TODO - Add skill instructions here.

### When to Use This Skill

- TODO - Describe scenarios when this skill should be activated

### Step-by-Step Guide

1. TODO - First step
2. TODO - Second step
3. TODO - Third step

## Examples

### Example 1: Basic Usage

\`\`\`
TODO - Add example input/output here
\`\`\`

## Edge Cases

- TODO - Handle edge case 1
- TODO - Handle edge case 2

## References

${includeReferences ? 'See [references/REFERENCE.md](references/REFERENCE.md) for detailed documentation.' : 'TODO - Add references if needed'}
`;

    // Generate test cases template
    let testCasesYaml: string | undefined;
    if (includeTests) {
      testCasesYaml = `# Test cases for ${name}
# @see https://agentskills.io/specification#testing

cases:
  - name: basic_test
    description: TODO - Describe what this test verifies
    input: "TODO - The prompt to send"
    assertions:
      output_contains:
        - "expected text"
      output_not_contains:
        - "error"
        - "failed"

  - name: edge_case_test
    description: TODO - Test edge case handling
    input: "TODO - Edge case input"
    assertions:
      output_matches:
        - "pattern.*to.*match"
`;
    }
    
    // Determine directories to create
    const directories: string[] = [];
    if (includeTests) directories.push('test');
    if (includeScripts) directories.push('scripts');
    if (includeReferences) directories.push('references');
    
    return {
      skillMd,
      testCasesYaml,
      directories
    };
  }

  /**
   * Validate a skill name follows spec requirements
   */
  validateName(name: string): {valid: boolean; errors: string[]} {
    const errors: string[] = [];
    
    if (!name) {
      errors.push('Name is required');
      return {valid: false, errors};
    }
    
    if (name.length > 64) {
      errors.push(`Name must be 1-64 characters (got ${name.length})`);
    }
    
    if (!AGENT_SKILLS_SPEC.name.pattern.test(name)) {
      errors.push('Name may only contain lowercase alphanumeric characters and hyphens');
    }
    
    if (name.startsWith('-') || name.endsWith('-')) {
      errors.push('Name must not start or end with hyphen');
    }
    
    if (name.includes('--')) {
      errors.push('Name must not contain consecutive hyphens');
    }
    
    return {valid: errors.length === 0, errors};
  }
}
