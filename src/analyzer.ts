/**
 * Skill Analyzer
 *
 * Main orchestrator that runs all scanners and produces a scored result.
 * This is the primary entry point for both CLI and GitHub Action.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import {
  SpecValidator,
  SecurityScanner,
  DependencyValidator,
  RawSkill,
  SecurityScannerOptions,
} from './scanners/index.js';

import {
  ScoringCalculator,
  ScoreResult,
  ScoringOptions,
  formatScoreForCLI,
  formatScoreForGitHubAction,
} from './scoring.js';

import {
  RegistryDuplicateDetector,
  DuplicateCheckResult,
} from './registry.js';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Skill Parser
// ============================================================================

/**
 * Parse a markdown skill file into a RawSkill object
 */
export function parseSkillFile(content: string, filePath: string): RawSkill {
  // Split frontmatter from body
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  let frontmatter: Record<string, unknown> = {};
  let body = content;

  if (frontmatterMatch) {
    try {
      frontmatter = (yaml.load(frontmatterMatch[1]) as Record<string, unknown>) || {};
    } catch {
      // Invalid YAML, leave frontmatter empty
    }
    body = frontmatterMatch[2];
  }

  // Extract directory name from path
  const directoryName = path.basename(path.dirname(filePath));
  const name = (frontmatter.name as string) || directoryName || path.basename(filePath, '.md');
  const description = (frontmatter.description as string) || '';

  return {
    name,
    description,
    frontmatter,
    content: body,
    source: { repo: 'local', provider: 'local', priority: 1 },
    path: filePath,
    directoryName: directoryName !== '.' ? directoryName : name,
    rawContent: content,
    filePath,
  };
}

/**
 * Analyze content for basic quality metrics
 */
function analyzeContent(content: string): {
  wordCount: number;
  lineCount: number;
  hasExamples: boolean;
  hasInstructions: boolean;
} {
  const lines = content.split('\n');
  const words = content.split(/\s+/).filter((w) => w.length > 0);

  // Check for examples (code blocks or "example" keyword near code)
  const hasExamples =
    /```[\s\S]*?```/.test(content) || /example[s]?[:.\s]/i.test(content);

  // Check for instructions (numbered lists, "step", "do", imperative verbs)
  const hasInstructions =
    /^\s*\d+[.)]\s/m.test(content) ||
    /step\s*\d+/i.test(content) ||
    /^[-*]\s+(do|use|run|create|add|make|ensure|check)/im.test(content);

  return {
    wordCount: words.length,
    lineCount: lines.length,
    hasExamples,
    hasInstructions,
  };
}

// ============================================================================
// Analyzer
// ============================================================================

export class SkillAnalyzer {
  private specValidator: SpecValidator;
  private securityScanner: SecurityScanner;
  private dependencyValidator: DependencyValidator;
  private duplicateDetector: RegistryDuplicateDetector;
  private scoringCalculator: ScoringCalculator;
  private options: AnalyzerOptions;

  constructor(options: AnalyzerOptions = {}) {
    this.options = options;
    this.specValidator = new SpecValidator();
    this.securityScanner = new SecurityScanner(options.security);
    this.dependencyValidator = new DependencyValidator();
    this.duplicateDetector = new RegistryDuplicateDetector();
    this.scoringCalculator = new ScoringCalculator(options.scoring);
  }

