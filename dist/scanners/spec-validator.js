/**
 * Spec Validator
 *
 * Validates skills against the official Agent Skills specification.
 * This is DETERMINISTIC - same input always gives same output.
 *
 * @see https://agentskills.io/specification
 */
import { AGENT_SKILLS_SPEC } from './types.js';
export class SpecValidator {
    /**
     * Validate a skill against the official Agent Skills spec
     * This is DETERMINISTIC - same input always gives same output
     */
    validate(skill) {
        const errors = [];
        const warnings = [];
        // Validate name (required)
        this.validateName(skill, errors, warnings);
        // Validate description (required)
        this.validateDescription(skill, errors, warnings);
        // Validate optional fields
        this.validateCompatibility(skill, warnings);
        this.validateMetadata(skill, warnings);
        // Validate body content (recommendations, not requirements)
        this.validateBody(skill, warnings);
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    validateName(skill, errors, warnings) {
        const name = skill.frontmatter.name;
        // Required check
        if (!name) {
            errors.push({
                field: 'name',
                rule: 'name is required',
                actual: undefined,
                severity: 'error'
            });
            return;
        }
        // Length check
        if (name.length > AGENT_SKILLS_SPEC.name.maxLength) {
            errors.push({
                field: 'name',
                rule: `Must be 1-${AGENT_SKILLS_SPEC.name.maxLength} characters`,
                actual: `${name.length} characters`,
                severity: 'error'
            });
        }
        // Pattern check
        if (!AGENT_SKILLS_SPEC.name.pattern.test(name)) {
            errors.push({
                field: 'name',
                rule: 'May only contain lowercase alphanumeric characters and hyphens, no leading/trailing/consecutive hyphens',
                actual: name,
                severity: 'error'
            });
        }
        // Directory name match (if we know it)
        if (skill.directoryName && skill.directoryName !== name) {
            errors.push({
                field: 'name',
                rule: 'Must match the parent directory name',
                actual: `name="${name}" but directory="${skill.directoryName}"`,
                severity: 'error'
            });
        }
    }
    validateDescription(skill, errors, warnings) {
        const description = skill.frontmatter.description;
        if (!description) {
            errors.push({
                field: 'description',
                rule: 'description is required',
                actual: undefined,
                severity: 'error'
            });
            return;
        }
        if (description.length > AGENT_SKILLS_SPEC.description.maxLength) {
            errors.push({
                field: 'description',
                rule: `Must be 1-${AGENT_SKILLS_SPEC.description.maxLength} characters`,
                actual: `${description.length} characters`,
                severity: 'error'
            });
        }
    }
    validateCompatibility(skill, warnings) {
        const compatibility = skill.frontmatter.compatibility;
        if (compatibility && compatibility.length > AGENT_SKILLS_SPEC.compatibility.maxLength) {
            warnings.push({
                field: 'compatibility',
                rule: `Max ${AGENT_SKILLS_SPEC.compatibility.maxLength} characters`,
                actual: `${compatibility.length} characters`,
                severity: 'warning'
            });
        }
    }
    validateMetadata(skill, warnings) {
        const metadata = skill.frontmatter.metadata;
        if (metadata && typeof metadata === 'object') {
            // Check that all values are strings (per spec)
            for (const [key, value] of Object.entries(metadata)) {
                if (typeof value !== 'string') {
                    warnings.push({
                        field: `metadata.${key}`,
                        rule: 'metadata values should be strings',
                        actual: typeof value,
                        severity: 'warning'
                    });
                }
            }
        }
    }
    validateBody(skill, warnings) {
        const lines = skill.content.split('\n').length;
        if (lines > AGENT_SKILLS_SPEC.body.recommendedMaxLines) {
            warnings.push({
                field: 'body',
                rule: `Keep under ${AGENT_SKILLS_SPEC.body.recommendedMaxLines} lines (move detailed content to references/)`,
                actual: `${lines} lines`,
                severity: 'warning'
            });
        }
    }
}
//# sourceMappingURL=spec-validator.js.map