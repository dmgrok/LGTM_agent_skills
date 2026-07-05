/**
 * GitHub Action Entry Point
 *
 * Runs the CC-Tricks rule-based project health checks and reports results.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import { scanProject } from './project-scanner.js';
import { runRules } from './rule-engine.js';
import { formatResults } from './reporter.js';
import { ALL_RULES } from './rules/index.js';
async function run() {
    try {
        // Read inputs
        const inputPath = core.getInput('path') || '.';
        const failOnError = core.getInput('fail-on-error') !== 'false';
        const lakeraApiKey = core.getInput('lakera-api-key') || process.env.LAKERA_GUARD_API_KEY;
        // Set Lakera API key env var if provided
        if (lakeraApiKey) {
            process.env.LAKERA_GUARD_API_KEY = lakeraApiKey;
            core.info('Lakera Guard: enabled');
        }
        core.info(`Scanning project at: ${inputPath}`);
        // Scan project files
        const files = await scanProject({ path: inputPath });
        core.info(`Project root: ${files.projectRoot}`);
        // Run all rules
        const result = await runRules({ files }, ALL_RULES);
        core.info(`Rules executed: ${ALL_RULES.length}`);
        core.info(`Findings: ${result.errors} errors, ${result.warnings} warnings, ${result.infos} info`);
        // Format and log results
        const output = formatResults(result, files, 'github');
        core.info(output);
        // Count findings by category
        const specCount = result.findings.filter((f) => f.ruleId.startsWith('skill-spec')).length;
        const securityCount = result.findings.filter((f) => f.ruleId.startsWith('skill-security')).length;
        // Set outputs
        core.setOutput('passed', result.passed.toString());
        core.setOutput('score', result.passed ? '100' : '0');
        core.setOutput('spec-compliance', specCount.toString());
        core.setOutput('security', securityCount.toString());
        // Write JSON results file
        const workspaceDir = process.env.GITHUB_WORKSPACE || process.cwd();
        const resultsPath = path.join(workspaceDir, 'lgtm-results.json');
        await fs.promises.writeFile(resultsPath, JSON.stringify({
            passed: result.passed,
            errors: result.errors,
            warnings: result.warnings,
            infos: result.infos,
            findings: result.findings,
            projectRoot: files.projectRoot,
        }, null, 2));
        core.setOutput('results-file', resultsPath);
        core.info(`Results saved to ${resultsPath}`);
        // Write GitHub Actions job summary
        let summary = `# CC-Tricks Project Health Report\n\n`;
        summary += `**Status:** ${result.passed ? 'PASSED' : 'FAILED'}\n`;
        summary += `**Errors:** ${result.errors} | **Warnings:** ${result.warnings} | **Info:** ${result.infos}\n\n`;
        if (result.findings.length > 0) {
            summary += `| Severity | Rule | Message | File |\n`;
            summary += `|----------|------|---------|------|\n`;
            for (const finding of result.findings) {
                const file = finding.file ? path.relative(files.projectRoot, finding.file) : '-';
                const line = finding.line ? `:${finding.line}` : '';
                summary += `| ${finding.severity} | ${finding.ruleId} | ${finding.message} | ${file}${line} |\n`;
            }
        }
        else {
            summary += `All checks passed.\n`;
        }
        await core.summary.addRaw(summary).write();
        // Fail the action if there are errors and fail-on-error is true
        if (!result.passed && failOnError) {
            core.setFailed(`Project health check failed with ${result.errors} error(s).`);
        }
    }
    catch (error) {
        core.setFailed(`Action failed: ${error}`);
    }
}
run();
//# sourceMappingURL=action.js.map