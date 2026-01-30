/**
 * Skill Intelligence Layer v2
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
 * 
 * @see https://agentskills.io/specification
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
// Types
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
  directoryName: string;
  frontmatter: Record<string, unknown>;
  hasScriptsDir?: boolean;
  hasReferencesDir?: boolean;
  hasAssetsDir?: boolean;
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

export interface DuplicateGroup {
  canonical: string;
  duplicates: string[];
  similarity: number;
  method: string;              // How duplicates were detected
}

export interface SemanticInfo {
  // Extracted from content, not scored
  technologies: string[];
  domains: string[];           // e.g., "web development", "data science"
  triggerKeywords: string[];   // Words that might trigger this skill
  referencedFiles: string[];   // Files mentioned in content
}

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
  circularDependencies: CircularDependencyResult;  // New: circular dep info
  
  stats: {
    total: number;
    specCompliant: number;
    withEvaluations: number;
    duplicatesFound: number;
    circularChains: number;   // New: count of circular dep chains
    byProvider: Record<string, number>;
    byDomain: Record<string, number>;
    // Security stats (from Cisco skill-scanner integration)
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
// Spec Compliance Validator (Deterministic)
// ============================================================================

export class SpecValidator {
  /**
   * Validate a skill against the official Agent Skills spec
   * This is DETERMINISTIC - same input always gives same output
   */
  validate(skill: RawSkill): SpecComplianceResult {
    const errors: SpecViolation[] = [];
    const warnings: SpecViolation[] = [];

    // Validate name (required)
    this.validateName(skill, errors, warnings);
    
    // Validate description (required)
    this.validateDescription(skill, errors, warnings);
    
    // Validate optional fields
    this.validateCompatibility(skill, warnings);
    this.validateMetadata(skill, warnings);
    
    // Validate body content (recommendations, not requirements)
    this.validateBody(skill, warnings);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateName(skill: RawSkill, errors: SpecViolation[], warnings: SpecViolation[]): void {
    const name = skill.frontmatter.name as string | undefined;
    
    // Required check
    if (!name) {
      errors.push({
        field: 'name',
        rule: 'name is required',
        actual: undefined,
        severity: 'error'
      });
      return;
    }

    // Length check
    if (name.length > AGENT_SKILLS_SPEC.name.maxLength) {
      errors.push({
        field: 'name',
        rule: `Must be 1-${AGENT_SKILLS_SPEC.name.maxLength} characters`,
        actual: `${name.length} characters`,
        severity: 'error'
      });
    }

    // Pattern check
    if (!AGENT_SKILLS_SPEC.name.pattern.test(name)) {
      errors.push({
        field: 'name',
        rule: 'May only contain lowercase alphanumeric characters and hyphens, no leading/trailing/consecutive hyphens',
        actual: name,
        severity: 'error'
      });
    }

    // Directory name match (if we know it)
    if (skill.directoryName && skill.directoryName !== name) {
      errors.push({
        field: 'name',
        rule: 'Must match the parent directory name',
        actual: `name="${name}" but directory="${skill.directoryName}"`,
        severity: 'error'
      });
    }
  }

  private validateDescription(skill: RawSkill, errors: SpecViolation[], warnings: SpecViolation[]): void {
    const description = skill.frontmatter.description as string | undefined;
    
    if (!description) {
      errors.push({
        field: 'description',
        rule: 'description is required',
        actual: undefined,
        severity: 'error'
      });
      return;
    }

    if (description.length > AGENT_SKILLS_SPEC.description.maxLength) {
      errors.push({
        field: 'description',
        rule: `Must be 1-${AGENT_SKILLS_SPEC.description.maxLength} characters`,
        actual: `${description.length} characters`,
        severity: 'error'
      });
    }
  }

  private validateCompatibility(skill: RawSkill, warnings: SpecViolation[]): void {
    const compatibility = skill.frontmatter.compatibility as string | undefined;
    
    if (compatibility && compatibility.length > AGENT_SKILLS_SPEC.compatibility.maxLength!) {
      warnings.push({
        field: 'compatibility',
        rule: `Max ${AGENT_SKILLS_SPEC.compatibility.maxLength} characters`,
        actual: `${compatibility.length} characters`,
        severity: 'warning'
      });
    }
  }

  private validateMetadata(skill: RawSkill, warnings: SpecViolation[]): void {
    const metadata = skill.frontmatter.metadata;
    
    if (metadata && typeof metadata === 'object') {
      // Check that all values are strings (per spec)
      for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
        if (typeof value !== 'string') {
          warnings.push({
            field: `metadata.${key}`,
            rule: 'metadata values should be strings',
            actual: typeof value,
            severity: 'warning'
          });
        }
      }
    }
  }

  private validateBody(skill: RawSkill, warnings: SpecViolation[]): void {
    const lines = skill.content.split('\n').length;
    
    if (lines > AGENT_SKILLS_SPEC.body.recommendedMaxLines) {
      warnings.push({
        field: 'body',
        rule: `Keep under ${AGENT_SKILLS_SPEC.body.recommendedMaxLines} lines (move detailed content to references/)`,
        actual: `${lines} lines`,
        severity: 'warning'
      });
    }
  }
}

// ============================================================================
// Quality Evaluator Interface (Flexible)
// ============================================================================

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

/**
 * A simple heuristic evaluator that only makes OBJECTIVE observations,
 * not subjective quality judgments.
 */
export class ObjectiveMetricsEvaluator implements QualityEvaluator {
  name = 'objective-metrics';

