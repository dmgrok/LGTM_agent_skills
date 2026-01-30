/**
 * Quality Evaluators
 *
 * Flexible quality evaluation for skills.
 * Implementations can use LLMs, heuristics, or any other method.
 */
import { RawSkill, QualityEvaluator, QualityEvaluation } from './types.js';
/**
 * A simple heuristic evaluator that only makes OBJECTIVE observations,
 * not subjective quality judgments.
 */
export declare class ObjectiveMetricsEvaluator implements QualityEvaluator {
    name: string;
    evaluate(skill: RawSkill): Promise<QualityEvaluation>;
}
/**
 * LLM-based evaluator stub - actual implementation would call an LLM API
 */
export declare class LLMQualityEvaluator implements QualityEvaluator {
    private apiEndpoint?;
    private model?;
    name: string;
    constructor(apiEndpoint?: string | undefined, model?: string | undefined);
    evaluate(skill: RawSkill): Promise<QualityEvaluation>;
}
/**
 * Composite evaluator that runs multiple evaluators
 */
export declare class CompositeEvaluator implements QualityEvaluator {
    private evaluators;
    name: string;
    constructor(evaluators: QualityEvaluator[]);
    evaluate(skill: RawSkill): Promise<QualityEvaluation>;
}
//# sourceMappingURL=quality-evaluators.d.ts.map