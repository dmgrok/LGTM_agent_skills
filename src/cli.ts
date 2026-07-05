#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { scanProject } from './project-scanner.js';
import { runRules } from './rule-engine.js';
import { formatResults, OutputFormat } from './reporter.js';
import { ALL_RULES } from './rules/index.js';
import { Severity } from './rules/types.js';
import { installPreset, uninstallPreset, listAvailable } from './presets/index.js';
import { compareCommand } from './compare/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CLIArgs {
  command: string;
  subcommand?: string;
  path?: string;
  format: OutputFormat;
  rule?: string;
  severity?: Severity;
  help: boolean;
  version: boolean;
  force: boolean;
  session?: string;
  prompt?: string;
  set: Record<string, string | number | boolean>;
}

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);
  const result: CLIArgs = {
    command: 'check',
    format: 'cli',
    help: false,
    version: false,
    force: false,
    set: {},
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-V') {
      result.version = true;
    } else if (arg === '--force') {
      result.force = true;
    } else if (arg === '--session') {
      result.session = args[++i];
    } else if (arg === '--prompt') {
      result.prompt = args[++i];
    } else if (arg === '--set') {
      const pair = args[++i];
      if (pair && pair.includes('=')) {
        const eq = pair.indexOf('=');
        const k = pair.slice(0, eq);
        const v = pair.slice(eq + 1);
        const num = Number(v);
        result.set[k] = !isNaN(num) && v !== '' ? num : v === 'true' ? true : v === 'false' ? false : v;
      }
    } else if (arg === '--format' || arg === '-f') {
      result.format = args[++i] as OutputFormat;
    } else if (arg === '--rule' || arg === '-r') {
      result.rule = args[++i];
    } else if (arg === '--severity' || arg === '-s') {
      result.severity = args[++i] as Severity;
    } else if (!arg.startsWith('-')) {
      if (!result.command || result.command === 'check') {
        if (['check', 'scan', 'init', 'preset', 'compare'].includes(arg)) {
          result.command = arg;
        } else if (result.command === 'preset' && !result.subcommand) {
          result.subcommand = arg;
        } else if (!result.path) {
          result.path = arg;
        }
      } else if (result.command === 'preset' && !result.subcommand) {
        result.subcommand = arg;
      } else if (!result.path) {
        result.path = arg;
      }
    }
    i++;
  }

  return result;
}

function printHelp(): void {
  console.log(`
lgtm - Claude Code project health tool

USAGE:
  lgtm                              Auto-discover and check everything
  lgtm check [path]                 Check project health (default command)
  lgtm check --rule <filter>        Only run matching rules
  lgtm check --format <fmt>         Output: cli (default), json, github
  lgtm check --severity <s>         Minimum severity: error, warning, info
  lgtm scan <path>                  Security scan only (skill-security rules)
  lgtm init                         Install hooks + /lgtm command into project
  lgtm preset install <name>        Install a preset (e.g. token-optimizer)
  lgtm preset install <name> --set budget=20  Install with config value
  lgtm preset remove <name>         Remove an installed preset
  lgtm preset list                  Show available and installed presets
  lgtm compare                      Run baseline vs optimized token comparison
  lgtm compare --session <uuid>     Analyze a past session's token efficiency
  lgtm compare --prompt "..."       Custom prompt for live comparison

OPTIONS:
  -f, --format <fmt>     Output format: cli, json, github
  -r, --rule <filter>    Only run rules matching this filter
  -s, --severity <sev>   Minimum severity level
  --force                Force reinstall of an existing preset
  -h, --help             Show this help message
  -V, --version          Show version
`);
}

function printVersion(): void {
  try {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    console.log(`lgtm v${pkg.version}`);
  } catch {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      console.log(`lgtm v${pkg.version}`);
    } catch {
      console.log('lgtm v1.0.0');
    }
  }
}

const VALIDATE_HOOK = `#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_call.file_path // .file_path // empty')
if [[ -z "$FILE_PATH" ]] || [[ "$(basename "$FILE_PATH")" != "SKILL.md" ]]; then
  exit 0
fi
RESULT=$(lgtm check "$FILE_PATH" --format json 2>/dev/null) || exit 0
PASSED=$(echo "$RESULT" | jq -r '.passed')
if [[ "$PASSED" == "true" ]]; then
  echo "{\\"continue\\": true, \\"systemMessage\\": \\"\\u2705 LGTM: $FILE_PATH \\u2014 no issues found.\\"}"
else
  ERRORS=$(echo "$RESULT" | jq -r '.errors')
  echo "{\\"continue\\": true, \\"systemMessage\\": \\"\\u26a0\\ufe0f LGTM: $FILE_PATH \\u2014 $ERRORS error(s) found. Run /lgtm for details.\\"}"
fi
`;

