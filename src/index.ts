/**
 * LGTM Agent Skills
 * 
 * Looks Good To Me - Validation, security scanning, and quality analysis
 * for Agent Skills following the agentskills.io specification.
 * 
 * @see https://agentskills.io/specification
 */

// Re-export from scanners module
export {
  // Spec constants
  AGENT_SKILLS_SPEC,
  
  // Core types
  type SkillSource,
  type RawSkill,
  type SpecComplianceResult,
  type SpecViolation,
  type QualityEvaluation,
  type QualityEvaluator,
  
  // Validator
  SpecValidator,
  
  // Security Scanner
  THREAT_TAXONOMY,
  type ThreatCategoryType,
  type Severity,
  type SecurityFinding,
  type SecurityScanResult,
  SecurityScanner,
  
  // Dependency Validation
  type DependencyInfo,
  type DependencyValidationResult,
  type TestCaseInfo,
  type TestValidationResult,
  DependencyValidator,
  
  // Circular Dependency Detection
  type DependencyGraph,
  type CircularDependencyResult,
  CircularDependencyDetector,
  
  // Test Runner
  type TestAssertion,
  type SkillTestCase,
  type TestCaseResult,
  type TestRunResult,
  SkillTestRunner,
  
  // Skill Scaffolder
  type ScaffoldOptions,
  type ScaffoldResult,
  SkillScaffolder,
} from './scanners/index.js';

// Export from scoring
export {
  type KPIScore,
  type ScoreResult,
  type ScoringOptions,
  ScoringCalculator,
  formatScoreForCLI,
  formatScoreForGitHubAction,
} from './scoring.js';

// Export from analyzer
export {
  type AnalyzerOptions,
  type AnalysisResult,
  SkillAnalyzer,
  parseSkillFile,
  analyzeSkill,
  validateSkill,
} from './analyzer.js';

// Export from registry (duplicate detection against public skills)
export {
  type SkillMetadata,
  type SkillRegistry,
  type DuplicateMatch,
  type DuplicateCheckResult,
  type RegistryUpdateStats,
  SKILLS_SH_API,
  SkillsRegistryManager,
  RegistryDuplicateDetector,
  checkDuplicatesAgainstRegistry,
  updateSkillsRegistry,
  listRegistrySkills,
} from './registry.js';