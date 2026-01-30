#!/usr/bin/env npx tsx
/**
 * Test script for skills-ref features (from scalble_skills RFC)
 * Tests: Circular dependency detection, Test runner, Skill scaffolder
 * 
 * @see https://github.com/AndoSan84/scalble_skills/blob/main/skills_ref/skills_ref.py
 */

import {
  CircularDependencyDetector,
  SkillTestRunner,
  SkillScaffolder,
  RawSkill,
  SkillTestCase
} from '../src/scanners/index.js';

// ============================================================================
// Test Data
// ============================================================================

const createMockSkill = (name: string, requires: string[] = []): RawSkill => ({
  name,
  description: `Mock skill: ${name}`,
  content: `# ${name}\n\nThis is a mock skill for testing.`,
  source: { repo: 'test', provider: 'test', priority: 1 },
  path: `/skills/${name}/SKILL.md`,
  directoryName: name,
  frontmatter: {
    name,
    description: `Mock skill: ${name}`,
    requires: requires.map(skill => ({ skill })),
    metadata: { version: '1.0.0' }
  }
});

// ============================================================================
// Circular Dependency Detection Tests
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔄 CIRCULAR DEPENDENCY DETECTION TESTS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const circularDetector = new CircularDependencyDetector();

// Test 1: No circular dependencies
console.log('\n📋 Test 1: Skills without circular dependencies');
const noCycleSkills = [
  createMockSkill('skill-a', ['skill-b']),
  createMockSkill('skill-b', ['skill-c']),
  createMockSkill('skill-c', [])
];
const noCycleResult = circularDetector.check(noCycleSkills);
console.log(`   Has circular: ${noCycleResult.hasCircular}`);
console.log(`   Cycles found: ${noCycleResult.cycles.length}`);
console.log(`   ✓ ${!noCycleResult.hasCircular ? 'PASS' : 'FAIL'}`);

// Test 2: Direct circular dependency (A → B → A)
console.log('\n📋 Test 2: Direct circular dependency (A → B → A)');
const directCycleSkills = [
  createMockSkill('skill-a', ['skill-b']),
  createMockSkill('skill-b', ['skill-a'])
];
const directCycleResult = circularDetector.check(directCycleSkills);
console.log(`   Has circular: ${directCycleResult.hasCircular}`);
console.log(`   Cycles found: ${directCycleResult.cycles.length}`);
if (directCycleResult.cycles.length > 0) {
  console.log(`   Cycle: ${directCycleResult.cycles[0].join(' → ')}`);
}
console.log(`   ✓ ${directCycleResult.hasCircular ? 'PASS' : 'FAIL'}`);

// Test 3: Transitive circular dependency (A → B → C → A)
console.log('\n📋 Test 3: Transitive circular dependency (A → B → C → A)');
const transitiveCycleSkills = [
  createMockSkill('skill-a', ['skill-b']),
  createMockSkill('skill-b', ['skill-c']),
  createMockSkill('skill-c', ['skill-a'])
];
const transitiveCycleResult = circularDetector.check(transitiveCycleSkills);
console.log(`   Has circular: ${transitiveCycleResult.hasCircular}`);
console.log(`   Cycles found: ${transitiveCycleResult.cycles.length}`);
if (transitiveCycleResult.cycles.length > 0) {
  console.log(`   Cycle: ${transitiveCycleResult.cycles[0].join(' → ')}`);
}
console.log(`   ✓ ${transitiveCycleResult.hasCircular ? 'PASS' : 'FAIL'}`);

// Test 4: Self-referencing skill (A → A)
console.log('\n📋 Test 4: Self-referencing skill (A → A)');
const selfRefSkills = [
  createMockSkill('skill-a', ['skill-a'])
];
const selfRefResult = circularDetector.check(selfRefSkills);
console.log(`   Has circular: ${selfRefResult.hasCircular}`);
console.log(`   ✓ ${selfRefResult.hasCircular ? 'PASS' : 'FAIL'}`);

