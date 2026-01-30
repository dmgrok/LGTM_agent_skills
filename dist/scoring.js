/**
 * Scoring System
 *
 * Calculates a global score (0-100) with breakdown by KPI categories.
 * Used for GitHub Action pass/fail decisions and CLI output.
 */
// ============================================================================
// Scoring Calculator
// ============================================================================
const DEFAULT_OPTIONS = {
    minGlobalScore: 70,
    weights: {
        specCompliance: 35,
        security: 35,
        content: 10,
        testing: 10,
        originality: 10,
    },
    skipDuplicateCheck: false,
};
export class ScoringCalculator {
    options;
    constructor(options = {}) {
        this.options = {
            minGlobalScore: options.minGlobalScore ?? DEFAULT_OPTIONS.minGlobalScore,
            skipDuplicateCheck: options.skipDuplicateCheck ?? DEFAULT_OPTIONS.skipDuplicateCheck,
            weights: {
                specCompliance: options.weights?.specCompliance ?? DEFAULT_OPTIONS.weights.specCompliance,
                security: options.weights?.security ?? DEFAULT_OPTIONS.weights.security,
                content: options.weights?.content ?? DEFAULT_OPTIONS.weights.content,
                testing: options.weights?.testing ?? DEFAULT_OPTIONS.weights.testing,
                originality: options.weights?.originality ?? DEFAULT_OPTIONS.weights.originality,
            },
        };
    }
    /**
     * Calculate spec compliance KPI
     */
    calculateSpecComplianceKPI(result) {
        const details = [];
        const issues = [];
        // Start at 100, deduct for errors and warnings
        let score = 100;
        // Critical errors: -25 each (max 100)
        for (const error of result.errors) {
            score -= 25;
            issues.push(`❌ ${error.field}: ${error.rule}`);
        }
        // Warnings: -5 each (max 50)
        for (const warning of result.warnings) {
            score -= 5;
            if (issues.length < 10) {
                // Don't flood with warnings
                issues.push(`⚠️ ${warning.field}: ${warning.rule}`);
            }
        }
        score = Math.max(0, score);
        if (result.isValid) {
            details.push('✓ Passes Agent Skills specification');
        }
        if (result.errors.length === 0) {
            details.push('✓ No spec errors');
        }
        if (result.warnings.length === 0) {
            details.push('✓ No spec warnings');
        }
        return {
            name: 'Spec Compliance',
            score,
            weight: this.options.weights.specCompliance,
            passed: result.isValid,
            details,
            issues,
        };
    }
    /**
     * Calculate security KPI
     * Note: Severity values are uppercase (CRITICAL, HIGH, MEDIUM, LOW)
     */
    calculateSecurityKPI(result) {
        const details = [];
        const issues = [];
        let score = 100;
        // Group findings by severity (case-insensitive)
        const critical = result.findings.filter((f) => f.severity.toUpperCase() === 'CRITICAL');
        const high = result.findings.filter((f) => f.severity.toUpperCase() === 'HIGH');
        const medium = result.findings.filter((f) => f.severity.toUpperCase() === 'MEDIUM');
        const low = result.findings.filter((f) => f.severity.toUpperCase() === 'LOW');
        // Deductions by severity
        score -= critical.length * 50; // critical = instant fail
        score -= high.length * 25;
        score -= medium.length * 10;
        score -= low.length * 2;
        // Secrets are always critical
        if (result.secretsDetected) {
            score -= 50;
            issues.push('❌ CRITICAL: Secrets/credentials detected');
        }
        score = Math.max(0, score);
        // Build details
        if (result.findings.length === 0) {
            details.push('✓ No security issues detected');
        }
        else {
            details.push(`Found ${result.findings.length} security issue(s)`);
        }
        // Add top issues
        for (const finding of [...critical, ...high].slice(0, 5)) {
            issues.push(`❌ [${finding.severity.toUpperCase()}] ${finding.category}: ${finding.description}`);
        }
        for (const finding of medium.slice(0, 3)) {
            issues.push(`⚠️ [MEDIUM] ${finding.category}: ${finding.description}`);
        }
        return {
            name: 'Security',
            score,
            weight: this.options.weights.security,
            passed: score >= 50 && !result.secretsDetected && critical.length === 0,
            details,
            issues,
        };
    }
    /**
     * Calculate content quality KPI
     */
    calculateContentKPI(result) {
        const details = [];
        const issues = [];
        let score = 100;
        // Word count scoring (min 50 words, ideal 200-1000)
        if (result.wordCount < 20) {
            score -= 40;
            issues.push('❌ Content too short (< 20 words)');
        }
        else if (result.wordCount < 50) {
            score -= 20;
            issues.push('⚠️ Content is brief (< 50 words)');
        }
        else {
            details.push(`✓ Sufficient content (${result.wordCount} words)`);
        }
        // Examples bonus
        if (result.hasExamples) {
            details.push('✓ Contains examples');
        }
        else {
            score -= 15;
            issues.push('⚠️ No examples provided');
        }
        // Instructions check
        if (result.hasInstructions) {
            details.push('✓ Contains instructions/steps');
        }
        else {
            score -= 10;
            issues.push('⚠️ No clear instructions found');
        }
        // Line count check (< 300 recommended)
        if (result.lineCount > 500) {
            score -= 10;
            issues.push('⚠️ Content exceeds recommended length (> 500 lines)');
        }
        score = Math.max(0, score);
        return {
            name: 'Content Quality',
            score,
            weight: this.options.weights.content,
            passed: score >= 50,
            details,
            issues,
        };
    }
    /**
     * Calculate testing KPI
     */
    calculateTestingKPI(result) {
        const details = [];
        const issues = [];
        let score = 100;
        // Tests scoring
        if (!result.hasTests) {
            score -= 30;
            issues.push('⚠️ No test cases defined');
        }
        else {
            details.push(`✓ ${result.testCount} test case(s) defined`);
            if (result.testCount >= 3) {
                details.push('✓ Good test coverage');
            }
            else {
                score -= 10;
                issues.push('⚠️ Consider adding more test cases');
            }
        }
        // Dependency issues
        for (const issue of result.dependencyIssues) {
            score -= 10;
            issues.push(`⚠️ ${issue}`);
        }
        // If has dependencies, having tests is more important
        if (result.hasDependencies && !result.hasTests) {
            score -= 20;
            issues.push('❌ Skills with dependencies should have tests');
        }
        score = Math.max(0, score);
        return {
            name: 'Testing & Dependencies',
            score,
            weight: this.options.weights.testing,
            passed: score >= 50,
            details,
            issues,
        };
    }
    /**
     * Calculate originality KPI (duplicates against public registries)
     */
    calculateOriginalityKPI(result) {
        const details = [];
        const issues = [];
        let score = 100;
        if (!result.hasDuplicates) {
            details.push('✓ No duplicates found in public registries');
        }
        else {
            for (const match of result.matches) {
                const source = match.skill.source;
                const name = match.skill.name;
                const similarity = Math.round(match.similarity * 100);
                if (match.matchType === 'exact-name') {
                    score -= 50;
                    issues.push(`❌ Exact name match: "${name}" exists in ${source}`);
                }
                else if (match.matchType === 'content-hash') {
                    score -= 60;
                    issues.push(`❌ Identical content: "${name}" in ${source}`);
                }
                else if (match.matchType === 'similar-name') {
                    score -= 20;
                    issues.push(`⚠️ Similar name (${similarity}%): "${name}" in ${source}`);
                }
                else if (match.matchType === 'similar-description') {
                    score -= 15;
                    issues.push(`⚠️ Similar description (${similarity}%): "${name}" in ${source}`);
                }
            }
            if (result.matches.length > 0) {
                details.push(`Found ${result.matches.length} potential duplicate(s)`);
            }
        }
        score = Math.max(0, score);
        return {
            name: 'Originality',
            score,
            weight: this.options.weights.originality,
            passed: score >= 50,
            details,
            issues,
        };
    }
    /**
     * Skip originality check (returns 100% score)
     */
    skipOriginalityKPI() {
        return {
            name: 'Originality',
            score: 100,
            weight: this.options.weights.originality,
            passed: true,
            details: ['✓ Duplicate check skipped'],
            issues: [],
        };
    }
    /**
     * Calculate global score from KPIs
     */
    calculateGlobalScore(kpis) {
        // Calculate weighted average
        let totalWeight = 0;
        let weightedSum = 0;
        for (const kpi of kpis) {
            weightedSum += kpi.score * kpi.weight;
            totalWeight += kpi.weight;
        }
        const globalScore = Math.round(weightedSum / totalWeight);
        const passed = globalScore >= this.options.minGlobalScore && kpis.every((k) => k.passed || k.weight < 20);
        // Build summary
        const failedKpis = kpis.filter((k) => !k.passed);
        let summary;
        if (passed) {
            summary = `✅ Score: ${globalScore}/100 - Skill passes validation`;
        }
        else if (failedKpis.length > 0) {
            const failedNames = failedKpis.map((k) => k.name).join(', ');
            summary = `❌ Score: ${globalScore}/100 - Failed: ${failedNames}`;
        }
        else {
            summary = `❌ Score: ${globalScore}/100 - Below minimum threshold (${this.options.minGlobalScore})`;
        }
        return {
            globalScore,
            passed,
            kpis,
            summary,
        };
    }
}
// ============================================================================
// Output Formatters
// ============================================================================
/**
 * Format score result for CLI output
 */
