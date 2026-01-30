#!/usr/bin/env node
/**
 * LGTM Agent Skills CLI
 *
 * A CLI tool for validating Agent Skills with scoring and KPI breakdown.
 *
 * Usage:
 *   lgtm-skills validate <path>    Validate skill(s) and output score
 *   lgtm-skills scan <path>        Security scan only
 *   lgtm-skills scaffold <name>    Create a new skill template
 *
 * Options:
 *   --format <cli|json|github>     Output format (default: cli)
 *   --min-score <number>           Minimum passing score (default: 70)
 *   --verbose                      Show detailed output
 *   --help                         Show help
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillAnalyzer, AnalyzerOptions, parseSkillFile } from './analyzer.js';
import { SecurityScanner } from './scanners/index.js';
import { SkillScaffolder } from './scanners/index.js';
import { formatScoreForGitHubAction } from './scoring.js';

// ============================================================================
// Argument Parsing
// ============================================================================

interface CLIArgs {
  command: string;
  paths: string[];
  format: 'cli' | 'json' | 'github';
  minScore: number;
  verbose: boolean;
  help: boolean;
  skipDuplicates: boolean;
}

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);
  const result: CLIArgs = {
    command: '',
    paths: [],
    format: 'cli',
    minScore: 70,
    verbose: false,
    help: false,
    skipDuplicates: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--skip-duplicates' || arg === '--offline') {
      result.skipDuplicates = true;
    } else if (arg === '--format' || arg === '-f') {
      result.format = args[++i] as 'cli' | 'json' | 'github';
    } else if (arg === '--min-score') {
      result.minScore = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      if (!result.command) {
        result.command = arg;
      } else {
        result.paths.push(arg);
      }
    }
    i++;
  }

  return result;
}

function printHelp(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           LGTM Agent Skills Validator v1.0.0                   ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  lgtm-skills <command> [paths...] [options]

COMMANDS:
  validate <path>     Validate skill(s) and output score
                      Path can be a SKILL.md file or directory
  scan <path>         Run security scan only
  scaffold <name>     Create a new skill template

OPTIONS:
  -f, --format <fmt>  Output format: cli, json, github (default: cli)
  --min-score <n>     Minimum passing score 0-100 (default: 70)
  --skip-duplicates   Skip duplicate check against public registries
  --offline           Alias for --skip-duplicates
  -v, --verbose       Show detailed scanner output
  -h, --help          Show this help message

DUPLICATE DETECTION:
  By default, skills are checked against public registries:
    - vercel-labs/agent-skills
    - anthropics/skills
    - remotion-dev/skills
  
  Use --skip-duplicates to run offline or speed up validation.

EXAMPLES:
  # Validate a single skill
  lgtm-skills validate ./my-skill/SKILL.md

  # Validate all skills in a directory
  lgtm-skills validate ./skills/

  # Validate with JSON output for CI
  lgtm-skills validate ./skill --format json

  # Validate with custom threshold
  lgtm-skills validate ./skill --min-score 80

  # Skip duplicate check (faster, works offline)
  lgtm-skills validate ./skill --skip-duplicates

  # Run as GitHub Action (outputs GitHub-flavored markdown)
  lgtm-skills validate ./skill --format github

EXIT CODES:
  0    All skills passed validation
  1    One or more skills failed validation
  2    Invalid arguments or runtime error
`);
}

// ============================================================================
// Commands
// ============================================================================

async function validateCommand(args: CLIArgs): Promise<number> {
  if (args.paths.length === 0) {
    console.error('Error: No path specified');
    console.error('Usage: lgtm-skills validate <path>');
    return 2;
  }

  const options: AnalyzerOptions = {
    format: args.format,
    verbose: args.verbose,
    skipDuplicateCheck: args.skipDuplicates,
    scoring: {
      minGlobalScore: args.minScore,
    },
  };

  const analyzer = new SkillAnalyzer(options);
  const skillPaths = resolveSkillPaths(args.paths);

  if (skillPaths.length === 0) {
    console.error('Error: No SKILL.md files found');
    return 2;
  }

  let allPassed = true;
  const results: Array<{ path: string; score: number; passed: boolean }> = [];

  for (const skillPath of skillPaths) {
    try {
      const result = await analyzer.analyze(skillPath);
      const output = analyzer.formatResult(result);
      console.log(output);

      results.push({
        path: skillPath,
        score: result.score.globalScore,
        passed: result.score.passed,
      });

      if (!result.score.passed) {
        allPassed = false;
      }

      // For GitHub Actions format, set outputs
      if (args.format === 'github') {
        const ghResult = formatScoreForGitHubAction(result.score);
        // Write to GITHUB_OUTPUT if available
        const outputFile = process.env.GITHUB_OUTPUT;
        if (outputFile) {
          const outputs = Object.entries(ghResult.outputs)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');
          fs.appendFileSync(outputFile, outputs + '\n');
        }

        // Write step summary if available
        const summaryFile = process.env.GITHUB_STEP_SUMMARY;
        if (summaryFile) {
          fs.appendFileSync(summaryFile, ghResult.summary);
        }

        // Output annotations as workflow commands
        for (const annotation of ghResult.annotations) {
          console.log(`::${annotation.level}::${annotation.message}`);
        }
      }
    } catch (error) {
      console.error(`Error analyzing ${skillPath}:`, error);
      allPassed = false;
    }
  }

  // Summary for multiple files
  if (skillPaths.length > 1 && args.format === 'cli') {
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('════════════════════════════════════════════════════════════════');
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📊 Total:  ${results.length}`);
    console.log('════════════════════════════════════════════════════════════════\n');
  }

  return allPassed ? 0 : 1;
}

async function scanCommand(args: CLIArgs): Promise<number> {
  if (args.paths.length === 0) {
    console.error('Error: No path specified');
    console.error('Usage: lgtm-skills scan <path>');
    return 2;
  }

  const skillPaths = resolveSkillPaths(args.paths);
  const scanner = new SecurityScanner({ skipSecretDetection: false });

  let hasFindings = false;

  for (const skillPath of skillPaths) {
    try {
      const content = fs.readFileSync(skillPath, 'utf-8');
      const skill = parseSkillFile(content, skillPath);
      const result = await scanner.scan(skill);

      console.log(`\n🔒 Security Scan: ${skillPath}`);
      console.log('─'.repeat(60));

      if (result.findings.length === 0) {
        console.log('✅ No security issues found');
      } else {
        hasFindings = true;
        console.log(`Found ${result.findings.length} issue(s):\n`);

        for (const finding of result.findings) {
          const severity = finding.severity.toUpperCase();
          const icon =
            severity === 'CRITICAL'
              ? '🔴'
              : severity === 'HIGH'
              ? '🟠'
              : severity === 'MEDIUM'
              ? '🟡'
              : '🔵';
          console.log(`${icon} [${severity}] ${finding.category}`);
          console.log(`   ${finding.description}`);
          if (finding.location) {
            console.log(`   ${finding.location}`);
          }
          console.log('');
        }
      }

      if (result.secretsResult) {
        if (result.secretsResult.secretsDetected) {
          console.log('🚨 SECRETS DETECTED!');
          hasFindings = true;
        } else {
          console.log('✅ No secrets detected');
        }
      }
    } catch (error) {
      console.error(`Error scanning ${skillPath}:`, error);
    }
  }

  return hasFindings ? 1 : 0;
}

async function scaffoldCommand(args: CLIArgs): Promise<number> {
  if (args.paths.length === 0) {
    console.error('Error: No name specified');
    console.error('Usage: lgtm-skills scaffold <name>');
    return 2;
  }

  const name = args.paths[0];
  const scaffolder = new SkillScaffolder();

  try {
    const result = scaffolder.scaffold({
      name,
      description: `${name} skill`,
      includeTests: true,
      includeScripts: true,
    });

    // Create the directory and files
    const skillDir = path.join(process.cwd(), name);
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }

    // Write SKILL.md
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(skillMdPath, result.skillMd);

    // Create directories
    for (const dir of result.directories) {
      const dirPath = path.join(skillDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }

    // Write test cases if present
    if (result.testCasesYaml) {
      const testDir = path.join(skillDir, 'test');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      fs.writeFileSync(path.join(testDir, 'cases.yaml'), result.testCasesYaml);
    }

    console.log(`\n✅ Skill scaffolded successfully!`);
    console.log(`\nCreated:`);
    console.log(`  📄 ${name}/SKILL.md`);
    for (const dir of result.directories) {
      console.log(`  📁 ${name}/${dir}/`);
    }
    if (result.testCasesYaml) {
      console.log(`  📄 ${name}/test/cases.yaml`);
    }
    console.log(`\nNext steps:`);
    console.log(`  1. Edit ${name}/SKILL.md with your skill content`);
    console.log(`  2. Run: lgtm-skills validate ./${name}`);
    return 0;
  } catch (error) {
    console.error(`❌ Failed to scaffold: ${error}`);
    return 2;
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Resolve paths to SKILL.md files
 */
