/**
 * LGTM Agent Skills
 *
 * Looks Good To Me - Validation, security scanning, and quality analysis
 * for Agent Skills following the agentskills.io specification.
 *
 * @see https://agentskills.io/specification
 */
export { AGENT_SKILLS_SPEC, type SkillSource, type RawSkill, type SpecComplianceResult, type SpecViolation, type QualityEvaluation, type QualityEvaluator, SpecValidator, THREAT_TAXONOMY, type ThreatCategoryType, type Severity, type SecurityFinding, type SecurityScanResult, SecurityScanner, type DependencyInfo, type DependencyValidationResult, type TestCaseInfo, type TestValidationResult, DependencyValidator, type DependencyGraph, type CircularDependencyResult, CircularDependencyDetector, type TestAssertion, type SkillTestCase, type TestCaseResult, type TestRunResult, SkillTestRunner, type ScaffoldOptions, type ScaffoldResult, SkillScaffolder, } from './scanners/index.js';
export { type KPIScore, type ScoreResult, type ScoringOptions, ScoringCalculator, formatScoreForCLI, formatScoreForGitHubAction, } from './scoring.js';
export { type AnalyzerOptions, type AnalysisResult, SkillAnalyzer, parseSkillFile, analyzeSkill, validateSkill, } from './analyzer.js';
export { type SkillMetadata, type SkillRegistry, type DuplicateMatch, type DuplicateCheckResult, type RegistryUpdateStats, SKILLS_SH_API, SkillsRegistryManager, RegistryDuplicateDetector, checkDuplicatesAgainstRegistry, updateSkillsRegistry, listRegistrySkills, } from './registry.js';
//# sourceMappingURL=index.d.ts.map