export function formatScoreForCLI(result) {
    const lines = [];
    // Header
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`  LGTM Agent Skills Validator - Score: ${result.globalScore}/100`);
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    // KPI breakdown
    for (const kpi of result.kpis) {
        const statusIcon = kpi.passed ? '✅' : '❌';
        const bar = createProgressBar(kpi.score);
        lines.push(`${statusIcon} ${kpi.name.padEnd(22)} ${bar} ${kpi.score}/100 (weight: ${kpi.weight}%)`);
        // Show details for passed KPIs (collapsed)
        if (kpi.passed && kpi.details.length > 0) {
            lines.push(`   ${kpi.details.slice(0, 2).join(' | ')}`);
        }
        // Show issues for failed KPIs
        if (!kpi.passed && kpi.issues.length > 0) {
            for (const issue of kpi.issues.slice(0, 3)) {
                lines.push(`   ${issue}`);
            }
        }
        lines.push('');
    }
    // Summary
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`  ${result.summary}`);
    lines.push('───────────────────────────────────────────────────────────────');
    return lines.join('\n');
}
/**
 * Format score result for GitHub Actions output
 */
export function formatScoreForGitHubAction(result) {
    const annotations = [];
    for (const kpi of result.kpis) {
        if (!kpi.passed) {
            for (const issue of kpi.issues) {
                const level = issue.startsWith('❌') ? 'error' : 'warning';
                annotations.push({ level, message: `[${kpi.name}] ${issue}` });
            }
        }
    }
    // Create markdown summary for GitHub Actions
    let summary = `## LGTM Agent Skills Validation\n\n`;
    summary += `### Score: ${result.globalScore}/100 ${result.passed ? '✅' : '❌'}\n\n`;
    summary += `| KPI | Score | Status |\n`;
    summary += `|-----|-------|--------|\n`;
    for (const kpi of result.kpis) {
        const status = kpi.passed ? '✅ Pass' : '❌ Fail';
        summary += `| ${kpi.name} | ${kpi.score}/100 | ${status} |\n`;
    }
    if (!result.passed) {
        summary += `\n### Issues\n\n`;
        for (const kpi of result.kpis.filter((k) => !k.passed)) {
            summary += `#### ${kpi.name}\n`;
            for (const issue of kpi.issues) {
                summary += `- ${issue}\n`;
            }
        }
    }
    return {
        summary,
        annotations,
        outputs: {
            score: String(result.globalScore),
            passed: String(result.passed),
            'spec-compliance': String(result.kpis.find((k) => k.name === 'Spec Compliance')?.score ?? 0),
            security: String(result.kpis.find((k) => k.name === 'Security')?.score ?? 0),
            content: String(result.kpis.find((k) => k.name === 'Content Quality')?.score ?? 0),
            testing: String(result.kpis.find((k) => k.name === 'Testing & Dependencies')?.score ?? 0),
        },
    };
}
/**
 * Create a visual progress bar
 */
function createProgressBar(score, width = 20) {
    const filled = Math.round((score / 100) * width);
    const empty = width - filled;
    const color = score >= 70 ? '🟩' : score >= 50 ? '🟨' : '🟥';
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}
//# sourceMappingURL=scoring.js.map