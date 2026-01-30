/**
 * Skills Registry
 *
 * Connects to the skills.sh API to fetch the full skills database
 * for duplicate detection and discovery.
 *
 * API: https://skills.sh/api/skills
 */
export interface SkillMetadata {
    name: string;
    description?: string;
    source: string;
    installs?: number;
    fetchedAt: string;
}
export interface SkillRegistry {
    version: string;
    updatedAt: string;
    source: 'skills.sh' | 'github';
    totalSkills: number;
    skills: SkillMetadata[];
}
export interface DuplicateMatch {
    skill: SkillMetadata;
    similarity: number;
    matchType: 'exact-name' | 'similar-name' | 'similar-description' | 'content-hash';
}
export interface DuplicateCheckResult {
    hasDuplicates: boolean;
    matches: DuplicateMatch[];
}
export declare const SKILLS_SH_API: {
    baseUrl: string;
    endpoints: {
        skills: string;
    };
    /** Max skills to fetch per request (API default is 50) */
    defaultLimit: number;
    /** Max total skills to fetch (to avoid huge downloads) */
    maxTotalSkills: number;
};
export declare class SkillsRegistryManager {
    private cacheDir;
    private registry;
    constructor(cacheDir?: string);
    /**
     * Get the path to the cached registry file
     */
    private getRegistryPath;
    /**
     * Ensure cache directory exists
     */
    private ensureCacheDir;
    /**
     * Load registry from cache
     */
    loadRegistry(): Promise<SkillRegistry | null>;
    /**
     * Save registry to cache
     */
    private saveRegistry;
    /**
     * Check if registry needs update (older than 24 hours)
     */
    isRegistryStale(): boolean;
    /**
     * Fetch all skills from skills.sh API
     */
    fetchFromSkillsSh(limit?: number, maxTotal?: number, verbose?: boolean): Promise<SkillMetadata[]>;
    /**
     * Update the registry from skills.sh API
     */
    updateRegistry(verbose?: boolean): Promise<SkillRegistry>;
    /**
     * Get or update the registry
     */
    getRegistry(forceUpdate?: boolean, verbose?: boolean): Promise<SkillRegistry>;
}
export declare class RegistryDuplicateDetector {
    private registryManager;
    constructor(registryManager?: SkillsRegistryManager);
    /**
     * Calculate Jaccard similarity between two strings
     */
    private jaccardSimilarity;
    /**
     * Normalize a name for comparison
     */
    private normalizeName;
    /**
     * Check if a skill is a duplicate of any in the registry
     */
    checkForDuplicates(skillName: string, skillDescription: string, skillContent?: string, similarityThreshold?: number): Promise<DuplicateCheckResult>;
    /**
     * Simple string hash
     */
    private simpleHash;
}
export declare function checkDuplicatesAgainstRegistry(skillOrName: string | {
    name: string;
    description: string;
    instructions?: string;
}, skillDescription?: string, skillContent?: string): Promise<DuplicateCheckResult>;
export interface RegistryUpdateStats {
    registry: SkillRegistry;
    updated: number;
    fetchTime: number;
}
export declare function updateSkillsRegistry(verbose?: boolean): Promise<RegistryUpdateStats>;
export declare function listRegistrySkills(): Promise<SkillMetadata[]>;
//# sourceMappingURL=registry.d.ts.map