// Test 5: isInCycle helper
console.log('\n📋 Test 5: isInCycle helper function');
const isAInCycle = circularDetector.isInCycle('skill-a', transitiveCycleResult.cycles);
const isDInCycle = circularDetector.isInCycle('skill-d', transitiveCycleResult.cycles);
console.log(`   skill-a in cycle: ${isAInCycle}`);
console.log(`   skill-d in cycle: ${isDInCycle}`);
console.log(`   ✓ ${isAInCycle && !isDInCycle ? 'PASS' : 'FAIL'}`);

// ============================================================================
// Test Runner Tests
// ============================================================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 TEST RUNNER TESTS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const testRunner = new SkillTestRunner();

// Test 6: output_contains assertion
console.log('\n📋 Test 6: output_contains assertion');
const [passed1, errors1] = testRunner.evaluateAssertions(
  'The answer is 42 and it works correctly.',
  { output_contains: ['answer', '42', 'works'] }
);
console.log(`   Passed: ${passed1}, Errors: ${errors1.length}`);
console.log(`   ✓ ${passed1 ? 'PASS' : 'FAIL'}`);

// Test 7: output_contains with missing text
console.log('\n📋 Test 7: output_contains with missing text');
const [passed2, errors2] = testRunner.evaluateAssertions(
  'The answer is 42.',
  { output_contains: ['answer', 'missing_text'] }
);
console.log(`   Passed: ${passed2}, Errors: ${errors2.length}`);
console.log(`   Error: ${errors2[0]}`);
console.log(`   ✓ ${!passed2 && errors2.length === 1 ? 'PASS' : 'FAIL'}`);

// Test 8: output_not_contains assertion
console.log('\n📋 Test 8: output_not_contains assertion');
const [passed3, errors3] = testRunner.evaluateAssertions(
  'Everything is working fine.',
  { output_not_contains: ['error', 'failed', 'exception'] }
);
console.log(`   Passed: ${passed3}, Errors: ${errors3.length}`);
console.log(`   ✓ ${passed3 ? 'PASS' : 'FAIL'}`);

// Test 9: output_not_contains with forbidden text present
console.log('\n📋 Test 9: output_not_contains with forbidden text present');
const [passed4, errors4] = testRunner.evaluateAssertions(
  'An error occurred during execution.',
  { output_not_contains: ['error', 'failed'] }
);
console.log(`   Passed: ${passed4}, Errors: ${errors4.length}`);
console.log(`   Error: ${errors4[0]}`);
console.log(`   ✓ ${!passed4 && errors4.length === 1 ? 'PASS' : 'FAIL'}`);

// Test 10: output_matches regex assertion
console.log('\n📋 Test 10: output_matches regex assertion');
const [passed5, errors5] = testRunner.evaluateAssertions(
  'Result: 123-456-789',
  { output_matches: ['\\d{3}-\\d{3}-\\d{3}', 'Result:.*'] }
);
console.log(`   Passed: ${passed5}, Errors: ${errors5.length}`);
console.log(`   ✓ ${passed5 ? 'PASS' : 'FAIL'}`);

// Test 11: Combined assertions
console.log('\n📋 Test 11: Combined assertions');
const [passed6, errors6] = testRunner.evaluateAssertions(
  'Success: Created user john@example.com with ID 12345',
  {
    output_contains: ['Success', 'user'],
    output_not_contains: ['error', 'failed'],
    output_matches: ['\\w+@\\w+\\.\\w+', 'ID\\s+\\d+']
  }
);
console.log(`   Passed: ${passed6}, Errors: ${errors6.length}`);
console.log(`   ✓ ${passed6 ? 'PASS' : 'FAIL'}`);

// Test 12: Run test case with mock agent
console.log('\n📋 Test 12: Run test case with mock agent');
const testCase: SkillTestCase = {
  name: 'basic_test',
  description: 'Test basic skill functionality',
  input: 'Create a hello world function',
  assertions: {
    output_contains: ['function', 'hello'],
    output_not_contains: ['error']
  }
};

const mockAgent = async (_skill: string, _input: string): Promise<string> => {
  return 'Here is the function: function hello() { console.log("Hello World"); }';
};

const caseResult = await testRunner.runTestCase(testCase, '# Mock Skill', mockAgent);
console.log(`   Test: ${caseResult.name}`);
console.log(`   Passed: ${caseResult.passed}`);
console.log(`   Duration: ${caseResult.duration}ms`);
console.log(`   ✓ ${caseResult.passed ? 'PASS' : 'FAIL'}`);

