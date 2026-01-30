/**
 * Duplicate Detector
 *
 * Detects duplicate skills using content similarity.
 */
export class DuplicateDetector {
    SIMILARITY_THRESHOLD = 0.75;
    detectDuplicates(skills) {
        const groups = [];
        const processed = new Set();
        for (let i = 0; i < skills.length; i++) {
            if (processed.has(skills[i].name))
                continue;
            const similar = [];
            let maxSimilarity = 0;
            for (let j = i + 1; j < skills.length; j++) {
                if (processed.has(skills[j].name))
                    continue;
                const similarity = this.calculateSimilarity(skills[i], skills[j]);
                if (similarity >= this.SIMILARITY_THRESHOLD) {
                    similar.push(skills[j].name);
                    processed.add(skills[j].name);
                    maxSimilarity = Math.max(maxSimilarity, similarity);
                }
            }
            if (similar.length > 0) {
                const allInGroup = [skills[i], ...skills.filter(s => similar.includes(s.name))];
                const canonical = this.selectCanonical(allInGroup);
                groups.push({
                    canonical: canonical.name,
                    duplicates: allInGroup.filter(s => s.name !== canonical.name).map(s => s.name),
                    similarity: maxSimilarity,
                    method: 'content-similarity'
                });
                processed.add(skills[i].name);
            }
        }
        return groups;
    }
    calculateSimilarity(a, b) {
        // Combine multiple signals
        const nameSim = this.jaccardSimilarity(this.tokenize(a.name), this.tokenize(b.name));
        const descSim = this.jaccardSimilarity(this.tokenize(a.description), this.tokenize(b.description));
        const contentSim = this.jaccardSimilarity(this.tokenize(a.content), this.tokenize(b.content));
        // Weight content most heavily
        return nameSim * 0.2 + descSim * 0.3 + contentSim * 0.5;
    }
    tokenize(text) {
        const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
        return new Set(words);
    }
    jaccardSimilarity(a, b) {
        const intersection = new Set([...a].filter(x => b.has(x)));
        const union = new Set([...a, ...b]);
        if (union.size === 0)
            return 0;
        return intersection.size / union.size;
    }
    selectCanonical(skills) {
        // Prefer: lower priority source (more trusted), then longer content
        return skills.sort((a, b) => {
            if (a.source.priority !== b.source.priority) {
                return a.source.priority - b.source.priority;
            }
            return b.content.length - a.content.length;
        })[0];
    }
}
//# sourceMappingURL=duplicate-detector.js.map