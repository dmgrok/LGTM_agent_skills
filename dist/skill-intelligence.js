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
// Re-export all types and scanners for backwards compatibility
export * from './scanners/index.js';
// Import what we need for the pipeline
import { hashContent } from './scanners/index.js';
import { SpecValidator } from './scanners/spec-validator.js';
import { SecurityScanner } from './scanners/security-scanner.js';
import { ObjectiveMetricsEvaluator } from './scanners/quality-evaluators.js';
import { DependencyValidator, CircularDependencyDetector } from './scanners/dependency-validator.js';
import { SemanticExtractor } from './scanners/semantic-extractor.js';
import { DuplicateDetector } from './scanners/duplicate-detector.js';
export class SkillIntelligencePipeline {
    ANALYSIS_VERSION = '3.0.0'; // Major version bump for modular architecture
    SPEC_VERSION = '1.1'; // Agent Skills spec version (with dependencies/testing)
    specValidator = new SpecValidator();
    semanticExtractor = new SemanticExtractor();
    duplicateDetector = new DuplicateDetector();
    circularDepDetector = new CircularDependencyDetector();
    evaluators;
    options;
    constructor(options = {}) {
        this.options = options;
        const defaultEvaluators = [
            new ObjectiveMetricsEvaluator()
        ];
        // Add security scanner by default (can be disabled)
        if (options.enableSecurityScan !== false) {
            defaultEvaluators.push(new SecurityScanner({
                preferredDetectors: options.preferredSecretDetectors
            }));
        }
        // Add dependency validator by default (can be disabled)
        if (options.enableDependencyValidation !== false) {
            defaultEvaluators.push(new DependencyValidator());
        }
        this.evaluators = options.evaluators || defaultEvaluators;
    }
    async analyze(skills) {
        console.log(`\nAnalyzing ${skills.length} skills...`);
        // Step 1: Detect duplicates
        console.log('→ Detecting duplicates...');
        const duplicateGroups = this.duplicateDetector.detectDuplicates(skills);
        const duplicateMap = new Map();
        for (const group of duplicateGroups) {
            for (const dup of group.duplicates) {
                duplicateMap.set(dup, group.canonical);
            }
        }
        // Step 1.5: Check for circular dependencies
        let circularResult = { hasCircular: false, cycles: [], graph: {} };
        if (this.options.enableCircularDependencyCheck !== false) {
            console.log('→ Checking for circular dependencies...');
            circularResult = this.circularDepDetector.check(skills);
            if (circularResult.hasCircular) {
                console.log(`  ⚠ Found ${circularResult.cycles.length} circular dependency chain(s)`);
                for (const cycle of circularResult.cycles) {
                    console.log(`    ${cycle.join(' → ')}`);
                }
            }
        }
        // Step 2: Process each skill
        console.log('→ Validating spec compliance...');
        console.log('→ Extracting semantics...');
        console.log('→ Running evaluators...');
        const enrichedSkills = [];
        let specCompliantCount = 0;
        let withEvaluationsCount = 0;
        for (const skill of skills) {
            // Spec compliance (deterministic)
            const specCompliance = this.specValidator.validate(skill);
            // Add circular dependency warning if applicable
            if (this.circularDepDetector.isInCycle(skill.name, circularResult.cycles)) {
                specCompliance.warnings.push({
                    field: 'requires',
                    rule: 'Skill should not be part of a circular dependency chain',
                    actual: circularResult.cycles.find(c => c.includes(skill.name))?.join(' → '),
                    severity: 'warning'
                });
            }
            if (specCompliance.isValid)
                specCompliantCount++;
            // Semantic extraction
            const semantics = this.semanticExtractor.extract(skill);
            // Quality evaluations (flexible)
            const qualityEvaluations = [];
            if (!this.options.skipEvaluation) {
                for (const evaluator of this.evaluators) {
                    try {
                        const evaluation = await evaluator.evaluate(skill);
                        qualityEvaluations.push(evaluation);
                    }
                    catch (error) {
                        console.error(`Evaluator ${evaluator.name} failed for ${skill.name}:`, error);
                    }
                }
            }
            if (qualityEvaluations.length > 0)
                withEvaluationsCount++;
            // Find related skills (same domain/technologies)
            const relatedSkills = this.findRelatedSkills(skill, skills, semantics);
            enrichedSkills.push({
                name: skill.name,
                description: skill.description,
                source: skill.source,
                path: skill.path,
                specCompliance,
                qualityEvaluations,
                semantics,
                contentHash: hashContent(skill.content),
                duplicateOf: duplicateMap.get(skill.name),
                relatedSkills,
                analyzedAt: new Date().toISOString(),
                analysisVersion: this.ANALYSIS_VERSION
            });
        }
        // Step 3: Calculate stats
        const stats = this.calculateStats(enrichedSkills, duplicateGroups, circularResult);
        return {
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            analysisVersion: this.ANALYSIS_VERSION,
            specVersion: this.SPEC_VERSION,
            skills: enrichedSkills,
            duplicateGroups,
            circularDependencies: circularResult,
            stats: {
                ...stats,
                specCompliant: specCompliantCount,
                withEvaluations: withEvaluationsCount
            }
        };
    }
    findRelatedSkills(skill, allSkills, semantics) {
        const related = [];
        for (const other of allSkills) {
            if (other.name === skill.name)
                continue;
            const otherSemantics = this.semanticExtractor.extract(other);
            // Related if sharing domains or technologies
            const sharedDomains = semantics.domains.filter(d => otherSemantics.domains.includes(d));
            const sharedTech = semantics.technologies.filter(t => otherSemantics.technologies.includes(t));
            if (sharedDomains.length >= 1 || sharedTech.length >= 2) {
                related.push(other.name);
            }
        }
        return related.slice(0, 5);
    }
    calculateStats(skills, duplicateGroups, circularResult) {
        const byProvider = {};
        const byDomain = {};
        for (const skill of skills) {
            byProvider[skill.source.provider] = (byProvider[skill.source.provider] || 0) + 1;
            for (const domain of skill.semantics.domains) {
                byDomain[domain] = (byDomain[domain] || 0) + 1;
            }
        }
        // Calculate security stats from evaluations
        const securityStats = this.calculateSecurityStats(skills);
        return {
            total: skills.length,
            duplicatesFound: duplicateGroups.reduce((sum, g) => sum + g.duplicates.length, 0),
            circularChains: circularResult.cycles.length,
            byProvider,
            byDomain,
            security: securityStats
        };
    }
    calculateSecurityStats(skills) {
        let secure = 0;
        let withFindings = 0;
        let criticalFindings = 0;
        let highFindings = 0;
        let mediumFindings = 0;
        const byThreatCategory = {};
        for (const skill of skills) {
            // Find security scanner evaluation
            const securityEval = skill.qualityEvaluations.find(e => e.evaluator === 'security-scanner');
            if (!securityEval?.raw)
                continue;
            const scanResult = securityEval.raw;
            if (scanResult.isSecure) {
                secure++;
            }
            else {
                withFindings++;
            }
            for (const finding of scanResult.findings) {
                // Count by severity
                if (finding.severity === 'CRITICAL')
                    criticalFindings++;
                else if (finding.severity === 'HIGH')
                    highFindings++;
                else if (finding.severity === 'MEDIUM')
                    mediumFindings++;
                // Count by category
                byThreatCategory[finding.category] = (byThreatCategory[finding.category] || 0) + 1;
            }
        }
        return {
            secure,
            withFindings,
            criticalFindings,
            highFindings,
            mediumFindings,
            byThreatCategory
        };
    }
}
//# sourceMappingURL=skill-intelligence.js.map