  /**
   * Analyze a skill file and return a scored result
   */
  async analyze(skillPath: string): Promise<AnalysisResult> {
    // Read and parse the skill file
    const absolutePath = path.resolve(skillPath);
    const content = await fs.readFile(absolutePath, 'utf-8');
    const skill = parseSkillFile(content, absolutePath);

    if (this.options.verbose) {
      console.log(`Analyzing: ${absolutePath}`);
    }

    // Run all scanners
    const specResult = this.specValidator.validate(skill);
    const securityResult = await this.securityScanner.scan(skill);
    const dependencyResult = await this.dependencyValidator.evaluate(skill);
    const contentMetrics = analyzeContent(skill.content);

    // Check for duplicates against public registries (unless skipped)
    let duplicateResult: DuplicateCheckResult = { hasDuplicates: false, matches: [] };
    if (!this.options.skipDuplicateCheck && !this.options.scoring?.skipDuplicateCheck) {
      if (this.options.verbose) {
        console.log('  Checking for duplicates against public skill registries...');
      }
      try {
        duplicateResult = await this.duplicateDetector.checkForDuplicates(
          skill.name,
          skill.description,
          skill.content
        );
      } catch (error) {
        if (this.options.verbose) {
          console.log('  ⚠ Could not check duplicates (network error or rate limit)');
        }
      }
    }

    // Calculate KPIs
    const specKPI = this.scoringCalculator.calculateSpecComplianceKPI({
      isValid: specResult.isValid,
      errors: specResult.errors,
      warnings: specResult.warnings,
    });

    const securityKPI = this.scoringCalculator.calculateSecurityKPI({
      findings: securityResult.findings,
      secretsDetected: securityResult.secretsResult?.secretsDetected ?? false,
    });

    const contentKPI = this.scoringCalculator.calculateContentKPI({
      wordCount: contentMetrics.wordCount,
      hasExamples: contentMetrics.hasExamples,
      hasInstructions: contentMetrics.hasInstructions,
      lineCount: contentMetrics.lineCount,
    });

    // Extract test info from dependency validator result
    const testInfo = dependencyResult.raw as {
      tests?: { hasTests: boolean; cases: unknown[] };
      dependencies?: { hasDependencies: boolean; issues: string[] };
    };

    const testingKPI = this.scoringCalculator.calculateTestingKPI({
      hasTests: testInfo.tests?.hasTests ?? false,
      testCount: testInfo.tests?.cases?.length ?? 0,
      hasDependencies: testInfo.dependencies?.hasDependencies ?? false,
      dependencyIssues: testInfo.dependencies?.issues ?? [],
    });

    // Calculate originality KPI (duplicates)
    const originalityKPI = (this.options.skipDuplicateCheck || this.options.scoring?.skipDuplicateCheck)
      ? this.scoringCalculator.skipOriginalityKPI()
      : this.scoringCalculator.calculateOriginalityKPI(duplicateResult);

    // Calculate global score
    const score = this.scoringCalculator.calculateGlobalScore([
      specKPI,
      securityKPI,
      contentKPI,
      testingKPI,
      originalityKPI,
    ]);

    return {
      skillPath: absolutePath,
      skill,
      score,
      rawResults: this.options.verbose
        ? { spec: specResult, security: securityResult, dependencies: dependencyResult }
        : undefined,
    };
  }

  /**
   * Analyze multiple skill files
   */
  async analyzeMultiple(skillPaths: string[]): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    for (const skillPath of skillPaths) {
      try {
        const result = await this.analyze(skillPath);
        results.push(result);
      } catch (error) {
        console.error(`Error analyzing ${skillPath}:`, error);
      }
    }

    return results;
  }

  /**
   * Format the result based on output format option
   */
  formatResult(result: AnalysisResult): string {
    switch (this.options.format) {
      case 'json':
        return JSON.stringify(
          {
            skillPath: result.skillPath,
            globalScore: result.score.globalScore,
            passed: result.score.passed,
            kpis: result.score.kpis.map((k) => ({
              name: k.name,
              score: k.score,
              passed: k.passed,
              issues: k.issues,
            })),
          },
          null,
          2
        );

      case 'github':
        const ghResult = formatScoreForGitHubAction(result.score);
        return ghResult.summary;

      case 'cli':
      default:
        return formatScoreForCLI(result.score);
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick analyze a skill file with default options
 */
export async function analyzeSkill(
  skillPath: string,
  options: AnalyzerOptions = {}
): Promise<AnalysisResult> {
  const analyzer = new SkillAnalyzer(options);
  return analyzer.analyze(skillPath);
}

/**
 * Check if a skill passes validation (for CI/CD)
 */
export async function validateSkill(
  skillPath: string,
  minScore = 70
): Promise<{ passed: boolean; score: number; summary: string }> {
  const result = await analyzeSkill(skillPath, {
    scoring: { minGlobalScore: minScore },
  });

  return {
    passed: result.score.passed,
    score: result.score.globalScore,
    summary: result.score.summary,
  };
}
