/**
 * Semantic Extractor
 *
 * Extracts semantic information from skill content.
 * This is EXTRACTION, not quality judgment.
 */
export class SemanticExtractor {
    /**
     * Extract semantic information from skill content.
     * This is EXTRACTION, not quality judgment.
     */
    extract(skill) {
        return {
            technologies: this.extractTechnologies(skill.content),
            domains: this.extractDomains(skill),
            triggerKeywords: this.extractTriggerKeywords(skill),
            referencedFiles: this.extractFileReferences(skill.content)
        };
    }
    extractTechnologies(content) {
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
        const found = new Set();
        for (const pattern of techPatterns) {
            const matches = content.match(pattern) || [];
            for (const match of matches) {
                found.add(match.toLowerCase());
            }
        }
        return [...found];
    }
    extractDomains(skill) {
        const domains = [];
        const content = (skill.description + ' ' + skill.content).toLowerCase();
        // Domain detection based on content themes
        const domainIndicators = {
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
    extractTriggerKeywords(skill) {
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
    extractFileReferences(content) {
        // Extract referenced files (scripts, references, assets)
        const filePatterns = [
            /scripts\/[\w\-./]+/g,
            /references\/[\w\-./]+/g,
            /assets\/[\w\-./]+/g,
            /`([^`]+\.(py|js|ts|sh|md|json|yaml))`/g
        ];
        const files = new Set();
        for (const pattern of filePatterns) {
            const matches = content.match(pattern) || [];
            for (const match of matches) {
                files.add(match.replace(/`/g, ''));
            }
        }
        return [...files];
    }
}
//# sourceMappingURL=semantic-extractor.js.map