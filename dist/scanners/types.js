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
};
// ============================================================================
// Utilities
// ============================================================================
export function hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}
//# sourceMappingURL=types.js.map