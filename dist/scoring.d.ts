/**
 * Scoring System
 *
 * Calculates a global score (0-100) with breakdown by KPI categories.
 * Used for GitHub Action pass/fail decisions and CLI output.
 */
export interface KPIScore {
    name: string;
    score: number;
    weight: number;
    passed: boolean;
    details: string[];
    issues: string[];
}
export interface ScoreResult {
    globalScore: number;
    passed: boolean;
    kpis: KPIScore[];
    summary: string;
}
export interface ScoringOptions {
    minGlobalScore?: number;
    weights?: {
        specCompliance: number;
        security: number;
        content: number;
        testing: number;
        originality: number;
    };
    /** Skip duplicate check against public registries */
    skipDuplicateCheck?: boolean;
}
export declare class ScoringCalculator {
    private options;
    constructor(options?: ScoringOptions);
    /**
     * Calculate spec compliance KPI
     */
    calculateSpecComplianceKPI(result: {
        isValid: boolean;
        errors: Array<{
            field: string;
            rule: string;
        }>;
        warnings: Array<{
            field: string;
            rule: string;
        }>;
    }): KPIScore;
    /**
     * Calculate security KPI
     * Note: Severity values are uppercase (CRITICAL, HIGH, MEDIUM, LOW)
     */
    calculateSecurityKPI(result: {
        findings: Array<{
            severity: string;
            category: string;
            description: string;
        }>;
        secretsDetected: boolean;
    }): KPIScore;
    /**
     * Calculate content quality KPI
     */
    calculateContentKPI(result: {
        wordCount: number;
        hasExamples: boolean;
        hasInstructions: boolean;
        lineCount: number;
    }): KPIScore;
    /**
     * Calculate testing KPI
     */
    calculateTestingKPI(result: {
        hasTests: boolean;
        testCount: number;
        hasDependencies: boolean;
        dependencyIssues: string[];
    }): KPIScore;
    /**
     * Calculate originality KPI (duplicates against public registries)
     */
    calculateOriginalityKPI(result: {
        hasDuplicates: boolean;
        matches: Array<{
            skill: {
                name: string;
                source: string;
            };
            similarity: number;
            matchType: string;
        }>;
    }): KPIScore;
    /**
     * Skip originality check (returns 100% score)
     */
    skipOriginalityKPI(): KPIScore;
    /**
     * Calculate global score from KPIs
     */
    calculateGlobalScore(kpis: KPIScore[]): ScoreResult;
}
/**
 * Format score result for CLI output
 */
export declare function formatScoreForCLI(result: ScoreResult): string;
/**
 * Format score result for GitHub Actions output
 */
export declare function formatScoreForGitHubAction(result: ScoreResult): {
    summary: string;
    annotations: Array<{
        level: 'error' | 'warning' | 'notice';
        message: string;
    }>;
    outputs: Record<string, string>;
};
//# sourceMappingURL=scoring.d.ts.map