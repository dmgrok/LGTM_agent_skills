/**
 * Test Runner & Skill Scaffolder
 *
 * Test runner for skill test cases and scaffolder for new skills.
 * Based on scalble_skills RFC.
 *
 * @see https://github.com/AndoSan84/scalble_skills/blob/main/skills_ref/skills_ref.py
 */
import { TestAssertion, SkillTestCase, TestCaseResult, TestRunResult } from './types.js';
/**
 * Test runner for skill test cases
 * Evaluates assertions against agent output
 */
export declare class SkillTestRunner {
    /**
     * Evaluate assertions against output
     * Returns [passed, errors]
     */
    evaluateAssertions(output: string, assertions: TestAssertion): [boolean, string[]];
    /**
     * Run a single test case
     * agentRunner: async function that takes (skillContent, input) and returns output
     */
    runTestCase(testCase: SkillTestCase, skillContent: string, agentRunner?: (skillContent: string, input: string) => Promise<string>): Promise<TestCaseResult>;
    /**
     * Run all test cases for a skill
     */
    runTests(skillName: string, skillContent: string, testCases: SkillTestCase[], agentRunner?: (skillContent: string, input: string) => Promise<string>): Promise<TestRunResult>;
    /**
     * Parse test cases from YAML content
     */
    parseTestCases(yamlContent: string): SkillTestCase[];
}
export interface ScaffoldOptions {
    name: string;
    description?: string;
    version?: string;
    availableSkills?: Array<{
        name: string;
        version?: string;
    }>;
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
export declare class SkillScaffolder {
    /**
     * Generate a new SKILL.md template
     */
    scaffold(options: ScaffoldOptions): ScaffoldResult;
    /**
     * Validate a skill name follows spec requirements
     */
    validateName(name: string): {
        valid: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=test-runner.d.ts.map