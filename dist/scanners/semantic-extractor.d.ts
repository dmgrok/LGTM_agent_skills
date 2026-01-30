/**
 * Semantic Extractor
 *
 * Extracts semantic information from skill content.
 * This is EXTRACTION, not quality judgment.
 */
import { RawSkill, SemanticInfo } from './types.js';
export declare class SemanticExtractor {
    /**
     * Extract semantic information from skill content.
     * This is EXTRACTION, not quality judgment.
     */
    extract(skill: RawSkill): SemanticInfo;
    private extractTechnologies;
    private extractDomains;
    private extractTriggerKeywords;
    private extractFileReferences;
}
//# sourceMappingURL=semantic-extractor.d.ts.map