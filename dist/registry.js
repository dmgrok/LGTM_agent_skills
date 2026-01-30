/**
 * Skills Registry
 *
 * Connects to the skills.sh API to fetch the full skills database
 * for duplicate detection and discovery.
 *
 * API: https://skills.sh/api/skills
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// ============================================================================
// Skills.sh API Configuration
// ============================================================================
export const SKILLS_SH_API = {
    baseUrl: 'https://skills.sh/api',
    endpoints: {
        skills: '/skills',
    },
    /** Max skills to fetch per request (API default is 50) */
    defaultLimit: 200,
    /** Max total skills to fetch (to avoid huge downloads) */
    maxTotalSkills: 1000,
};
// ============================================================================
// Skills Registry Manager
// ============================================================================
export class SkillsRegistryManager {
    cacheDir;
    registry = null;
    constructor(cacheDir) {
        this.cacheDir = cacheDir || path.join(os.homedir(), '.lgtm-skills', 'registry');
    }
    /**
     * Get the path to the cached registry file
     */
    getRegistryPath() {
        return path.join(this.cacheDir, 'registry.json');
    }
    /**
     * Ensure cache directory exists
     */
    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }
    /**
     * Load registry from cache
     */
    async loadRegistry() {
        const registryPath = this.getRegistryPath();
        if (fs.existsSync(registryPath)) {
            try {
                const content = fs.readFileSync(registryPath, 'utf-8');
                this.registry = JSON.parse(content);
                return this.registry;
            }
            catch {
                return null;
            }
        }
        return null;
    }
    /**
     * Save registry to cache
     */
    saveRegistry(registry) {
        this.ensureCacheDir();
        const registryPath = this.getRegistryPath();
        fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
        this.registry = registry;
    }
    /**
     * Check if registry needs update (older than 24 hours)
     */
    isRegistryStale() {
        if (!this.registry)
            return true;
        const updatedAt = new Date(this.registry.updatedAt);
        const now = new Date();
        const hoursDiff = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
        return hoursDiff > 24;
    }
    /**
     * Fetch all skills from skills.sh API
     */
    async fetchFromSkillsSh(limit = SKILLS_SH_API.defaultLimit, maxTotal = SKILLS_SH_API.maxTotalSkills, verbose = false) {
        const skills = [];
        let offset = 0;
        let hasMore = true;
        while (hasMore && skills.length < maxTotal) {
            const url = `${SKILLS_SH_API.baseUrl}${SKILLS_SH_API.endpoints.skills}?limit=${limit}&offset=${offset}`;
            if (verbose) {
                console.log(`  Fetching skills from skills.sh (offset: ${offset})...`);
            }
            try {
                const response = await fetch(url, {
                    headers: {
                        Accept: 'application/json',
                        'User-Agent': 'lgtm-agent-skills',
                    },
                });
                if (!response.ok) {
                    console.error(`Failed to fetch from skills.sh: ${response.status}`);
                    break;
                }
                const data = (await response.json());
                for (const skill of data.skills) {
                    skills.push({
                        name: skill.name,
                        source: skill.topSource,
                        installs: skill.installs,
                        fetchedAt: new Date().toISOString(),
                    });
                }
                hasMore = data.hasMore;
                offset += data.skills.length;
                if (verbose) {
                    console.log(`    Fetched ${data.skills.length} skills (total: ${skills.length})`);
                }
            }
            catch (error) {
                console.error(`Error fetching from skills.sh:`, error);
                break;
            }
        }
        return skills;
    }
    /**
     * Update the registry from skills.sh API
     */
    async updateRegistry(verbose = false) {
        const skills = await this.fetchFromSkillsSh(SKILLS_SH_API.defaultLimit, SKILLS_SH_API.maxTotalSkills, verbose);
        const registry = {
            version: '2.0.0',
            updatedAt: new Date().toISOString(),
            source: 'skills.sh',
            totalSkills: skills.length,
            skills,
        };
        this.saveRegistry(registry);
        return registry;
    }
    /**
     * Get or update the registry
     */
    async getRegistry(forceUpdate = false, verbose = false) {
        if (!forceUpdate) {
            const cached = await this.loadRegistry();
            if (cached && !this.isRegistryStale()) {
                return cached;
            }
        }
        if (verbose) {
            console.log('  Updating skills registry from skills.sh...');
        }
        return this.updateRegistry(verbose);
    }
}
// ============================================================================
// Duplicate Detector (against registry)
// ============================================================================
export class RegistryDuplicateDetector {
    registryManager;
    constructor(registryManager) {
        this.registryManager = registryManager || new SkillsRegistryManager();
    }
    /**
     * Calculate Jaccard similarity between two strings
     */
    jaccardSimilarity(str1, str2) {
        if (!str1 || typeof str1 !== 'string' || !str2 || typeof str2 !== 'string') {
            return 0;
        }
        const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
        const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        return union.size > 0 ? intersection.size / union.size : 0;
    }
    /**
     * Normalize a name for comparison
     */
    normalizeName(name) {
        if (!name || typeof name !== 'string')
            return '';
        return name.toLowerCase().replace(/[-_\s]+/g, '-').trim();
    }
    /**
     * Check if a skill is a duplicate of any in the registry
     */
    async checkForDuplicates(skillName, skillDescription, skillContent, similarityThreshold = 0.6) {
        const registry = await this.registryManager.getRegistry();
        const matches = [];
        const normalizedName = this.normalizeName(skillName);
        const contentHash = skillContent ? this.simpleHash(skillContent) : undefined;
        for (const registrySkill of registry.skills) {
            // Skip skills without valid names
            if (!registrySkill.name || typeof registrySkill.name !== 'string') {
                continue;
            }
            const registryNormalizedName = this.normalizeName(registrySkill.name);
            // Check for exact name match
            if (normalizedName === registryNormalizedName) {
                matches.push({
                    skill: registrySkill,
                    similarity: 1.0,
                    matchType: 'exact-name',
                });
                continue;
            }
            // Check for similar name
            const nameSimilarity = this.jaccardSimilarity(skillName, registrySkill.name || '');
            if (nameSimilarity >= similarityThreshold) {
                matches.push({
                    skill: registrySkill,
                    similarity: nameSimilarity,
                    matchType: 'similar-name',
                });
                continue;
            }
            // Check for similar description
            const descSimilarity = this.jaccardSimilarity(skillDescription, registrySkill.description || '');
            if (descSimilarity >= similarityThreshold) {
                matches.push({
                    skill: registrySkill,
                    similarity: descSimilarity,
                    matchType: 'similar-description',
                });
            }
        }
        // Sort by similarity (highest first)
        matches.sort((a, b) => b.similarity - a.similarity);
        return {
            hasDuplicates: matches.length > 0,
            matches: matches.slice(0, 5), // Top 5 matches
        };
    }
    /**
     * Simple string hash
     */
    simpleHash(str) {
        let hash = 0;
        const normalized = str.toLowerCase().replace(/\s+/g, ' ').trim();
        for (let i = 0; i < normalized.length; i++) {
            const char = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
}
// ============================================================================
// Exports
// ============================================================================
export async function checkDuplicatesAgainstRegistry(skillOrName, skillDescription, skillContent) {
    const detector = new RegistryDuplicateDetector();
    // Handle object overload
    if (typeof skillOrName === 'object') {
        return detector.checkForDuplicates(skillOrName.name, skillOrName.description, skillOrName.instructions);
    }
    return detector.checkForDuplicates(skillOrName, skillDescription || '', skillContent);
}
export async function updateSkillsRegistry(verbose = false) {
    const manager = new SkillsRegistryManager();
    const startTime = Date.now();
    const registry = await manager.updateRegistry(verbose);
    const fetchTime = Date.now() - startTime;
    return {
        registry,
        updated: registry.skills.length,
        fetchTime,
    };
}
export async function listRegistrySkills() {
    const manager = new SkillsRegistryManager();
    const registry = await manager.getRegistry();
    return registry.skills;
}
//# sourceMappingURL=registry.js.map