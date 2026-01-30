/**
 * LGTM Agent Skills
 * 
 * Looks Good To Me - Validation, security scanning, and quality analysis
 * for Agent Skills following the agentskills.io specification.
 * 
 * @see https://agentskills.io/specification
 */

export {
  // Spec constants
  AGENT_SKILLS_SPEC,
  
  // Core types
  type SkillSource,
  type RawSkill,
  type SpecComplianceResult,
  type SpecViolation,
  type QualityEvaluation,
  type DuplicateGroup,
  type SemanticInfo,
  type EnrichedSkill,
  type IntelligenceCatalog,
  
  // Validator
  SpecValidator,
  
  // Evaluators
  type QualityEvaluator,
  ObjectiveMetricsEvaluator,
  LLMQualityEvaluator,
  
  // Security Scanner
  THREAT_TAXONOMY,
  type ThreatCategory,
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
  
  // Semantic Extraction
  SemanticExtractor,
  
  // Duplicate Detection
  DuplicateDetector,
  
  // Main Pipeline
  type PipelineOptions,
  SkillIntelligencePipeline
} from './skill-intelligence.js';