  async evaluate(skill: RawSkill): Promise<QualityEvaluation> {
    const observations: string[] = [];
    
    // Objective facts only - no quality judgments
    const wordCount = skill.content.split(/\s+/).length;
    observations.push(`Word count: ${wordCount}`);
    
    const lineCount = skill.content.split('\n').length;
    observations.push(`Line count: ${lineCount}`);
    
    const headingCount = (skill.content.match(/^#{1,6}\s+/gm) || []).length;
    observations.push(`Section headings: ${headingCount}`);
    
    const codeBlockCount = (skill.content.match(/```/g) || []).length / 2;
    observations.push(`Code blocks: ${Math.floor(codeBlockCount)}`);
    
    const hasExamples = /example|e\.g\.|for instance/i.test(skill.content);
    observations.push(`Contains examples: ${hasExamples}`);
    
    const hasSteps = /^\s*\d+\.\s+/m.test(skill.content) || /^[-*]\s+/m.test(skill.content);
    observations.push(`Contains steps/lists: ${hasSteps}`);
    
    // Resource availability
    if (skill.hasScriptsDir) observations.push('Has scripts/ directory');
    if (skill.hasReferencesDir) observations.push('Has references/ directory');
    if (skill.hasAssetsDir) observations.push('Has assets/ directory');

    return {
      evaluator: this.name,
      evaluatedAt: new Date().toISOString(),
      observations
      // Note: No scores - this evaluator only reports facts
    };
  }
}

/**
 * LLM-based evaluator stub - actual implementation would call an LLM API
 */
export class LLMQualityEvaluator implements QualityEvaluator {
  name = 'llm-evaluator';
  
  constructor(
    private apiEndpoint?: string,
    private model?: string
  ) {}

  async evaluate(skill: RawSkill): Promise<QualityEvaluation> {
    // This is a stub - real implementation would:
    // 1. Send skill content to LLM
    // 2. Ask for quality assessment with reasoning
    // 3. Parse structured response
    
    if (!this.apiEndpoint) {
      return {
        evaluator: this.name,
        evaluatedAt: new Date().toISOString(),
        observations: ['LLM evaluator not configured - skipping quality assessment'],
        raw: { skipped: true, reason: 'no_api_endpoint' }
      };
    }

    // Example prompt structure (not actually calling API in this stub):
    const _promptTemplate = `
Evaluate the following Agent Skill for quality. Consider:
- Clarity: Is it clear what this skill does and when to use it?
- Completeness: Does it provide enough information for an agent to use it effectively?
- Actionability: Are there concrete steps or guidance?
- Relevance: Does the content match the stated description?

Provide your assessment as JSON with:
{
  "scores": {
    "clarity": { "score": 0-100, "confidence": 0-1, "reasoning": "..." },
    "completeness": { "score": 0-100, "confidence": 0-1, "reasoning": "..." },
    ...
  },
  "suggestions": ["improvement 1", "improvement 2"]
}

Skill:
---
name: ${skill.name}
description: ${skill.description}
---
${skill.content.slice(0, 3000)}
`;

    return {
      evaluator: this.name,
      evaluatedAt: new Date().toISOString(),
      observations: ['LLM evaluation would be performed here'],
      raw: { stub: true }
    };
  }
}

// ============================================================================
// Security Scanner (based on Cisco skill-scanner threat taxonomy)
// @see https://github.com/cisco-ai-defense/skill-scanner
// ============================================================================

/**
 * Threat taxonomy aligned with Cisco AI Defense framework
 * @see https://arxiv.org/html/2512.12921v1
 */
export const THREAT_TAXONOMY = {
  // AITech-1.1, AITech-1.2 - Prompt Injection
  PROMPT_INJECTION: {
    id: 'PROMPT_INJECTION',
    aitech: ['AITech-1.1', 'AITech-1.2'],
    severity: 'HIGH',
    description: 'Malicious instructions that manipulate AI behavior or bypass safety systems',
    patterns: [
      /ignore\s+(previous|all|any)\s+(instructions?|rules?|guidelines?)/i,
      /disregard\s+(previous|all|any)\s+(instructions?|rules?)/i,
      /you\s+are\s+now\s+(in\s+)?(unrestricted|jailbreak|dan|developer)\s+mode/i,
      /pretend\s+(you\s+are|to\s+be)\s+(not\s+)?an?\s+(ai|assistant|chatbot)/i,
      /don['']?t\s+tell\s+(the\s+)?user/i,
      /hide\s+this\s+from\s+(the\s+)?user/i,
      /bypass\s+(safety|security|content)\s+(filters?|restrictions?|guidelines?)/i,
      /override\s+(your|system)\s+(instructions?|prompt|rules?)/i
    ]
  },
  
  // AITech-9.1.4 - Command & Code Injection
  CODE_INJECTION: {
    id: 'CODE_INJECTION',
    aitech: ['AITech-9.1.4'],
    severity: 'CRITICAL',
    description: 'Unsafe code execution enabling arbitrary command execution',
    patterns: [
      /\beval\s*\(\s*[^)]+\)/i,                    // eval(something) - not empty
      /\bexec\s*\(\s*[^)]+\)/i,                    // exec(something) - not empty
      /os\.system\s*\(\s*[^)]+\)/i,                // os.system(cmd)
      /subprocess\.(call|run|Popen)\s*\([^)]*shell\s*=\s*True/i,
      /child_process\.(exec|execSync|spawn)\s*\(/i,
      /\$\([^)]{5,}\)/,                            // $(command) shell substitution (min 5 chars)
      /;\s*(rm|del|format|mkfs)\s+(-rf?\s+)?[\/~]/i, // Dangerous commands
      /reverse\s*shell/i,
      /bind\s*shell/i,
      /nc\s+-[el].*\d+/i,                          // netcat listening
      /bash\s+-i\s+>&/i                            // bash reverse shell
    ]
  },
  
  // AITech-8.2, AITech-8.2.3 - Data Exfiltration
  DATA_EXFILTRATION: {
    id: 'DATA_EXFILTRATION',
    aitech: ['AITech-8.2', 'AITech-8.2.3'],
    severity: 'CRITICAL',
    description: 'Unauthorized data access and transmission to external locations',
    patterns: [
      /~\/\.aws/,
      /~\/\.ssh/,
      /~\/\.config/,
      /~\/\.env/,
      /process\.env\[/,
      /os\.environ/i,
      /getenv\s*\(/i,
      /\b(api[_-]?key|secret[_-]?key|password|token|credential)s?\b/i,
      /curl\s+.*-d.*\$|wget\s+.*--post-data/i,
      /requests?\.(post|put)\s*\([^)]*env/i
    ]
  },
  
  // AITech-8.2 - Hardcoded Secrets
  HARDCODED_SECRETS: {
    id: 'HARDCODED_SECRETS',
    aitech: ['AITech-8.2'],
    severity: 'CRITICAL',
    description: 'Credentials embedded in code files',
    patterns: [
      /AKIA[0-9A-Z]{16}/,                    // AWS Access Key
      /ghp_[a-zA-Z0-9]{36}/,                 // GitHub Personal Access Token
      /sk-proj-[a-zA-Z0-9]{48}/,             // OpenAI API Key
      /sk-[a-zA-Z0-9]{48}/,                  // OpenAI Legacy Key
      /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/, // Slack Token
      /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
      /eyJ[a-zA-Z0-9]{10,}\.eyJ[a-zA-Z0-9]{10,}\.[a-zA-Z0-9_-]{10,}/, // JWT
      /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/i,   // MongoDB connection string with creds
      /postgres:\/\/[^:]+:[^@]+@/i           // PostgreSQL connection string
    ]
  },
  
  // AITech-12.1 - Tool & Permission Abuse
  TOOL_ABUSE: {
    id: 'TOOL_ABUSE',
    aitech: ['AITech-12.1'],
    severity: 'HIGH',
    description: 'Violating allowed-tools restrictions or undeclared capabilities',
    patterns: [
      /install\s+(packages?|dependencies|modules?)/i,
      /pip\s+install/i,
      /npm\s+install/i,
      /apt(-get)?\s+install/i,
      /brew\s+install/i,
      /chmod\s+[0-7]{3,4}/,
      /chown\s+/i,
      /sudo\s+/i,
      /su\s+-/i,
      /modify\s+(system|kernel|boot)/i
    ]
  },
  
  // Obfuscation
  OBFUSCATION: {
    id: 'OBFUSCATION',
    aitech: [],
    severity: 'HIGH',
    description: 'Deliberate code obfuscation hiding malicious intent',
    patterns: [
      /base64\.(b64)?decode\s*\(\s*['"]/i,
      /atob\s*\(/i,
      /Buffer\.from\s*\([^)]+,\s*['"]base64['"]\)/i,
      /\\x[0-9a-f]{2}\\x[0-9a-f]{2}/i,      // Hex encoded strings
      /fromCharCode\s*\(\s*\d+\s*(,\s*\d+\s*){5,}\)/i,
      /\.encode\(['"]rot13['"]\)/i
    ]
  },
  
  // AITech-2.1 - Social Engineering
  SOCIAL_ENGINEERING: {
    id: 'SOCIAL_ENGINEERING',
    aitech: ['AITech-2.1'],
    severity: 'MEDIUM',
    description: 'Misrepresentation, impersonation, or deceptive metadata',
    patterns: [
      /official\s+(openai|anthropic|google|microsoft)\s+skill/i,
      /verified\s+by\s+(openai|anthropic|google)/i,
      /certified\s+(ai|agent)\s+skill/i,
      /guaranteed\s+(safe|secure|trusted)/i,
      /100%\s+(safe|secure|tested)/i
    ]
  },
  
  // AITech-1.2 - Transitive Trust
  TRANSITIVE_TRUST: {
    id: 'TRANSITIVE_TRUST',
    aitech: ['AITech-1.2'],
    severity: 'HIGH',
    description: 'Delegating trust to untrusted external content',
    patterns: [
      /follow\s+(the\s+)?(instructions|commands)\s+(from|on|in)\s+(the\s+)?(webpage|url|link|file)/i,
      /execute\s+(the\s+)?(code|script|commands?)\s+(from|found|in)/i,
      /obey\s+(the\s+)?(file|content|instructions)/i,
      /do\s+what(ever)?\s+(the\s+)?(url|webpage|file)\s+(says|tells)/i,
      /load\s+and\s+(run|execute)\s+from\s+(remote|external|url)/i
    ]
  },
  
  // AITech-9.1 - Autonomy Abuse
  AUTONOMY_ABUSE: {
    id: 'AUTONOMY_ABUSE',
    aitech: ['AITech-9.1'],
    severity: 'MEDIUM',
    description: 'Excessive autonomous behavior without user confirmation',
    patterns: [
      /keep\s+(trying|retrying)\s+(forever|indefinitely|until)/i,
      /run\s+without\s+(asking|confirmation|approval)/i,
      /ignore\s+(all\s+)?errors?\s+and\s+continue/i,
      /auto(matically)?\s+(approve|confirm|accept)\s+all/i,
      /never\s+ask\s+(for\s+)?(confirmation|permission|approval)/i,
      /modify\s+(yourself|your\s+own\s+code|self)/i
    ]
  },
  
  // AITech-8.2.3 - Tool Chaining
  TOOL_CHAINING: {
    id: 'TOOL_CHAINING',
    aitech: ['AITech-8.2.3'],
    severity: 'HIGH',
    description: 'Multi-step operations chaining tools for data exfiltration',
    patterns: [
      /read\s+.*then\s+.*send/i,
      /collect\s+.*and\s+.*post/i,
      /gather\s+.*upload/i,
      /export\s+.*to\s+.*external/i,
      /pipe\s+.*to\s+.*remote/i
    ]
  },
  
  // AITech-13.3.2 - Resource Abuse
  RESOURCE_ABUSE: {
    id: 'RESOURCE_ABUSE',
    aitech: ['AITech-13.3.2'],
    severity: 'MEDIUM',
    description: 'Excessive resource consumption causing instability',
    patterns: [
      /while\s*\(\s*true\s*\)/i,
      /for\s*\(\s*;;\s*\)/,
      /fork\s*\(\s*\)/i,
      /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/,      // Fork bomb
      /Array\s*\(\s*\d{9,}\s*\)/i,           // Large array allocation
      /repeat\s+forever/i
    ]
  }
} as const;

export type ThreatCategory = keyof typeof THREAT_TAXONOMY;
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';

export interface SecurityFinding {
  category: ThreatCategory;
  aitech: string[];
  severity: Severity;
  description: string;
  match: string;
  location: string;           // Where in the content (line number or context)
  confidence: number;         // 0-1, how confident is this detection
}

export interface SecurityScanResult {
  isSecure: boolean;
  maxSeverity: Severity;
  findings: SecurityFinding[];
  scanDuration: number;
}

/**
 * Security scanner implementing Cisco skill-scanner threat taxonomy
 * Uses pattern-based detection for deterministic results
 */
export class SecurityScanner implements QualityEvaluator {
  name = 'security-scanner';

  async evaluate(skill: RawSkill): Promise<QualityEvaluation> {
    const result = this.scan(skill);
    
    const observations: string[] = [
      `Security Status: ${result.isSecure ? 'SECURE' : 'ISSUES FOUND'}`,
      `Max Severity: ${result.maxSeverity}`,
      `Total Findings: ${result.findings.length}`,
      `Scan Duration: ${result.scanDuration}ms`
    ];

    // Group findings by category
    const byCategory = new Map<ThreatCategory, SecurityFinding[]>();
    for (const finding of result.findings) {
      const list = byCategory.get(finding.category) || [];
      list.push(finding);
      byCategory.set(finding.category, list);
    }

    for (const [category, findings] of byCategory) {
      observations.push(`${category}: ${findings.length} finding(s)`);
    }

    const suggestions: string[] = [];
    if (!result.isSecure) {
      for (const finding of result.findings.slice(0, 5)) {
        suggestions.push(`[${finding.severity}] ${finding.description}: "${finding.match.slice(0, 50)}..."`);
      }
    }

    return {
      evaluator: this.name,
      evaluatedAt: new Date().toISOString(),
      scores: {
        security: {
          score: result.isSecure ? 100 : Math.max(0, 100 - result.findings.length * 20),
          confidence: 0.8,
          reasoning: result.isSecure 
            ? 'No security threats detected by pattern-based scanner'
            : `Found ${result.findings.length} potential security issues`
        }
      },
      observations,
      suggestions,
      raw: result
    };
  }

  scan(skill: RawSkill): SecurityScanResult {
    const startTime = Date.now();
    const findings: SecurityFinding[] = [];
    const content = skill.content + '\n' + skill.description;
    const lines = content.split('\n');

    // Scan each threat category
    for (const [category, threat] of Object.entries(THREAT_TAXONOMY)) {
      for (const pattern of threat.patterns) {
        // Search line by line for better location reporting
        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(pattern);
          if (match) {
            findings.push({
              category: category as ThreatCategory,
              aitech: [...threat.aitech],
              severity: threat.severity as Severity,
              description: threat.description,
              match: match[0],
              location: `Line ${i + 1}`,
              confidence: 0.7  // Pattern-based detection has moderate confidence
            });
          }
        }
      }
    }

    // Deduplicate findings (same match at same location)
    const unique = new Map<string, SecurityFinding>();
    for (const f of findings) {
      const key = `${f.category}:${f.location}:${f.match}`;
      if (!unique.has(key)) {
        unique.set(key, f);
      }
    }

    const uniqueFindings = [...unique.values()];
    
    // Calculate max severity
    const severityOrder: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'SAFE'];
    let maxSeverity: Severity = 'SAFE';
    for (const f of uniqueFindings) {
      if (severityOrder.indexOf(f.severity) < severityOrder.indexOf(maxSeverity)) {
        maxSeverity = f.severity;
      }
    }

    return {
      isSecure: uniqueFindings.length === 0,
      maxSeverity,
      findings: uniqueFindings,
      scanDuration: Date.now() - startTime
    };
  }
}

// ============================================================================
// Dependency Validator (based on scalble_skills RFC)
// @see https://github.com/AndoSan84/scalble_skills
// ============================================================================

export interface DependencyInfo {
  skill: string;
  version?: string;
}

export interface DependencyValidationResult {
  hasDependencies: boolean;
  dependencies: DependencyInfo[];
  hasCircularRisk: boolean;      // Can't fully detect without all skills
  hasVersionConstraints: boolean;
  issues: string[];
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

/**
 * Validates skill dependencies and test definitions
 * Based on scalble_skills RFC-001-dependencies-testing
 */
export class DependencyValidator implements QualityEvaluator {
  name = 'dependency-validator';

  async evaluate(skill: RawSkill): Promise<QualityEvaluation> {
    const depResult = this.validateDependencies(skill);
    const testResult = this.validateTests(skill);
    
    const observations: string[] = [];
    
    // Dependency observations
    if (depResult.hasDependencies) {
      observations.push(`Dependencies declared: ${depResult.dependencies.length}`);
      for (const dep of depResult.dependencies) {
        observations.push(`  - ${dep.skill}${dep.version ? `@${dep.version}` : ''}`);
      }
      if (depResult.hasVersionConstraints) {
        observations.push('Has version constraints (good for stability)');
      }
    } else {
      observations.push('No dependencies declared');
    }
    
    // Test observations
    if (testResult.hasTests) {
      observations.push(`Test cases defined: ${testResult.cases.length}`);
      const assertionTypes = new Set(testResult.cases.flatMap(c => c.assertionTypes));
      if (assertionTypes.size > 0) {
        observations.push(`Assertion types: ${[...assertionTypes].join(', ')}`);
      }
    } else {
      observations.push('No tests defined');
    }

    const suggestions: string[] = [
      ...depResult.issues,
      ...testResult.issues
    ];

    return {
      evaluator: this.name,
      evaluatedAt: new Date().toISOString(),
      observations,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      raw: { dependencies: depResult, tests: testResult }
    };
  }

  validateDependencies(skill: RawSkill): DependencyValidationResult {
    const requires = skill.frontmatter.requires as Array<{skill: string; version?: string}> | undefined;
    
    if (!requires || !Array.isArray(requires)) {
      return {
        hasDependencies: false,
        dependencies: [],
        hasCircularRisk: false,
        hasVersionConstraints: false,
        issues: []
      };
    }

    const dependencies: DependencyInfo[] = [];
    const issues: string[] = [];
    let hasVersionConstraints = false;

    for (const req of requires) {
      if (typeof req === 'object' && req.skill) {
        dependencies.push({
          skill: req.skill,
          version: req.version
        });
        if (req.version) {
          hasVersionConstraints = true;
          // Validate version format (SemVer)
          if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/.test(req.version)) {
            issues.push(`Invalid version format for ${req.skill}: ${req.version} (expected SemVer)`);
          }
        }
      }
    }

    return {
      hasDependencies: dependencies.length > 0,
      dependencies,
      hasCircularRisk: false,  // Would need full skill graph to detect
      hasVersionConstraints,
      issues
    };
  }

  validateTests(skill: RawSkill): TestValidationResult {
    const test = skill.frontmatter.test as {
      cases?: string;
      config?: { timeout?: number; parallel?: boolean };
    } | undefined;

    if (!test) {
      return {
        hasTests: false,
        cases: [],
        issues: ['Consider adding tests for better reliability (RFC-001)']
      };
    }

    const issues: string[] = [];
    const cases: TestCaseInfo[] = [];

    // Check if cases path is specified
    if (!test.cases) {
      issues.push('test.cases path not specified');
    }

    // We can't actually read the test file, but we note its path
    return {
      hasTests: !!test.cases,
      testCasesPath: test.cases,
      testConfig: test.config,
      cases,  // Would be populated if we could read the cases file
      issues
    };
  }
}

// ============================================================================
// Semantic Extractor (Extraction, not evaluation)
// ============================================================================

export class SemanticExtractor {
  /**
   * Extract semantic information from skill content.
   * This is EXTRACTION, not quality judgment.
   */
  extract(skill: RawSkill): SemanticInfo {
    return {
      technologies: this.extractTechnologies(skill.content),
      domains: this.extractDomains(skill),
      triggerKeywords: this.extractTriggerKeywords(skill),
      referencedFiles: this.extractFileReferences(skill.content)
    };
  }

  private extractTechnologies(content: string): string[] {
    // Look for explicit technology mentions
    const techPatterns = [
      /\b(react|vue|angular|svelte|next\.?js|nuxt)\b/gi,
      /\b(node\.?js|express|fastify|deno|bun)\b/gi,
      /\b(python|django|fastapi|flask)\b/gi,
      /\b(typescript|javascript|go|rust|java|kotlin|ruby|php)\b/gi,
      /\b(postgres|postgresql|mysql|mongodb|redis|sqlite)\b/gi,
      /\b(docker|kubernetes|terraform|aws|azure|gcp)\b/gi,
      /\b(git|github|gitlab|bitbucket)\b/gi
    ];

    const found = new Set<string>();
    for (const pattern of techPatterns) {
      const matches = content.match(pattern) || [];
      for (const match of matches) {
        found.add(match.toLowerCase());
      }
    }

    return [...found];
  }

  private extractDomains(skill: RawSkill): string[] {
    const domains: string[] = [];
    const content = (skill.description + ' ' + skill.content).toLowerCase();

    // Domain detection based on content themes
    const domainIndicators: Record<string, string[]> = {
      'web-development': ['frontend', 'backend', 'web', 'api', 'rest', 'graphql', 'html', 'css'],
      'mobile-development': ['mobile', 'ios', 'android', 'react native', 'flutter', 'expo'],
      'data-science': ['data', 'analytics', 'machine learning', 'ml', 'ai', 'pandas', 'numpy'],
      'devops': ['deploy', 'ci/cd', 'infrastructure', 'container', 'pipeline', 'kubernetes'],
      'testing': ['test', 'spec', 'e2e', 'unit test', 'integration', 'coverage'],
      'documentation': ['docs', 'documentation', 'readme', 'api docs', 'guide'],
      'security': ['security', 'auth', 'vulnerability', 'encryption', 'oauth']
    };

    for (const [domain, indicators] of Object.entries(domainIndicators)) {
      for (const indicator of indicators) {
        if (content.includes(indicator)) {
          domains.push(domain);
          break;
        }
      }
    }

    return [...new Set(domains)];
  }

  private extractTriggerKeywords(skill: RawSkill): string[] {
    // Extract words from description that might trigger skill selection
    const description = skill.description.toLowerCase();
    
    // Action words and nouns that indicate when to use this skill
    const words = description.match(/\b[a-z]{4,}\b/g) || [];
    
    const stopWords = new Set([
      'this', 'that', 'with', 'from', 'have', 'will', 'your', 'when', 'what',
      'where', 'which', 'while', 'about', 'after', 'before', 'should', 'would',
      'could', 'being', 'their', 'there', 'these', 'those', 'other', 'more',
      'some', 'such', 'only', 'then', 'than', 'also', 'into', 'does', 'doing'
    ]);

    return words
      .filter(w => !stopWords.has(w))
      .slice(0, 15);
  }

  private extractFileReferences(content: string): string[] {
    // Extract referenced files (scripts, references, assets)
    const filePatterns = [
      /scripts\/[\w\-./]+/g,
      /references\/[\w\-./]+/g,
      /assets\/[\w\-./]+/g,
      /`([^`]+\.(py|js|ts|sh|md|json|yaml))`/g
    ];

    const files = new Set<string>();
    for (const pattern of filePatterns) {
      const matches = content.match(pattern) || [];
      for (const match of matches) {
        files.add(match.replace(/`/g, ''));
      }
    }

    return [...files];
  }
}

// ============================================================================
// Duplicate Detector
// ============================================================================

export class DuplicateDetector {
  private readonly SIMILARITY_THRESHOLD = 0.75;

  detectDuplicates(skills: RawSkill[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < skills.length; i++) {
      if (processed.has(skills[i].name)) continue;

      const similar: string[] = [];
      let maxSimilarity = 0;

      for (let j = i + 1; j < skills.length; j++) {
        if (processed.has(skills[j].name)) continue;

        const similarity = this.calculateSimilarity(skills[i], skills[j]);
        if (similarity >= this.SIMILARITY_THRESHOLD) {
          similar.push(skills[j].name);
          processed.add(skills[j].name);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }
      }

      if (similar.length > 0) {
        const allInGroup = [skills[i], ...skills.filter(s => similar.includes(s.name))];
        const canonical = this.selectCanonical(allInGroup);

        groups.push({
          canonical: canonical.name,
          duplicates: allInGroup.filter(s => s.name !== canonical.name).map(s => s.name),
          similarity: maxSimilarity,
          method: 'content-similarity'
        });

        processed.add(skills[i].name);
      }
    }

    return groups;
  }

  private calculateSimilarity(a: RawSkill, b: RawSkill): number {
    // Combine multiple signals
    const nameSim = this.jaccardSimilarity(
      this.tokenize(a.name),
      this.tokenize(b.name)
    );
    
    const descSim = this.jaccardSimilarity(
      this.tokenize(a.description),
      this.tokenize(b.description)
    );
    
    const contentSim = this.jaccardSimilarity(
      this.tokenize(a.content),
      this.tokenize(b.content)
    );

    // Weight content most heavily
    return nameSim * 0.2 + descSim * 0.3 + contentSim * 0.5;
  }

  private tokenize(text: string): Set<string> {
    const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    return new Set(words);
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter(x => b.has(x)));
    const union = new Set([...a, ...b]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  private selectCanonical(skills: RawSkill[]): RawSkill {
    // Prefer: lower priority source (more trusted), then longer content
    return skills.sort((a, b) => {
      if (a.source.priority !== b.source.priority) {
        return a.source.priority - b.source.priority;
      }
      return b.content.length - a.content.length;
    })[0];
  }
}

// ============================================================================
// Circular Dependency Detector (based on scalble_skills RFC)
// @see https://github.com/AndoSan84/scalble_skills/blob/main/skills_ref/skills_ref.py
// ============================================================================

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

/**
 * Detects circular dependencies using DFS algorithm
 * Port of detect_circular_dependencies from skills_ref.py
 */
export class CircularDependencyDetector {
  /**
   * Build a dependency graph from a collection of skills
   */
  buildGraph(skills: RawSkill[]): DependencyGraph {
    const graph: DependencyGraph = {};
    
    for (const skill of skills) {
      const requires = skill.frontmatter.requires as Array<{skill: string; version?: string}> | undefined;
      const deps: string[] = [];
      
      if (requires && Array.isArray(requires)) {
        for (const req of requires) {
          if (typeof req === 'object' && req.skill) {
            deps.push(req.skill);
          }
        }
      }
      
      const metadata = skill.frontmatter.metadata as {version?: string} | undefined;
      graph[skill.name] = {
        version: metadata?.version,
        requires: deps
      };
    }
    
    return graph;
  }

  /**
   * Detect circular dependencies using depth-first search
   * Returns all cycles found in the dependency graph
   */
  detectCycles(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack: string[] = [];
    
    const dfs = (node: string): void => {
      // Check if we've found a cycle
      const cycleStart = recStack.indexOf(node);
      if (cycleStart !== -1) {
        // Extract the cycle
        const cycle = [...recStack.slice(cycleStart), node];
        cycles.push(cycle);
        return;
      }
      
      if (visited.has(node)) {
        return;
      }
      
      visited.add(node);
      recStack.push(node);
      
      const neighbors = graph[node]?.requires || [];
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }
      
      recStack.pop();
    };
    
    // Run DFS from each node
    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }
    
    return cycles;
  }

  /**
   * Full circular dependency check
   */
  check(skills: RawSkill[]): CircularDependencyResult {
    const graph = this.buildGraph(skills);
    const cycles = this.detectCycles(graph);
    
    return {
      hasCircular: cycles.length > 0,
      cycles,
      graph
    };
  }

  /**
   * Check if a specific skill is involved in any circular dependency
   */
  isInCycle(skillName: string, cycles: string[][]): boolean {
    return cycles.some(cycle => cycle.includes(skillName));
  }
}

// ============================================================================
// Test Runner (based on scalble_skills RFC)
// @see https://github.com/AndoSan84/scalble_skills/blob/main/skills_ref/skills_ref.py
// ============================================================================

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

/**
 * Test runner for skill test cases
 * Evaluates assertions against agent output
 */
export class SkillTestRunner {
  /**
   * Evaluate assertions against output
   * Returns [passed, errors]
   */
  evaluateAssertions(output: string, assertions: TestAssertion): [boolean, string[]] {
    const errors: string[] = [];
    const outputLower = output.toLowerCase();
    
    // output_contains - check if output contains expected strings
    if (assertions.output_contains) {
      for (const expected of assertions.output_contains) {
        if (!outputLower.includes(expected.toLowerCase())) {
          errors.push(`output_contains: '${expected}' not found in output`);
        }
      }
    }
    
    // output_not_contains - check output doesn't contain forbidden strings
    if (assertions.output_not_contains) {
      for (const forbidden of assertions.output_not_contains) {
        if (outputLower.includes(forbidden.toLowerCase())) {
          errors.push(`output_not_contains: '${forbidden}' found in output`);
        }
      }
    }
    
    // output_matches - check regex patterns
    if (assertions.output_matches) {
      for (const pattern of assertions.output_matches) {
        try {
          const regex = new RegExp(pattern, 'i');
          if (!regex.test(output)) {
            errors.push(`output_matches: pattern '${pattern}' not matched`);
          }
        } catch (e) {
          errors.push(`output_matches: invalid regex '${pattern}'`);
        }
      }
    }
    
    // semantic_match - requires LLM judge (placeholder)
    if (assertions.semantic_match) {
      // This would call an LLM API to judge semantic equivalence
      // For now, we note it needs manual verification
      console.log(`    ⚠ semantic_match requires LLM judge: '${assertions.semantic_match.criterion}'`);
    }
    
    return [errors.length === 0, errors];
  }

  /**
   * Run a single test case
   * agentRunner: async function that takes (skillContent, input) and returns output
   */
  async runTestCase(
    testCase: SkillTestCase,
    skillContent: string,
    agentRunner?: (skillContent: string, input: string) => Promise<string>
  ): Promise<TestCaseResult> {
    const startTime = Date.now();
    
    if (!agentRunner) {
      return {
        name: testCase.name,
        passed: true,
        errors: [],
        duration: Date.now() - startTime,
        output: '(no agent runner configured, skipping execution)'
      };
    }
    
    try {
      const output = await agentRunner(skillContent, testCase.input);
      const [passed, errors] = this.evaluateAssertions(output, testCase.assertions);
      
      return {
        name: testCase.name,
        passed,
        errors,
        duration: Date.now() - startTime,
        output
      };
    } catch (e) {
      return {
        name: testCase.name,
        passed: false,
        errors: [`Execution error: ${e instanceof Error ? e.message : String(e)}`],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Run all test cases for a skill
   */
  async runTests(
    skillName: string,
    skillContent: string,
    testCases: SkillTestCase[],
    agentRunner?: (skillContent: string, input: string) => Promise<string>
  ): Promise<TestRunResult> {
    const startTime = Date.now();
    const results: TestCaseResult[] = [];
    let passed = 0;
    
    console.log(`\nRunning ${testCases.length} test(s) for '${skillName}':\n`);
    
    for (const testCase of testCases) {
      const desc = testCase.description ? ` - ${testCase.description}` : '';
      console.log(`  [${testCase.name}]${desc}`);
      
      const result = await this.runTestCase(testCase, skillContent, agentRunner);
      results.push(result);
      
      if (result.passed) {
        console.log(`    ✓ PASSED`);
        passed++;
      } else {
        console.log(`    ✗ FAILED`);
        for (const err of result.errors) {
          console.log(`      - ${err}`);
        }
      }
    }
    
    console.log(`\nResults: ${passed}/${testCases.length} passed`);
    
    return {
      skillName,
      passed,
      total: testCases.length,
      results,
      duration: Date.now() - startTime
    };
  }

  /**
   * Parse test cases from YAML content
   */
  parseTestCases(yamlContent: string): SkillTestCase[] {
    // Simple YAML-like parser for test cases
    // In production, use a proper YAML library
    const cases: SkillTestCase[] = [];
    
    // Match case blocks
    const caseRegex = /-\s*name:\s*(.+?)(?:\n\s+description:\s*(.+?))?(?:\n\s+input:\s*["'](.+?)["'])?\n\s+assertions:/gs;
    
    // This is a simplified parser - production should use yaml library
    try {
      // If yamlContent looks like JSON, try parsing it
      if (yamlContent.trim().startsWith('{') || yamlContent.trim().startsWith('[')) {
        const parsed = JSON.parse(yamlContent);
        if (parsed.cases && Array.isArray(parsed.cases)) {
          return parsed.cases as SkillTestCase[];
        }
      }
    } catch {
      // Not JSON, continue with basic parsing
    }
    
    return cases;
  }
}

// ============================================================================
// Skill Scaffolder (based on scalble_skills init command)
// @see https://github.com/AndoSan84/scalble_skills/blob/main/skills_ref/skills_ref.py
// ============================================================================

export interface ScaffoldOptions {
  name: string;
  description?: string;
  version?: string;
  availableSkills?: Array<{name: string; version?: string}>;
  includeTests?: boolean;
  includeScripts?: boolean;
  includeReferences?: boolean;
}

export interface ScaffoldResult {
  skillMd: string;
  testCasesYaml?: string;
  directories: string[];
}

/**
 * Scaffolds new skill structures following Agent Skills spec
 */
export class SkillScaffolder {
  /**
   * Generate a new SKILL.md template
   */
  scaffold(options: ScaffoldOptions): ScaffoldResult {
    const {
      name,
      description = 'TODO - Describe what this skill does and when to use it.',
      version = '1.0.0',
      availableSkills = [],
      includeTests = true,
      includeScripts = false,
      includeReferences = false
    } = options;
    
    // Build requires block if skills are available
    let requiresBlock = '';
    if (availableSkills.length > 0) {
      const requiresLines = ['requires:'];
      for (const skill of availableSkills) {
        requiresLines.push(`  - skill: ${skill.name}`);
        if (skill.version) {
          requiresLines.push(`    version: "${skill.version}"`);
        }
      }
      requiresBlock = '\n' + requiresLines.join('\n');
    }
    
    // Build test block
    const testBlock = includeTests ? `
test:
  cases: test/cases.yaml
  config:
    timeout: 60` : '';
    
    const skillMd = `---
name: ${name}
description: ${description}

metadata:
  version: "${version}"
${requiresBlock}${testBlock}
---

# ${name}

## Instructions

TODO - Add skill instructions here.

### When to Use This Skill

- TODO - Describe scenarios when this skill should be activated

### Step-by-Step Guide

1. TODO - First step
2. TODO - Second step
3. TODO - Third step

## Examples

### Example 1: Basic Usage

\`\`\`
TODO - Add example input/output here
\`\`\`

## Edge Cases

- TODO - Handle edge case 1
- TODO - Handle edge case 2

## References

${includeReferences ? 'See [references/REFERENCE.md](references/REFERENCE.md) for detailed documentation.' : 'TODO - Add references if needed'}
`;

    // Generate test cases template
    let testCasesYaml: string | undefined;
    if (includeTests) {
      testCasesYaml = `# Test cases for ${name}
# @see https://agentskills.io/specification#testing

cases:
  - name: basic_test
    description: TODO - Describe what this test verifies
    input: "TODO - The prompt to send"
    assertions:
      output_contains:
        - "expected text"
      output_not_contains:
        - "error"
        - "failed"

  - name: edge_case_test
    description: TODO - Test edge case handling
    input: "TODO - Edge case input"
    assertions:
      output_matches:
        - "pattern.*to.*match"
`;
    }
    
    // Determine directories to create
    const directories: string[] = [];
    if (includeTests) directories.push('test');
    if (includeScripts) directories.push('scripts');
    if (includeReferences) directories.push('references');
    
    return {
      skillMd,
      testCasesYaml,
      directories
    };
  }

  /**
   * Validate a skill name follows spec requirements
   */
  validateName(name: string): {valid: boolean; errors: string[]} {
    const errors: string[] = [];
    
    if (!name) {
      errors.push('Name is required');
      return {valid: false, errors};
    }
    
    if (name.length > 64) {
      errors.push(`Name must be 1-64 characters (got ${name.length})`);
    }
    
    if (!AGENT_SKILLS_SPEC.name.pattern.test(name)) {
      errors.push('Name may only contain lowercase alphanumeric characters and hyphens');
    }
    
    if (name.startsWith('-') || name.endsWith('-')) {
      errors.push('Name must not start or end with hyphen');
    }
    
    if (name.includes('--')) {
      errors.push('Name must not contain consecutive hyphens');
    }
    
    return {valid: errors.length === 0, errors};
  }
}

// ============================================================================
// Main Pipeline
// ============================================================================

export interface PipelineOptions {
  evaluators?: QualityEvaluator[];
  skipEvaluation?: boolean;
  enableSecurityScan?: boolean;
  enableDependencyValidation?: boolean;
  enableCircularDependencyCheck?: boolean;
}

export class SkillIntelligencePipeline {
  readonly ANALYSIS_VERSION = '2.2.0';  // Updated for circular deps, test runner, scaffolder
  readonly SPEC_VERSION = '1.1'; // Agent Skills spec version (with dependencies/testing)
  
  private specValidator = new SpecValidator();
  private semanticExtractor = new SemanticExtractor();
  private duplicateDetector = new DuplicateDetector();
  private circularDepDetector = new CircularDependencyDetector();
  private evaluators: QualityEvaluator[];

  constructor(options: PipelineOptions = {}) {
    const defaultEvaluators: QualityEvaluator[] = [
      new ObjectiveMetricsEvaluator()
    ];
    
    // Add security scanner by default (can be disabled)
    if (options.enableSecurityScan !== false) {
      defaultEvaluators.push(new SecurityScanner());
    }
    
    // Add dependency validator by default (can be disabled)
    if (options.enableDependencyValidation !== false) {
      defaultEvaluators.push(new DependencyValidator());
    }
    
    this.evaluators = options.evaluators || defaultEvaluators;
  }

  async analyze(skills: RawSkill[]): Promise<IntelligenceCatalog> {
    console.log(`\nAnalyzing ${skills.length} skills...`);

    // Step 1: Detect duplicates
    console.log('→ Detecting duplicates...');
    const duplicateGroups = this.duplicateDetector.detectDuplicates(skills);
    const duplicateMap = new Map<string, string>();
    for (const group of duplicateGroups) {
      for (const dup of group.duplicates) {
        duplicateMap.set(dup, group.canonical);
      }
    }

    // Step 1.5: Check for circular dependencies
    console.log('→ Checking for circular dependencies...');
    const circularResult = this.circularDepDetector.check(skills);
    if (circularResult.hasCircular) {
      console.log(`  ⚠ Found ${circularResult.cycles.length} circular dependency chain(s)`);
      for (const cycle of circularResult.cycles) {
        console.log(`    ${cycle.join(' → ')}`);
      }
    }

    // Step 2: Process each skill
    console.log('→ Validating spec compliance...');
    console.log('→ Extracting semantics...');
    console.log('→ Running evaluators...');
    
    const enrichedSkills: EnrichedSkill[] = [];
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
      
      if (specCompliance.isValid) specCompliantCount++;

      // Semantic extraction
      const semantics = this.semanticExtractor.extract(skill);

      // Quality evaluations (flexible)
      const qualityEvaluations: QualityEvaluation[] = [];
      for (const evaluator of this.evaluators) {
        try {
          const evaluation = await evaluator.evaluate(skill);
          qualityEvaluations.push(evaluation);
        } catch (error) {
          console.error(`Evaluator ${evaluator.name} failed for ${skill.name}:`, error);
        }
      }
      if (qualityEvaluations.length > 0) withEvaluationsCount++;

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
        
        contentHash: this.hashContent(skill.content),
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

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private findRelatedSkills(
    skill: RawSkill,
    allSkills: RawSkill[],
    semantics: SemanticInfo
  ): string[] {
    const related: string[] = [];

    for (const other of allSkills) {
      if (other.name === skill.name) continue;

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

  private calculateStats(
    skills: EnrichedSkill[],
    duplicateGroups: DuplicateGroup[],
    circularResult: CircularDependencyResult
  ): Omit<IntelligenceCatalog['stats'], 'specCompliant' | 'withEvaluations'> {
    const byProvider: Record<string, number> = {};
    const byDomain: Record<string, number> = {};

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

  private calculateSecurityStats(skills: EnrichedSkill[]): IntelligenceCatalog['stats']['security'] {
    let secure = 0;
    let withFindings = 0;
    let criticalFindings = 0;
    let highFindings = 0;
    let mediumFindings = 0;
    const byThreatCategory: Record<string, number> = {};

    for (const skill of skills) {
      // Find security scanner evaluation
      const securityEval = skill.qualityEvaluations.find(e => e.evaluator === 'security-scanner');
      if (!securityEval?.raw) continue;

      const scanResult = securityEval.raw as SecurityScanResult;
      
      if (scanResult.isSecure) {
        secure++;
      } else {
        withFindings++;
      }

      for (const finding of scanResult.findings) {
        // Count by severity
        if (finding.severity === 'CRITICAL') criticalFindings++;
        else if (finding.severity === 'HIGH') highFindings++;
        else if (finding.severity === 'MEDIUM') mediumFindings++;

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
