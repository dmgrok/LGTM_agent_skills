/**
 * Dependency Validator
 *
 * Validates skill dependencies and detects circular dependencies.
 * Based on scalble_skills RFC-001-dependencies-testing.
 *
 * @see https://github.com/AndoSan84/scalble_skills
 */
import { RawSkill, QualityEvaluator, QualityEvaluation, DependencyValidationResult, TestValidationResult, DependencyGraph, CircularDependencyResult } from './types.js';
/**
 * Validates skill dependencies and test definitions
 * Based on scalble_skills RFC-001-dependencies-testing
 */
export declare class DependencyValidator implements QualityEvaluator {
    name: string;
    evaluate(skill: RawSkill): Promise<QualityEvaluation>;
    validateDependencies(skill: RawSkill): DependencyValidationResult;
    validateTests(skill: RawSkill): TestValidationResult;
}
/**
 * Detects circular dependencies using DFS algorithm
 * Port of detect_circular_dependencies from skills_ref.py
 */
export declare class CircularDependencyDetector {
    /**
     * Build a dependency graph from a collection of skills
     */
    buildGraph(skills: RawSkill[]): DependencyGraph;
    /**
     * Detect circular dependencies using depth-first search
     * Returns all cycles found in the dependency graph
     */
    detectCycles(graph: DependencyGraph): string[][];
    /**
     * Full circular dependency check
     */
    check(skills: RawSkill[]): CircularDependencyResult;
    /**
     * Check if a specific skill is involved in any circular dependency
     */
    isInCycle(skillName: string, cycles: string[][]): boolean;
}
//# sourceMappingURL=dependency-validator.d.ts.map