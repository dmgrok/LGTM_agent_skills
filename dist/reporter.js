import * as path from 'path';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
function groupByFile(findings) {
    const groups = new Map();
    for (const finding of findings) {
        const key = finding.file ?? 'General';
        const group = groups.get(key);
        if (group) {
            group.push(finding);
        }
        else {
            groups.set(key, [finding]);
        }
    }
    return groups;
}
function formatCli(result, files) {
    const lines = [];
    lines.push('');
    lines.push(`  ${BOLD}CC-Tricks — Claude Code Cookbook${RESET}`);
    lines.push(`  ${'─'.repeat(46)}`);
    lines.push('');
    if (result.findings.length === 0) {
        lines.push(`  ${GREEN}✓ No issues found${RESET}`);
        lines.push('');
        return lines.join('\n');
    }
    const grouped = groupByFile(result.findings);
    for (const [filePath, findings] of grouped) {
        const displayPath = filePath === 'General'
            ? 'General'
            : path.relative(files.projectRoot, filePath);
        lines.push(`  ${DIM}${displayPath}${RESET}`);
        for (const finding of findings) {
            let icon;
            switch (finding.severity) {
                case 'error':
                    icon = `${RED}✗${RESET}`;
                    break;
                case 'warning':
                    icon = `${YELLOW}⚠${RESET}`;
                    break;
                case 'info':
                    icon = `${GREEN}✓${RESET}`;
                    break;
            }
            lines.push(`    ${icon} ${finding.message}`);
        }
        lines.push('');
    }
    lines.push(`  ${'─'.repeat(46)}`);
    const parts = [];
    if (result.errors > 0)
        parts.push(`${result.errors} error${result.errors > 1 ? 's' : ''}`);
    if (result.warnings > 0)
        parts.push(`${result.warnings} warning${result.warnings > 1 ? 's' : ''}`);
    if (result.infos > 0)
        parts.push(`${result.infos} info${result.infos > 1 ? 's' : ''}`);
    const statusIcon = result.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    lines.push(`  ${parts.join(', ')}  ${statusIcon}`);
    lines.push('');
    return lines.join('\n');
}
function formatGithub(result, files) {
    const lines = [];
    for (const finding of result.findings) {
        const level = finding.severity === 'info' ? 'notice' : finding.severity;
        const filePart = finding.file
            ? `file=${path.relative(files.projectRoot, finding.file)}`
            : '';
        const linePart = finding.line ? `,line=${finding.line}` : '';
        const location = filePart ? ` ${filePart}${linePart}` : '';
        lines.push(`::${level}${location}::${finding.message}`);
    }
    return lines.join('\n');
}
export function formatResults(result, files, format) {
    switch (format) {
        case 'json':
            return JSON.stringify(result, null, 2);
        case 'github':
            return formatGithub(result, files);
        case 'cli':
        default:
            return formatCli(result, files);
    }
}
//# sourceMappingURL=reporter.js.map