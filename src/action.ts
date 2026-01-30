/**
 * GitHub Action Entry Point
 *
 * This is the entry point for running as a GitHub Action.
 * It reads inputs, runs validation, and sets outputs.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import { SkillAnalyzer } from './analyzer.js';
import { formatScoreForGitHubAction } from './scoring.js';

async function run(): Promise<void> {
  try {
    // Get inputs
    const inputPath = core.getInput('path') || '.';
    const minScore = parseInt(core.getInput('min-score') || '70', 10);
    const failOnError = core.getInput('fail-on-error') !== 'false';
    const skipDuplicates = core.getInput('skip-duplicates') === 'true';
    const lakeraApiKey = core.getInput('lakera-api-key') || process.env.LAKERA_GUARD_API_KEY;

    core.info(`🔍 Validating Agent Skills at: ${inputPath}`);
    core.info(`📊 Minimum score: ${minScore}`);
    if (lakeraApiKey) {
      core.info(`🛡️ Lakera Guard: enabled`);
    }

    // Resolve skill paths
    const skillPaths = resolveSkillPaths(inputPath);

    if (skillPaths.length === 0) {
      core.setFailed('No SKILL.md files found');
      return;
    }

    core.info(`📁 Found ${skillPaths.length} skill(s) to validate`);

    // Create analyzer
    const analyzer = new SkillAnalyzer({
      format: 'github',
      scoring: { minGlobalScore: minScore },
      skipDuplicateCheck: skipDuplicates,
      security: {
        enableLakera: !!lakeraApiKey,
        lakeraApiKey: lakeraApiKey,
      },
    });

    let allPassed = true;
    let totalScore = 0;
    const summaries: string[] = [];
    const jsonResults: any[] = [];

    for (const skillPath of skillPaths) {
      core.startGroup(`Validating: ${skillPath}`);

      try {
        const result = await analyzer.analyze(skillPath);
        const ghResult = formatScoreForGitHubAction(result.score);

        totalScore += result.score.globalScore;
        summaries.push(ghResult.summary);

        // Set outputs (for last/single skill)
        core.setOutput('score', result.score.globalScore.toString());
        core.setOutput('passed', result.score.passed.toString());
        core.setOutput('spec-compliance', ghResult.outputs['spec-compliance']);
        core.setOutput('security', ghResult.outputs['security']);
        core.setOutput('content', ghResult.outputs['content']);
        core.setOutput('testing', ghResult.outputs['testing']);

        // Log annotations
        for (const annotation of ghResult.annotations) {
          if (annotation.level === 'error') {
            core.error(annotation.message);
          } else if (annotation.level === 'warning') {
            core.warning(annotation.message);
          } else {
            core.notice(annotation.message);
          }
        }

        // Store JSON result for artifact
        jsonResults.push({
          skillPath: skillPath,
          globalScore: result.score.globalScore,
          passed: result.score.passed,
          kpis: result.score.kpis.map(kpi => ({
            name: kpi.name,
            score: kpi.score,
            passed: kpi.passed
          }))
        });

        if (!result.score.passed) {
          allPassed = false;
          core.error(`❌ ${skillPath}: Score ${result.score.globalScore}/100 - FAILED`);
        } else {
          core.info(`✅ ${skillPath}: Score ${result.score.globalScore}/100 - PASSED`);
        }
      } catch (error) {
        allPassed = false;
        core.error(`Error analyzing ${skillPath}: ${error}`);
      }

      core.endGroup();
    }

    // Write job summary
    const avgScore = Math.round(totalScore / skillPaths.length);
    let summary = `# 🎯 Agent Skills Validation Report\n\n`;
    summary += `**Skills Validated:** ${skillPaths.length}\n`;
    summary += `**Average Score:** ${avgScore}/100\n`;
    summary += `**Status:** ${allPassed ? '✅ PASSED' : '❌ FAILED'}\n\n`;
    summary += summaries.join('\n\n---\n\n');

    await core.summary.addRaw(summary).write();

    // Write JSON results to file for artifact
    const workspaceDir = process.env.GITHUB_WORKSPACE || process.cwd();
    const resultsPath = path.join(workspaceDir, 'lgtm-results.json');
    await fs.promises.writeFile(
      resultsPath,
      JSON.stringify({
        summary: {
          skillsValidated: skillPaths.length,
          averageScore: avgScore,
          passed: allPassed,
          minScore: minScore
        },
        results: jsonResults
      }, null, 2)
    );
    core.info(`📄 Results saved to ${resultsPath}`);

    // Set output for artifact path
    core.setOutput('results-file', resultsPath);

    // Fail if validation failed and fail-on-error is true
    if (!allPassed && failOnError) {
      core.setFailed(`Validation failed. Score: ${avgScore}/100 (minimum: ${minScore})`);
    }
  } catch (error) {
    core.setFailed(`Action failed: ${error}`);
  }
}

/**
 * Resolve paths to SKILL.md files
 */
function resolveSkillPaths(inputPath: string): string[] {
  const skillPaths: string[] = [];
  const resolved = path.resolve(inputPath);

  if (!fs.existsSync(resolved)) {
    return skillPaths;
  }

  const stat = fs.statSync(resolved);

  if (stat.isFile()) {
    if (resolved.endsWith('SKILL.md')) {
      skillPaths.push(resolved);
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

  return skillPaths;
}

run();
