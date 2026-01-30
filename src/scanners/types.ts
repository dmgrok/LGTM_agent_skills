/**
 * Shared types for all scanners
 * 
 * This module contains interfaces and types used across the scanner modules.
 */

import * as crypto from 'crypto';

// ============================================================================
// Agent Skills Specification (from agentskills.io/specification)
// ============================================================================

/**
 * Official spec constraints - these are NOT subjective
 */
export const AGENT_SKILLS_SPEC = {
  name: {
    required: true,
    maxLength: 64,
    // "May only contain unicode lowercase alphanumeric characters and hyphens"
    pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
    rules: [
      'Must be 1-64 characters',
      'May only contain lowercase alphanumeric characters and hyphens (a-z, 0-9, -)',
      'Must not start or end with hyphen',
      'Must not contain consecutive hyphens (--)',
      'Must match the parent directory name'
    ]
  },
  description: {
    required: true,
    minLength: 1,
    maxLength: 1024,
    rules: [
      'Must be 1-1024 characters',
      'Should describe what the skill does AND when to use it',
      'Should include keywords that help agents identify relevant tasks'
    ]
  },
  license: {
    required: false,
    rules: ['License name or reference to bundled license file']
  },
  compatibility: {
    required: false,
    maxLength: 500,
    rules: [
      'Max 500 characters if provided',
      'Should only be included if skill has specific environment requirements'
    ]
  },
  metadata: {
    required: false,
    rules: ['A map from string keys to string values']
  },
  'allowed-tools': {
    required: false,
    rules: ['Space-delimited list of pre-approved tools (experimental)']
  },
  body: {
    recommendedMaxLines: 500,
    recommendedMaxTokens: 5000,
    rules: [
      'Markdown content after frontmatter',
      'Keep under 500 lines (move detailed content to references/)',
      'Recommended sections: step-by-step instructions, examples, edge cases'
    ]
  },
  directories: {
    optional: ['scripts/', 'references/', 'assets/'],
    rules: [
      'scripts/ - Executable code (self-contained, good error messages)',
      'references/ - Additional docs (REFERENCE.md, domain-specific files)',
      'assets/ - Static resources (templates, images, data files)'
    ]
  }
} as const;

// ============================================================================
// Core Types
// ============================================================================

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

// ============================================================================
// Spec Compliance Types
// ============================================================================

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

// ============================================================================
// Quality Evaluation Types
// ============================================================================

/**
 * Quality evaluation - flexible, non-deterministic
 */
export interface QualityEvaluation {
  evaluator: string;           // Which evaluator produced this
  evaluatedAt: string;
  
  // Scores are optional - evaluators can provide what they can assess
  scores?: {
    [dimension: string]: {
      score: number;           // 0-100
      confidence: number;      // 0-1, how confident is this assessment
      reasoning?: string;      // Why this score (for transparency)
    };
  };
  
  // Qualitative observations (no scores, just notes)
  observations?: string[];
  
  // Suggested improvements
  suggestions?: string[];
  
  // Raw evaluator output (for debugging/transparency)
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

// ============================================================================
// Security Types
// ============================================================================

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';

export interface SecurityFinding {
  category: string;
  aitech: string[];
  severity: Severity;
  description: string;
  match: string;
  location: string;           // Where in the content (line number or context)
  line?: number;              // Line number (if known)
  confidence: number;         // 0-1, how confident is this detection
  detector?: string;          // Which detector found this (e.g., 'secretlint', 'gitleaks')
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

// ============================================================================
// Duplicate Detection Types
// ============================================================================

export interface DuplicateGroup {
  canonical: string;
  duplicates: string[];
  similarity: number;
  method: string;              // How duplicates were detected
}

// ============================================================================
// Semantic Info Types
// ============================================================================

export interface SemanticInfo {
  // Extracted from content, not scored
  technologies: string[];
  domains: string[];           // e.g., "web development", "data science"
  triggerKeywords: string[];   // Words that might trigger this skill
  referencedFiles: string[];   // Files mentioned in content
}

// ============================================================================
// Dependency Types
// ============================================================================

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

// ============================================================================
// Test Types
// ============================================================================

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
  output_matches?: string[];  // Regex patterns
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

// ============================================================================
// Enriched Skill Types
// ============================================================================

export interface EnrichedSkill {
  // Original
  name: string;
  description: string;
  source: SkillSource;
  path: string;
  
  // Spec compliance (deterministic)
  specCompliance: SpecComplianceResult;
  
  // Quality (flexible, may be empty if no evaluator ran)
  qualityEvaluations: QualityEvaluation[];
  
  // Semantic extraction
  semantics: SemanticInfo;
  
  // Relationships
  contentHash: string;
  duplicateOf?: string;
  relatedSkills: string[];
  
  // Meta
  analyzedAt: string;
  analysisVersion: string;
}

export interface IntelligenceCatalog {
  version: string;
  generatedAt: string;
  analysisVersion: string;
  specVersion: string;         // Which Agent Skills spec version
  
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

// ============================================================================
// Utilities
// ============================================================================

export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}
