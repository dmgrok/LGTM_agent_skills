/**
 * Skill Analyzer
 *
 * Main orchestrator that runs all scanners and produces a scored result.
 * This is the primary entry point for both CLI and GitHub Action.
 */
import { SpecValidator, SecurityScanner, DependencyValidator, RawSkill, SecurityScannerOptions } from './scanners/index.js';
import { ScoreResult, ScoringOptions } from './scoring.js';
export interface AnalyzerOptions {
    /** Scoring options */
    scoring?: ScoringOptions;
    /** Security scanner options */
    security?: SecurityScannerOptions;
    /** Enable verbose output */
    verbose?: boolean;
    /** Output format */
    format?: 'cli' | 'json' | 'github';
    /** Skip duplicate check against public registries */
    skipDuplicateCheck?: boolean;
}
export interface AnalysisResult {
    /** Path to the analyzed skill file */
    skillPath: string;
    /** Parsed skill data */
    skill: RawSkill;
    /** Score result with KPIs */
    score: ScoreResult;
    /** Raw scanner results (for debugging) */
    rawResults?: {
        spec: ReturnType<SpecValidator['validate']>;
        security: Awaited<ReturnType<SecurityScanner['scan']>>;
        dependencies: Awaited<ReturnType<DependencyValidator['evaluate']>>;
    };
}
/**
 * Parse a markdown skill file into a RawSkill object
 */
export declare function parseSkillFile(content: string, filePath: string): RawSkill;
export declare class SkillAnalyzer {
    private specValidator;
    private securityScanner;
    private dependencyValidator;
    private duplicateDetector;
    private scoringCalculator;
    private options;
    constructor(options?: AnalyzerOptions);
    /**
     * Analyze a skill file and return a scored result
     */
    analyze(skillPath: string): Promise<AnalysisResult>;
    /**
     * Analyze multiple skill files
     */
    analyzeMultiple(skillPaths: string[]): Promise<AnalysisResult[]>;
    /**
     * Format the result based on output format option
     */
    formatResult(result: AnalysisResult): string;
}
/**
 * Quick analyze a skill file with default options
 */
export declare function analyzeSkill(skillPath: string, options?: AnalyzerOptions): Promise<AnalysisResult>;
/**
 * Check if a skill passes validation (for CI/CD)
 */
export declare function validateSkill(skillPath: string, minScore?: number): Promise<{
    passed: boolean;
    score: number;
    summary: string;
}>;
//# sourceMappingURL=analyzer.d.ts.map