/**
 * Spec Validator
 *
 * Validates skills against the official Agent Skills specification.
 * This is DETERMINISTIC - same input always gives same output.
 *
 * @see https://agentskills.io/specification
 */
import { RawSkill, SpecComplianceResult } from './types.js';
export declare class SpecValidator {
    /**
     * Validate a skill against the official Agent Skills spec
     * This is DETERMINISTIC - same input always gives same output
     */
    validate(skill: RawSkill): SpecComplianceResult;
    private validateName;
    private validateDescription;
    private validateCompatibility;
    private validateMetadata;
    private validateBody;
}
//# sourceMappingURL=spec-validator.d.ts.map