function resolveSkillPaths(paths: string[]): string[] {
  const skillPaths: string[] = [];

  for (const p of paths) {
    const resolved = path.resolve(p);

    if (!fs.existsSync(resolved)) {
      console.error(`Warning: Path not found: ${resolved}`);
      continue;
    }

    const stat = fs.statSync(resolved);

    if (stat.isFile()) {
      if (resolved.endsWith('SKILL.md')) {
        skillPaths.push(resolved);
      } else {
        console.error(`Warning: Expected SKILL.md file: ${resolved}`);
      }
    } else if (stat.isDirectory()) {
      // Check for SKILL.md in the directory
      const skillMdPath = path.join(resolved, 'SKILL.md');
      if (fs.existsSync(skillMdPath)) {
        skillPaths.push(skillMdPath);
      } else {
        // Look for subdirectories with SKILL.md
        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subSkillPath = path.join(resolved, entry.name, 'SKILL.md');
            if (fs.existsSync(subSkillPath)) {
              skillPaths.push(subSkillPath);
            }
          }
        }
      }
    }
  }

  return skillPaths;
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help || !args.command) {
    printHelp();
    process.exit(args.help ? 0 : 2);
  }

  let exitCode: number;

  switch (args.command) {
    case 'validate':
      exitCode = await validateCommand(args);
      break;
    case 'scan':
      exitCode = await scanCommand(args);
      break;
    case 'scaffold':
      exitCode = await scaffoldCommand(args);
      break;
    default:
      console.error(`Unknown command: ${args.command}`);
      printHelp();
      exitCode = 2;
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(2);
});
