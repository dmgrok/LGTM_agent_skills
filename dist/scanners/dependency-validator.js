/**
 * Dependency Validator
 *
 * Validates skill dependencies and detects circular dependencies.
 * Based on scalble_skills RFC-001-dependencies-testing.
 *
 * @see https://github.com/AndoSan84/scalble_skills
 */
// ============================================================================
// Dependency Validator
// ============================================================================
/**
 * Validates skill dependencies and test definitions
 * Based on scalble_skills RFC-001-dependencies-testing
 */
export class DependencyValidator {
    name = 'dependency-validator';
    async evaluate(skill) {
        const depResult = this.validateDependencies(skill);
        const testResult = this.validateTests(skill);
        const observations = [];
        // Dependency observations
        if (depResult.hasDependencies) {
            observations.push(`Dependencies declared: ${depResult.dependencies.length}`);
            for (const dep of depResult.dependencies) {
                observations.push(`  - ${dep.skill}${dep.version ? `@${dep.version}` : ''}`);
            }
            if (depResult.hasVersionConstraints) {
                observations.push('Has version constraints (good for stability)');
            }
        }
        else {
            observations.push('No dependencies declared');
        }
        // Test observations
        if (testResult.hasTests) {
            observations.push(`Test cases defined: ${testResult.cases.length}`);
            const assertionTypes = new Set(testResult.cases.flatMap(c => c.assertionTypes));
            if (assertionTypes.size > 0) {
                observations.push(`Assertion types: ${[...assertionTypes].join(', ')}`);
            }
        }
        else {
            observations.push('No tests defined');
        }
        const suggestions = [
            ...depResult.issues,
            ...testResult.issues
        ];
        return {
            evaluator: this.name,
            evaluatedAt: new Date().toISOString(),
            observations,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
            raw: { dependencies: depResult, tests: testResult }
        };
    }
    validateDependencies(skill) {
        const requires = skill.frontmatter.requires;
        if (!requires || !Array.isArray(requires)) {
            return {
                hasDependencies: false,
                dependencies: [],
                hasCircularRisk: false,
                hasVersionConstraints: false,
                issues: []
            };
        }
        const dependencies = [];
        const issues = [];
        let hasVersionConstraints = false;
        for (const req of requires) {
            if (typeof req === 'object' && req.skill) {
                dependencies.push({
                    skill: req.skill,
                    version: req.version
                });
                if (req.version) {
                    hasVersionConstraints = true;
                    // Validate version format (SemVer)
                    if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/.test(req.version)) {
                        issues.push(`Invalid version format for ${req.skill}: ${req.version} (expected SemVer)`);
                    }
                }
            }
        }
        return {
            hasDependencies: dependencies.length > 0,
            dependencies,
            hasCircularRisk: false, // Would need full skill graph to detect
            hasVersionConstraints,
            issues
        };
    }
    validateTests(skill) {
        const test = skill.frontmatter.test;
        if (!test) {
            return {
                hasTests: false,
                cases: [],
                issues: ['Consider adding tests for better reliability (RFC-001)']
            };
        }
        const issues = [];
        const cases = [];
        // Check if cases path is specified
        if (!test.cases) {
            issues.push('test.cases path not specified');
        }
        // We can't actually read the test file, but we note its path
        return {
            hasTests: !!test.cases,
            testCasesPath: test.cases,
            testConfig: test.config,
            cases, // Would be populated if we could read the cases file
            issues
        };
    }
}
// ============================================================================
// Circular Dependency Detector
// ============================================================================
/**
 * Detects circular dependencies using DFS algorithm
 * Port of detect_circular_dependencies from skills_ref.py
 */
export class CircularDependencyDetector {
    /**
     * Build a dependency graph from a collection of skills
     */
    buildGraph(skills) {
        const graph = {};
        for (const skill of skills) {
            const requires = skill.frontmatter.requires;
            const deps = [];
            if (requires && Array.isArray(requires)) {
                for (const req of requires) {
                    if (typeof req === 'object' && req.skill) {
                        deps.push(req.skill);
                    }
                }
            }
            const metadata = skill.frontmatter.metadata;
            graph[skill.name] = {
                version: metadata?.version,
                requires: deps
            };
        }
        return graph;
    }
    /**
     * Detect circular dependencies using depth-first search
     * Returns all cycles found in the dependency graph
     */
    detectCycles(graph) {
        const cycles = [];
        const visited = new Set();
        const recStack = [];
        const dfs = (node) => {
            // Check if we've found a cycle
            const cycleStart = recStack.indexOf(node);
            if (cycleStart !== -1) {
                // Extract the cycle
                const cycle = [...recStack.slice(cycleStart), node];
                cycles.push(cycle);
                return;
            }
            if (visited.has(node)) {
                return;
            }
            visited.add(node);
            recStack.push(node);
            const neighbors = graph[node]?.requires || [];
            for (const neighbor of neighbors) {
                dfs(neighbor);
            }
            recStack.pop();
        };
        // Run DFS from each node
        for (const node of Object.keys(graph)) {
            if (!visited.has(node)) {
                dfs(node);
            }
        }
        return cycles;
    }
    /**
     * Full circular dependency check
     */
    check(skills) {
        const graph = this.buildGraph(skills);
        const cycles = this.detectCycles(graph);
        return {
            hasCircular: cycles.length > 0,
            cycles,
            graph
        };
    }
    /**
     * Check if a specific skill is involved in any circular dependency
     */
    isInCycle(skillName, cycles) {
        return cycles.some(cycle => cycle.includes(skillName));
    }
}
//# sourceMappingURL=dependency-validator.js.map