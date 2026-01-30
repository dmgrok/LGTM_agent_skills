/**
 * Shared types for all scanners
 *
 * This module contains interfaces and types used across the scanner modules.
 */
/**
 * Official spec constraints - these are NOT subjective
 */
export declare const AGENT_SKILLS_SPEC: {
    readonly name: {
        readonly required: true;
        readonly maxLength: 64;
        readonly pattern: RegExp;
        readonly rules: readonly ["Must be 1-64 characters", "May only contain lowercase alphanumeric characters and hyphens (a-z, 0-9, -)", "Must not start or end with hyphen", "Must not contain consecutive hyphens (--)", "Must match the parent directory name"];
    };
    readonly description: {
        readonly required: true;
        readonly minLength: 1;
        readonly maxLength: 1024;
        readonly rules: readonly ["Must be 1-1024 characters", "Should describe what the skill does AND when to use it", "Should include keywords that help agents identify relevant tasks"];
    };
    readonly license: {
        readonly required: false;
        readonly rules: readonly ["License name or reference to bundled license file"];
    };
    readonly compatibility: {
        readonly required: false;
        readonly maxLength: 500;
        readonly rules: readonly ["Max 500 characters if provided", "Should only be included if skill has specific environment requirements"];
    };
    readonly metadata: {
        readonly required: false;
        readonly rules: readonly ["A map from string keys to string values"];
    };
    readonly 'allowed-tools': {
        readonly required: false;
        readonly rules: readonly ["Space-delimited list of pre-approved tools (experimental)"];
    };
    readonly body: {
        readonly recommendedMaxLines: 500;
        readonly recommendedMaxTokens: 5000;
        readonly rules: readonly ["Markdown content after frontmatter", "Keep under 500 lines (move detailed content to references/)", "Recommended sections: step-by-step instructions, examples, edge cases"];
    };
    readonly directories: {
        readonly optional: readonly ["scripts/", "references/", "assets/"];
        readonly rules: readonly ["scripts/ - Executable code (self-contained, good error messages)", "references/ - Additional docs (REFERENCE.md, domain-specific files)", "assets/ - Static resources (templates, images, data files)"];
    };
};
export interface SkillSource {
    repo: string;
    provider: string;
    priority: number;
}
export interface RawSkill {
    name: string;
    description: string;
    content: string;
    source: SkillSource;
    path: string;
    directoryName?: string;
    frontmatter: Record<string, unknown>;
    hasScriptsDir?: boolean;
    hasReferencesDir?: boolean;
    hasAssetsDir?: boolean;
    rawContent?: string;
    filePath?: string;
}
/**
 * Spec compliance result - deterministic, based on official spec
 */
export interface SpecComplianceResult {
    isValid: boolean;
    errors: SpecViolation[];
    warnings: SpecViolation[];
}
export interface SpecViolation {
    field: string;
    rule: string;
    actual: string | undefined;
    severity: 'error' | 'warning';
}
/**
 * Quality evaluation - flexible, non-deterministic
 */
export interface QualityEvaluation {
    evaluator: string;
    evaluatedAt: string;
    scores?: {
        [dimension: string]: {
            score: number;
            confidence: number;
            reasoning?: string;
        };
    };
    observations?: string[];
    suggestions?: string[];
    raw?: unknown;
}
/**
 * Abstract interface for quality evaluators.
 * Implementations can use LLMs, heuristics, or any other method.
 */
export interface QualityEvaluator {
    name: string;
    /**
     * Evaluate a skill's quality. This is intentionally flexible.
     * Evaluators should NOT use hardcoded pattern matching for subjective qualities.
     */
    evaluate(skill: RawSkill): Promise<QualityEvaluation>;
}
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
export interface SecurityFinding {
    category: string;
    aitech: string[];
    severity: Severity;
    description: string;
    match: string;
    location: string;
    line?: number;
    confidence: number;
    detector?: string;
}
export interface SecretScanResult {
    secretsDetected: boolean;
    findings: SecurityFinding[];
    detector?: string;
}
export interface SecurityScanResult {
    isSecure: boolean;
    maxSeverity: Severity;
    findings: SecurityFinding[];
    scanDuration: number;
    secretsResult?: SecretScanResult;
}
export interface DuplicateGroup {
    canonical: string;
    duplicates: string[];
    similarity: number;
    method: string;
}
export interface SemanticInfo {
    technologies: string[];
    domains: string[];
    triggerKeywords: string[];
    referencedFiles: string[];
}
export interface DependencyInfo {
    skill: string;
    version?: string;
}
export interface DependencyValidationResult {
    hasDependencies: boolean;
    dependencies: DependencyInfo[];
    hasCircularRisk: boolean;
    hasVersionConstraints: boolean;
    issues: string[];
}
export interface DependencyGraph {
    [skillName: string]: {
        version?: string;
        requires: string[];
    };
}
export interface CircularDependencyResult {
    hasCircular: boolean;
    cycles: string[][];
    graph: DependencyGraph;
}
export interface TestCaseInfo {
    name: string;
    hasInput: boolean;
    hasAssertions: boolean;
    assertionTypes: string[];
}
export interface TestValidationResult {
    hasTests: boolean;
    testCasesPath?: string;
    testConfig?: {
        timeout?: number;
        parallel?: boolean;
    };
    cases: TestCaseInfo[];
    issues: string[];
}
export interface TestAssertion {
    output_contains?: string[];
    output_not_contains?: string[];
    output_matches?: string[];
    semantic_match?: {
        criterion: string;
        threshold?: number;
    };
}
export interface SkillTestCase {
    name: string;
    description?: string;
    input: string;
    assertions: TestAssertion;
    timeout?: number;
}
export interface TestCaseResult {
    name: string;
    passed: boolean;
    errors: string[];
    duration: number;
    output?: string;
}
export interface TestRunResult {
    skillName: string;
    passed: number;
    total: number;
    results: TestCaseResult[];
    duration: number;
}
export interface EnrichedSkill {
    name: string;
    description: string;
    source: SkillSource;
    path: string;
    specCompliance: SpecComplianceResult;
    qualityEvaluations: QualityEvaluation[];
    semantics: SemanticInfo;
    contentHash: string;
    duplicateOf?: string;
    relatedSkills: string[];
    analyzedAt: string;
    analysisVersion: string;
}
export interface IntelligenceCatalog {
    version: string;
    generatedAt: string;
    analysisVersion: string;
    specVersion: string;
    skills: EnrichedSkill[];
    duplicateGroups: DuplicateGroup[];
    circularDependencies: CircularDependencyResult;
    stats: {
        total: number;
        specCompliant: number;
        withEvaluations: number;
        duplicatesFound: number;
        circularChains: number;
        byProvider: Record<string, number>;
        byDomain: Record<string, number>;
        security: {
            secure: number;
            withFindings: number;
            criticalFindings: number;
            highFindings: number;
            mediumFindings: number;
            byThreatCategory: Record<string, number>;
        };
    };
}
export declare function hashContent(content: string): string;
//# sourceMappingURL=types.d.ts.map