/**
 * Duplicate Detector
 *
 * Detects duplicate skills using content similarity.
 */
import { RawSkill, DuplicateGroup } from './types.js';
export declare class DuplicateDetector {
    private readonly SIMILARITY_THRESHOLD;
    detectDuplicates(skills: RawSkill[]): DuplicateGroup[];
    private calculateSimilarity;
    private tokenize;
    private jaccardSimilarity;
    private selectCanonical;
}
//# sourceMappingURL=duplicate-detector.d.ts.map