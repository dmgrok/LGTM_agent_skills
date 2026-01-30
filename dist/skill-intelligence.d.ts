/**
 * Skill Intelligence Layer v3
 *
 * A modular analysis pipeline that:
 * 1. Validates skills against the Agent Skills specification (deterministic)
 * 2. Evaluates skill quality through flexible, pluggable evaluators
 * 3. Detects duplicates using content similarity
 * 4. Classifies skills for better discovery
 *
 * Philosophy:
 * - Spec compliance checks are DETERMINISTIC (regex, rules from spec)
 * - Quality evaluation is FLEXIBLE (can use LLM, heuristics, or custom logic)
 * - No hardcoded "good/bad" patterns for subjective qualities
 * - Secret detection uses proper tools (gitleaks/trufflehog) not regex
 *
 * Architecture:
 * - Scanners are composable modules in src/scanners/
 * - Each scan type is isolated and independently testable
 * - Main pipeline orchestrates the scanners
 *
 * @see https://agentskills.io/specification
 */
export * from './scanners/index.js';
import { RawSkill, QualityEvaluator, IntelligenceCatalog } from './scanners/index.js';
export interface PipelineOptions {
    /** Custom evaluators to run (default includes ObjectiveMetricsEvaluator) */
    evaluators?: QualityEvaluator[];
    /** Skip all quality evaluation */
    skipEvaluation?: boolean;
    /** Enable security scanning (default: true) */
    enableSecurityScan?: boolean;
    /** Enable dependency validation (default: true) */
    enableDependencyValidation?: boolean;
    /** Enable circular dependency checking (default: true) */
    enableCircularDependencyCheck?: boolean;
    /** Preferred secret detectors (default: ['gitleaks', 'trufflehog', 'fallback']) */
    preferredSecretDetectors?: ('gitleaks' | 'trufflehog' | 'fallback')[];
}
export declare class SkillIntelligencePipeline {
    readonly ANALYSIS_VERSION = "3.0.0";
    readonly SPEC_VERSION = "1.1";
    private specValidator;
    private semanticExtractor;
    private duplicateDetector;
    private circularDepDetector;
    private evaluators;
    private options;
    constructor(options?: PipelineOptions);
    analyze(skills: RawSkill[]): Promise<IntelligenceCatalog>;
    private findRelatedSkills;
    private calculateStats;
    private calculateSecurityStats;
}
//# sourceMappingURL=skill-intelligence.d.ts.map