const PRECOMMIT_HOOK = `#!/bin/bash
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_call.command // empty')
if [[ "$TOOL_NAME" != "Bash" ]] || ! echo "$COMMAND" | grep -qE '^\\s*git\\s+commit'; then
  exit 0
fi
STAGED=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep 'SKILL\\.md$') || exit 0
[[ -z "$STAGED" ]] && exit 0
FAILURES=""
while IFS= read -r f; do
  RESULT=$(lgtm check "$f" --format json 2>/dev/null) || continue
  PASSED=$(echo "$RESULT" | jq -r '.passed')
  [[ "$PASSED" != "true" ]] && FAILURES="$FAILURES\\n  \\u2022 $f"
done <<< "$STAGED"
if [[ -n "$FAILURES" ]]; then
  echo "\\ud83d\\udeab LGTM: Failing skills block commit:$FAILURES" >&2
  exit 2
fi
`;

const LGTM_COMMAND = `---
description: Run LGTM health checks on this project
---

Run \`lgtm check\` against the current project to validate Claude Code configuration and skills.

## Instructions
1. Run: \`lgtm check\`
2. Display the full output to the user.
3. If issues are found, explain each one and suggest fixes.
`;

async function checkCommand(args: CLIArgs): Promise<number> {
  const files = await scanProject({ path: args.path });

  if (!files.claudeDir && files.skillFiles.length === 0) {
    console.log('No .claude/ directory or SKILL.md files found. Run `lgtm init` to set up hooks.');
    return 0;
  }

  const options = {
    rules: args.rule ? [args.rule] : undefined,
    severity: args.severity,
  };

  const result = await runRules({ files }, ALL_RULES, options);
  const output = formatResults(result, files, args.format);
  console.log(output);

  return result.passed ? 0 : 1;
}

async function scanCommand(args: CLIArgs): Promise<number> {
  if (!args.path) {
    console.error('Error: scan requires a path argument');
    console.error('Usage: lgtm scan <path>');
    process.exit(2);
  }

  const files = await scanProject({ path: args.path });
  const options = { rules: ['skills'] };
  const result = await runRules({ files }, ALL_RULES, options);
  const output = formatResults(result, files, args.format);
  console.log(output);

  return result.passed ? 0 : 1;
}

async function initCommand(targetPath?: string): Promise<number> {
  const projectRoot = targetPath ? path.resolve(targetPath) : process.cwd();
  const claudeDir = path.join(projectRoot, '.claude');
  const hooksDir = path.join(claudeDir, 'hooks');
  const commandsDir = path.join(claudeDir, 'commands');
  const settingsPath = path.join(claudeDir, 'settings.json');

  fs.mkdirSync(hooksDir, { recursive: true });
  fs.mkdirSync(commandsDir, { recursive: true });

  const validatePath = path.join(hooksDir, 'lgtm-validate.sh');
  fs.writeFileSync(validatePath, VALIDATE_HOOK);
  fs.chmodSync(validatePath, 0o755);

  const precommitPath = path.join(hooksDir, 'lgtm-precommit.sh');
  fs.writeFileSync(precommitPath, PRECOMMIT_HOOK);
  fs.chmodSync(precommitPath, 0o755);

  const commandPath = path.join(commandsDir, 'lgtm.md');
  fs.writeFileSync(commandPath, LGTM_COMMAND);

  const hookConfig = {
    hooks: {
      PostToolUse: [
        {
          matcher: 'Edit|Write',
          hooks: [
            {
              type: 'command',
              command: `.claude/hooks/lgtm-validate.sh`,
              timeout: 30,
            },
          ],
        },
      ],
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: `.claude/hooks/lgtm-precommit.sh`,
              timeout: 30,
            },
          ],
        },
      ],
    },
  };

  if (fs.existsSync(settingsPath)) {
    const existing = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    if (!existing.hooks) {
      existing.hooks = {};
    }
    if (!existing.hooks.PostToolUse) {
      existing.hooks.PostToolUse = [];
    }
    if (!existing.hooks.PreToolUse) {
      existing.hooks.PreToolUse = [];
    }

    const hasValidate = existing.hooks.PostToolUse.some(
      (h: { hooks?: { command?: string }[] }) =>
        h.hooks?.some(hook => hook.command?.includes('lgtm-validate'))
    );
    if (!hasValidate) {
      existing.hooks.PostToolUse.push(hookConfig.hooks.PostToolUse[0]);
    }

    const hasPrecommit = existing.hooks.PreToolUse.some(
      (h: { hooks?: { command?: string }[] }) =>
        h.hooks?.some(hook => hook.command?.includes('lgtm-precommit'))
    );
    if (!hasPrecommit) {
      existing.hooks.PreToolUse.push(hookConfig.hooks.PreToolUse[0]);
    }

    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n');
  } else {
    fs.writeFileSync(settingsPath, JSON.stringify(hookConfig, null, 2) + '\n');
  }

  console.log(`
lgtm initialized successfully!

Created:
  .claude/hooks/lgtm-validate.sh    (post-edit hook)
  .claude/hooks/lgtm-precommit.sh   (pre-commit hook)
  .claude/commands/lgtm.md          (/lgtm slash command)
  .claude/settings.json             (hook configuration)

Hooks will automatically:
  - Validate SKILL.md files after edits
  - Block commits with failing skills

Use /lgtm in Claude Code to run checks manually.
`);

  return 0;
}

