/**
 * Before/after tests: what CC-Tricks catches in a typical Claude Code project
 * that looks fine to the human eye but has silent problems.
 *
 * The "broken" fixture represents a real project a developer might ship:
 *   - settings.json with an invalid hook event name and an out-of-range timeout
 *   - a hook script that is not executable and pipes curl output to bash
 *   - a slash command missing the required frontmatter
 *   - a referenced hook file that doesn't exist
 *
 * The "healthy" fixture is the corrected version of the same project.
 * CC-Tricks should find 0 errors against it.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as url from 'url';
import { runRules } from '../src/rule-engine.js';
import { ALL_RULES } from '../src/rules/index.js';
import { SettingsLintRule } from '../src/rules/settings-lint.js';
import { HooksLintRule } from '../src/rules/hooks-lint.js';
import { CommandsLintRule } from '../src/rules/commands-lint.js';
import type { RuleContext, DiscoveredFiles } from '../src/rules/types.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const BROKEN = path.join(__dirname, 'fixtures/broken-project');
const HEALTHY = path.join(__dirname, 'fixtures/healthy-project');

function makeContext(root: string): RuleContext {
  const claudeDir = path.join(root, '.claude');
  const files: DiscoveredFiles = {
    projectRoot: root,
    claudeDir,
    settingsJson: path.join(claudeDir, 'settings.json'),
    hookScripts: [path.join(claudeDir, 'hooks/on-edit.sh')],
    commandFiles: [path.join(claudeDir, 'commands/deploy.md')],
    skillFiles: [],
  };
  return { files };
}

// ─── Settings ────────────────────────────────────────────────────────────────

describe('settings.json — broken vs healthy', () => {
  it('broken: catches invalid hook event name "OnFileChange"', async () => {
    const findings = await new SettingsLintRule().check(makeContext(BROKEN));
    const eventError = findings.find(
      f => f.ruleId === 'settings/lint' && f.message.includes('OnFileChange'),
    );
    expect(eventError).toBeDefined();
    expect(eventError!.severity).toBe('error');
  });

  it('broken: catches timeout of 9999 (max is 600)', async () => {
    const findings = await new SettingsLintRule().check(makeContext(BROKEN));
    const timeoutError = findings.find(
      f => f.ruleId === 'settings/lint' && f.message.includes('timeout'),
    );
    expect(timeoutError).toBeDefined();
    expect(timeoutError!.severity).toBe('error');
  });

  it('broken: warns that referenced hook file does not exist', async () => {
    const findings = await new SettingsLintRule().check(makeContext(BROKEN));
    const missingFile = findings.find(
      f => f.message.includes('missing-hook.sh'),
    );
    expect(missingFile).toBeDefined();
  });

  it('healthy: no errors', async () => {
    const findings = await new SettingsLintRule().check(makeContext(HEALTHY));
    const errors = findings.filter(f => f.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

// ─── Hook scripts ─────────────────────────────────────────────────────────────

describe('hook scripts — broken vs healthy', () => {
  it('broken: catches hook that is not executable', async () => {
    const findings = await new HooksLintRule().check(makeContext(BROKEN));
    const execError = findings.find(f => f.ruleId === 'hooks/missing-executable');
    expect(execError).toBeDefined();
    expect(execError!.severity).toBe('error');
    expect(execError!.fix).toContain('chmod +x');
  });

  it('broken: catches curl-pipe-to-bash pattern', async () => {
    const findings = await new HooksLintRule().check(makeContext(BROKEN));
    const dangerous = findings.find(f => f.ruleId === 'hooks/dangerous-pattern');
    expect(dangerous).toBeDefined();
    expect(dangerous!.severity).toBe('error');
  });

  it('broken: warns that hook does not read stdin (loses Claude context)', async () => {
    const findings = await new HooksLintRule().check(makeContext(BROKEN));
    const stdinWarn = findings.find(f => f.ruleId === 'hooks/no-stdin');
    expect(stdinWarn).toBeDefined();
  });

  it('healthy: no errors', async () => {
    const findings = await new HooksLintRule().check(makeContext(HEALTHY));
    const errors = findings.filter(f => f.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

// ─── Slash commands ───────────────────────────────────────────────────────────

describe('slash commands — broken vs healthy', () => {
  it('broken: catches missing frontmatter', async () => {
    const findings = await new CommandsLintRule().check(makeContext(BROKEN));
    const fmError = findings.find(f => f.ruleId === 'commands/missing-frontmatter');
    expect(fmError).toBeDefined();
    expect(fmError!.severity).toBe('error');
  });

  it('healthy: no errors', async () => {
    const findings = await new CommandsLintRule().check(makeContext(HEALTHY));
    const errors = findings.filter(f => f.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

// ─── Full run ─────────────────────────────────────────────────────────────────

describe('full project scan — broken vs healthy', () => {
  it('broken project: does not pass', async () => {
    const result = await runRules(makeContext(BROKEN), ALL_RULES);
    expect(result.passed).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
  });

  it('broken project: surfaces at least 4 distinct issues', async () => {
    const result = await runRules(makeContext(BROKEN), ALL_RULES);
    expect(result.findings.length).toBeGreaterThanOrEqual(4);
  });

  it('healthy project: passes with zero errors', async () => {
    const result = await runRules(makeContext(HEALTHY), ALL_RULES);
    expect(result.errors).toBe(0);
  });

  it('healthy project: is marked as passed', async () => {
    const result = await runRules(makeContext(HEALTHY), ALL_RULES);
    expect(result.passed).toBe(true);
  });
});
