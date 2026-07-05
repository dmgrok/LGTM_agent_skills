import * as fs from 'fs/promises';
import * as path from 'path';
import { mergeSettingsJson } from './composer.js';
import { resolvePreset } from './resolver.js';
export async function installPreset(nameOrPath, projectRoot, options) {
    const { manifest, baseDir } = await resolvePreset(nameOrPath);
    const claudeDir = path.join(projectRoot, '.claude');
    const lock = await readLock(claudeDir);
    const warnings = [];
    const filesCreated = [];
    // Resolve config: merge defaults with provided values, validate types
    const resolvedConfig = {};
    if (manifest.config) {
        for (const [key, param] of Object.entries(manifest.config)) {
            const provided = options?.config?.[key];
            if (provided !== undefined) {
                const actual = param.type === 'number' ? Number(provided)
                    : param.type === 'boolean' ? (provided === 'true' || provided === true)
                        : String(provided);
                if (param.type === 'number' && isNaN(actual)) {
                    throw new Error(`Config "${key}" must be a number, got: ${provided}`);
                }
                resolvedConfig[key] = actual;
            }
            else {
                resolvedConfig[key] = param.default;
            }
        }
    }
    if (lock.installed[manifest.name] && !options?.force) {
        throw new Error(`Preset "${manifest.name}" is already installed. Use --force to reinstall.`);
    }
    if (manifest.conflicts) {
        for (const conflict of manifest.conflicts) {
            if (lock.installed[conflict]) {
                throw new Error(`Preset "${manifest.name}" conflicts with installed preset "${conflict}". Remove it first.`);
            }
        }
    }
    if (manifest.requires) {
        for (const req of manifest.requires) {
            if (!lock.installed[req]) {
                throw new Error(`Preset "${manifest.name}" requires preset "${req}" to be installed first.`);
            }
        }
    }
    await fs.mkdir(path.join(claudeDir, 'hooks'), { recursive: true });
    await fs.mkdir(path.join(claudeDir, 'commands'), { recursive: true });
    // Install hook scripts
    const hookCommands = [];
    if (manifest.hooks) {
        const sourceHooksDir = path.join(baseDir, 'hooks');
        for (const entries of Object.values(manifest.hooks)) {
            for (const entry of entries) {
                for (const hook of entry.hooks) {
                    const scriptName = path.basename(hook.command);
                    const destPath = path.join(claudeDir, 'hooks', scriptName);
                    const sourcePath = path.join(sourceHooksDir, scriptName);
                    await fs.copyFile(sourcePath, destPath);
                    await fs.chmod(destPath, 0o755);
                    filesCreated.push(destPath);
                    hookCommands.push(hook.command);
                }
            }
        }
    }
    // Install command files
    if (manifest.commands) {
        const sourceCommandsDir = path.join(baseDir, 'commands');
        for (const cmdFile of manifest.commands) {
            const destPath = path.join(claudeDir, 'commands', cmdFile);
            const sourcePath = path.join(sourceCommandsDir, cmdFile);
            await fs.copyFile(sourcePath, destPath);
            filesCreated.push(destPath);
        }
    }
    // Append CLAUDE.md snippets
    if (manifest.snippets) {
        const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
        let claudeMd = '';
        try {
            claudeMd = await fs.readFile(claudeMdPath, 'utf-8');
        }
        catch { /* new file */ }
        const startMarker = `<!-- preset:${manifest.name}:start -->`;
        const endMarker = `<!-- preset:${manifest.name}:end -->`;
        // Remove existing snippet block if present
        const markerRegex = new RegExp(`\\n?${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}\\n?`);
        claudeMd = claudeMd.replace(markerRegex, '');
        // Append new snippet block
        const snippetsDir = path.join(baseDir, 'snippets');
        const snippetContents = [];
        for (const snippetFile of manifest.snippets) {
            const content = await fs.readFile(path.join(snippetsDir, snippetFile), 'utf-8');
            snippetContents.push(content.trim());
        }
        if (snippetContents.length > 0) {
            const block = `\n${startMarker}\n${snippetContents.join('\n\n')}\n${endMarker}\n`;
            claudeMd = claudeMd.trimEnd() + block;
            await fs.writeFile(claudeMdPath, claudeMd);
            filesCreated.push(claudeMdPath);
        }
    }
    // Write preset config file (if the preset declares config params)
    if (manifest.config && Object.keys(resolvedConfig).length > 0) {
        const configPath = path.join(claudeDir, `${manifest.name}.json`);
        await fs.writeFile(configPath, JSON.stringify(resolvedConfig, null, 2) + '\n');
        filesCreated.push(configPath);
    }
    // Merge settings.json
    const settingsPath = path.join(claudeDir, 'settings.json');
    let existing = {};
    try {
        existing = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
    }
    catch { /* new file */ }
    const { settings: merged, warnings: mergeWarnings } = mergeSettingsJson(existing, manifest, manifest.name);
    warnings.push(...mergeWarnings);
    const tmpPath = settingsPath + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(merged, null, 2) + '\n');
    await fs.rename(tmpPath, settingsPath);
    // Update lock file
    lock.installed[manifest.name] = {
        version: manifest.version,
        installedAt: new Date().toISOString(),
        files: filesCreated,
        hookEntries: hookCommands,
        addedPermissions: manifest.permissions?.allow,
        addedSettings: Object.keys(manifest.settings ?? {}),
    };
    await writeLock(claudeDir, lock);
    return { success: true, presetName: manifest.name, filesCreated, warnings };
}
async function readLock(claudeDir) {
    const lockPath = path.join(claudeDir, 'presets.lock.json');
    try {
        const content = await fs.readFile(lockPath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return { installed: {} };
    }
}
async function writeLock(claudeDir, lock) {
    const lockPath = path.join(claudeDir, 'presets.lock.json');
    await fs.writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');
}
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=installer.js.map