// ============================================================================
// Skill Scaffolder Tests
// ============================================================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🏗️  SKILL SCAFFOLDER TESTS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const scaffolder = new SkillScaffolder();

// Test 13: Basic scaffold
console.log('\n📋 Test 13: Basic skill scaffold');
const basicScaffold = scaffolder.scaffold({
  name: 'my-new-skill',
  description: 'A skill that does something useful'
});
console.log(`   SKILL.md generated: ${basicScaffold.skillMd.length} chars`);
console.log(`   Has frontmatter: ${basicScaffold.skillMd.includes('---')}`);
console.log(`   Has name: ${basicScaffold.skillMd.includes('name: my-new-skill')}`);
console.log(`   Has test config: ${basicScaffold.skillMd.includes('test:')}`);
console.log(`   Directories: ${basicScaffold.directories.join(', ')}`);
console.log(`   ✓ ${basicScaffold.skillMd.includes('my-new-skill') ? 'PASS' : 'FAIL'}`);

// Test 14: Scaffold with dependencies
console.log('\n📋 Test 14: Scaffold with available skills (auto-populated requires)');
const depsScaffold = scaffolder.scaffold({
  name: 'dependent-skill',
  availableSkills: [
    { name: 'base-skill', version: '1.0.0' },
    { name: 'utility-skill', version: '2.0.0' }
  ]
});
console.log(`   Has requires block: ${depsScaffold.skillMd.includes('requires:')}`);
console.log(`   References base-skill: ${depsScaffold.skillMd.includes('base-skill')}`);
console.log(`   Has version constraint: ${depsScaffold.skillMd.includes('version: "1.0.0"')}`);
console.log(`   ✓ ${depsScaffold.skillMd.includes('requires:') ? 'PASS' : 'FAIL'}`);

// Test 15: Scaffold with test cases
console.log('\n📋 Test 15: Scaffold with test cases YAML');
const testScaffold = scaffolder.scaffold({
  name: 'tested-skill',
  includeTests: true
});
console.log(`   Test YAML generated: ${testScaffold.testCasesYaml ? 'Yes' : 'No'}`);
console.log(`   Has cases: ${testScaffold.testCasesYaml?.includes('cases:')}`);
console.log(`   Has assertions: ${testScaffold.testCasesYaml?.includes('assertions:')}`);
console.log(`   ✓ ${testScaffold.testCasesYaml?.includes('cases:') ? 'PASS' : 'FAIL'}`);

// Test 16: Name validation
console.log('\n📋 Test 16: Skill name validation');
const validName = scaffolder.validateName('my-valid-skill');
const invalidName1 = scaffolder.validateName('My_Invalid_Skill');
const invalidName2 = scaffolder.validateName('-starts-with-hyphen');
const invalidName3 = scaffolder.validateName('has--double--hyphens');

console.log(`   'my-valid-skill': valid=${validName.valid}`);
console.log(`   'My_Invalid_Skill': valid=${invalidName1.valid}, errors: ${invalidName1.errors[0]}`);
console.log(`   '-starts-with-hyphen': valid=${invalidName2.valid}`);
console.log(`   'has--double--hyphens': valid=${invalidName3.valid}`);
console.log(`   ✓ ${validName.valid && !invalidName1.valid && !invalidName2.valid ? 'PASS' : 'FAIL'}`);

// ============================================================================
// Summary
// ============================================================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`
Features from scalble_skills skills_ref.py now integrated:

✓ CircularDependencyDetector
  - DFS-based cycle detection
  - buildGraph() for dependency analysis
  - detectCycles() returns all circular chains
  - isInCycle() helper for individual skill checks

✓ SkillTestRunner  
  - evaluateAssertions() supports:
    • output_contains (case-insensitive)
    • output_not_contains (case-insensitive)
    • output_matches (regex patterns)
    • semantic_match (LLM placeholder)
  - runTestCase() with async agent runner
  - runTests() for batch execution

✓ SkillScaffolder
  - scaffold() generates SKILL.md templates
  - Auto-populates requires from available skills
  - Generates test/cases.yaml templates
  - validateName() enforces spec requirements

All features added to skill-intelligence.ts (v2.2.0)
`);