async function presetCommand(args: CLIArgs): Promise<number> {
  const projectRoot = process.cwd();

  switch (args.subcommand) {
    case 'install': {
      const presetName = args.path;
      if (!presetName) {
        console.error('Error: preset install requires a preset name');
        console.error('Usage: lgtm preset install <name>');
        console.error('Example: lgtm preset install token-optimizer');
        return 2;
      }
      try {
        const result = await installPreset(presetName, projectRoot, { force: args.force, config: args.set });
        console.log(`\nPreset "${result.presetName}" installed successfully!\n`);
        if (result.filesCreated.length > 0) {
          console.log('Files created:');
          for (const f of result.filesCreated) {
            console.log(`  ${path.relative(projectRoot, f)}`);
          }
        }
        if (result.warnings.length > 0) {
          console.log('\nWarnings:');
          for (const w of result.warnings) {
            console.log(`  ${w}`);
          }
        }
        console.log('\nRun `lgtm check` to validate the configuration.');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        return 1;
      }
      return 0;
    }

    case 'remove': {
      const presetName = args.path;
      if (!presetName) {
        console.error('Error: preset remove requires a preset name');
        console.error('Usage: lgtm preset remove <name>');
        return 2;
      }
      try {
        const result = await uninstallPreset(presetName, projectRoot);
        console.log(`\nPreset "${result.presetName}" removed successfully!\n`);
        if (result.filesRemoved.length > 0) {
          console.log('Removed:');
          for (const f of result.filesRemoved) {
            console.log(`  ${path.relative(projectRoot, f)}`);
          }
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        return 1;
      }
      return 0;
    }

    case 'list': {
      const available = await listAvailable();
      const lockPath = path.join(projectRoot, '.claude', 'presets.lock.json');
      let installed: Record<string, unknown> = {};
      try {
        const lock = JSON.parse(await fs.readFileSync(lockPath, 'utf-8'));
        installed = lock.installed ?? {};
      } catch { /* no lock file */ }

      console.log('\nAvailable presets:');
      if (available.length === 0) {
        console.log('  (none found)');
      } else {
        for (const name of available) {
          const status = installed[name] ? ' [installed]' : '';
          console.log(`  ${name}${status}`);
        }
      }
      console.log('');
      return 0;
    }

    default:
      console.error('Usage: lgtm preset <install|remove|list> [name]');
      return 2;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.version) {
    printVersion();
    process.exit(0);
  }

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  let exitCode: number;

  switch (args.command) {
    case 'check':
      exitCode = await checkCommand(args);
      break;
    case 'scan':
      exitCode = await scanCommand(args);
      break;
    case 'init':
      exitCode = await initCommand(args.path);
      break;
    case 'preset':
      exitCode = await presetCommand(args);
      break;
    case 'compare':
      exitCode = await compareCommand({
        session: args.session,
        prompt: args.prompt,
        projectPath: args.path,
      });
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
