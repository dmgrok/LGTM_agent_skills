/**
 * Quality Evaluators
 *
 * Flexible quality evaluation for skills.
 * Implementations can use LLMs, heuristics, or any other method.
 */
/**
 * A simple heuristic evaluator that only makes OBJECTIVE observations,
 * not subjective quality judgments.
 */
export class ObjectiveMetricsEvaluator {
    name = 'objective-metrics';
    async evaluate(skill) {
        const observations = [];
        // Objective facts only - no quality judgments
        const wordCount = skill.content.split(/\s+/).length;
        observations.push(`Word count: ${wordCount}`);
        const lineCount = skill.content.split('\n').length;
        observations.push(`Line count: ${lineCount}`);
        const headingCount = (skill.content.match(/^#{1,6}\s+/gm) || []).length;
        observations.push(`Section headings: ${headingCount}`);
        const codeBlockCount = (skill.content.match(/```/g) || []).length / 2;
        observations.push(`Code blocks: ${Math.floor(codeBlockCount)}`);
        const hasExamples = /example|e\.g\.|for instance/i.test(skill.content);
        observations.push(`Contains examples: ${hasExamples}`);
        const hasSteps = /^\s*\d+\.\s+/m.test(skill.content) || /^[-*]\s+/m.test(skill.content);
        observations.push(`Contains steps/lists: ${hasSteps}`);
        // Resource availability
        if (skill.hasScriptsDir)
            observations.push('Has scripts/ directory');
        if (skill.hasReferencesDir)
            observations.push('Has references/ directory');
        if (skill.hasAssetsDir)
            observations.push('Has assets/ directory');
        return {
            evaluator: this.name,
            evaluatedAt: new Date().toISOString(),
            observations
            // Note: No scores - this evaluator only reports facts
        };
    }
}
/**
 * LLM-based evaluator stub - actual implementation would call an LLM API
 */
export class LLMQualityEvaluator {
    apiEndpoint;
    model;
    name = 'llm-evaluator';
    constructor(apiEndpoint, model) {
        this.apiEndpoint = apiEndpoint;
        this.model = model;
    }
    async evaluate(skill) {
        // This is a stub - real implementation would:
        // 1. Send skill content to LLM
        // 2. Ask for quality assessment with reasoning
        // 3. Parse structured response
        if (!this.apiEndpoint) {
            return {
                evaluator: this.name,
                evaluatedAt: new Date().toISOString(),
                observations: ['LLM evaluator not configured - skipping quality assessment'],
                raw: { skipped: true, reason: 'no_api_endpoint' }
            };
        }
        // Example prompt structure (not actually calling API in this stub):
        const _promptTemplate = `
Evaluate the following Agent Skill for quality. Consider:
- Clarity: Is it clear what this skill does and when to use it?
- Completeness: Does it provide enough information for an agent to use it effectively?
- Actionability: Are there concrete steps or guidance?
- Relevance: Does the content match the stated description?

Provide your assessment as JSON with:
{
  "scores": {
    "clarity": { "score": 0-100, "confidence": 0-1, "reasoning": "..." },
    "completeness": { "score": 0-100, "confidence": 0-1, "reasoning": "..." },
    ...
  },
  "suggestions": ["improvement 1", "improvement 2"]
}

Skill:
---
name: ${skill.name}
description: ${skill.description}
---
${skill.content.slice(0, 3000)}
`;
        return {
            evaluator: this.name,
            evaluatedAt: new Date().toISOString(),
            observations: ['LLM evaluation would be performed here'],
            raw: { stub: true }
        };
    }
}
/**
 * Composite evaluator that runs multiple evaluators
 */
export class CompositeEvaluator {
    evaluators;
    name = 'composite';
    constructor(evaluators) {
        this.evaluators = evaluators;
    }
    async evaluate(skill) {
        const results = [];
        for (const evaluator of this.evaluators) {
            try {
                const result = await evaluator.evaluate(skill);
                results.push(result);
            }
            catch (error) {
                console.error(`Evaluator ${evaluator.name} failed:`, error);
            }
        }
        // Merge all evaluations
        const allObservations = [];
        const allSuggestions = [];
        const allScores = {};
        for (const result of results) {
            if (result.observations) {
                allObservations.push(`[${result.evaluator}]`);
                allObservations.push(...result.observations);
            }
            if (result.suggestions) {
                allSuggestions.push(...result.suggestions);
            }
            if (result.scores) {
                for (const [key, value] of Object.entries(result.scores)) {
                    allScores[`${result.evaluator}:${key}`] = value;
                }
            }
        }
        return {
            evaluator: this.name,
            evaluatedAt: new Date().toISOString(),
            scores: Object.keys(allScores).length > 0 ? allScores : undefined,
            observations: allObservations,
            suggestions: allSuggestions.length > 0 ? allSuggestions : undefined,
            raw: { evaluations: results }
        };
    }
}
//# sourceMappingURL=quality-evaluators.js.map