/**
 * Security Scanner
 *
 * Implements threat detection using Cisco skill-scanner taxonomy.
 * For secret detection, uses proper libraries (secretlint) or external tools
 * (gitleaks/trufflehog) instead of regex patterns.
 *
 * @see https://github.com/cisco-ai-defense/skill-scanner
 * @see https://arxiv.org/html/2512.12921v1
 */
import { RawSkill, QualityEvaluator, QualityEvaluation, SecurityFinding, SecurityScanResult, Severity } from './types.js';
/**
 * Threat taxonomy aligned with Cisco AI Defense framework
 * NOTE: Secret detection is handled by dedicated tools, not regex
 */
export declare const THREAT_TAXONOMY: {
    readonly PROMPT_INJECTION: {
        readonly id: "PROMPT_INJECTION";
        readonly aitech: readonly ["AITech-1.1", "AITech-1.2"];
        readonly severity: Severity;
        readonly description: "Malicious instructions that manipulate AI behavior or bypass safety systems";
        readonly patterns: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
    };
    readonly CODE_INJECTION: {
        readonly id: "CODE_INJECTION";
        readonly aitech: readonly ["AITech-9.1.4"];
        readonly severity: Severity;
        readonly description: "Unsafe code execution enabling arbitrary command execution";
        readonly patterns: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
    };
    readonly DATA_EXFILTRATION: {
        readonly id: "DATA_EXFILTRATION";
        readonly aitech: readonly ["AITech-8.2", "AITech-8.2.3"];
        readonly severity: Severity;
        readonly description: "Unauthorized data access and transmission to external locations";
        readonly patterns: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
    };
    readonly TOOL_ABUSE: {
        readonly id: "TOOL_ABUSE";
        readonly aitech: readonly ["AITech-12.1"];
        readonly severity: Severity;
        readonly description: "Violating allowed-tools restrictions or undeclared capabilities";
        readonly patterns: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
    };
    readonly OBFUSCATION: {
        readonly id: "OBFUSCATION";
        readonly aitech: readonly [];
        readonly severity: Severity;
        readonly description: "Deliberate code obfuscation hiding malicious intent";
        readonly patterns: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
    };
    readonly SOCIAL_ENGINEERING: {
        readonly id: "SOCIAL_ENGINEERING";
        readonly aitech: readonly ["AITech-2.1"];
        readonly severity: Severity;
        readonly description: "Misrepresentation, impersonation, or deceptive metadata";
        readonly patterns: readonly [RegExp, RegExp, RegExp, RegExp, RegExp];
    };
    readonly TRANSITIVE_TRUST: {
        readonly id: "TRANSITIVE_TRUST";
        readonly aitech: readonly ["AITech-1.2"];
        readonly severity: Severity;
        readonly description: "Delegating trust to untrusted external content";
        readonly patterns: readonly [RegExp, RegExp, RegExp, RegExp, RegExp];
    };
    readonly AUTONOMY_ABUSE: {
        readonly id: "AUTONOMY_ABUSE";
        readonly aitech: readonly ["AITech-9.1"];
        readonly severity: Severity;
        readonly description: "Excessive autonomous behavior without user confirmation";
        readonly patterns: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
    };
    readonly TOOL_CHAINING: {
        readonly id: "TOOL_CHAINING";
        readonly aitech: readonly ["AITech-8.2.3"];
        readonly severity: Severity;
        readonly description: "Multi-step operations chaining tools for data exfiltration";
        readonly patterns: readonly [RegExp, RegExp, RegExp, RegExp, RegExp];
    };
    readonly RESOURCE_ABUSE: {
        readonly id: "RESOURCE_ABUSE";
        readonly aitech: readonly ["AITech-13.3.2"];
        readonly severity: Severity;
        readonly description: "Excessive resource consumption causing instability";
        readonly patterns: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
    };
};
export type ThreatCategory = keyof typeof THREAT_TAXONOMY;
export interface SecretDetector {
    name: string;
    detect(content: string, filePath?: string): Promise<SecurityFinding[]>;
    isAvailable(): Promise<boolean>;
}
export declare class GitleaksDetector implements SecretDetector {
    name: string;
    isAvailable(): Promise<boolean>;
    detect(content: string, _filePath?: string): Promise<SecurityFinding[]>;
}
export declare class TruffleHogDetector implements SecretDetector {
    name: string;
    isAvailable(): Promise<boolean>;
    detect(content: string, _filePath?: string): Promise<SecurityFinding[]>;
}
export declare class FallbackSecretDetector implements SecretDetector {
    name: string;
    isAvailable(): Promise<boolean>;
    /**
     * Pattern-based secret detection as fallback
     * NOTE: This is less accurate than gitleaks/trufflehog
     * Consider installing proper tools for production use
     */
    private readonly SECRET_PATTERNS;
    detect(content: string, _filePath?: string): Promise<SecurityFinding[]>;
    private looksLikePlaceholder;
}
export interface LakeraGuardResult {
    flagged: boolean;
    breakdown?: {
        prompt_injection?: {
            detected: boolean;
        };
        jailbreak?: {
            detected: boolean;
        };
        unknown_links?: {
            detected: boolean;
        };
        relevant_language?: {
            detected: boolean;
        };
        pii?: {
            detected: boolean;
        };
        [key: string]: {
            detected: boolean;
        } | undefined;
    };
    metadata?: {
        request_uuid: string;
    };
}
/**
 * Lakera Guard API client for professional prompt injection detection
 * @see https://docs.lakera.ai/docs/api
 */
export declare class LakeraGuardDetector {
    name: string;
    private apiKey;
    constructor(apiKey?: string);
    isAvailable(): boolean;
    detect(content: string): Promise<SecurityFinding[]>;
}
export interface SecurityScannerOptions {
    /** Preferred secret detector order. First available will be used. */
    preferredDetectors?: ('gitleaks' | 'trufflehog' | 'fallback')[];
    /** Skip secret detection entirely (only scan for other threats) */
    skipSecretDetection?: boolean;
    /** Enable verbose output */
    verbose?: boolean;
    /** Lakera Guard API key for professional prompt injection detection */
    lakeraApiKey?: string;
    /** Enable Lakera Guard (uses LAKERA_GUARD_API_KEY env var if no key provided) */
    enableLakera?: boolean;
}
/**
 * Security scanner implementing Cisco skill-scanner threat taxonomy
 * Uses proper secret detection tools (gitleaks/trufflehog) when available
 * Optionally integrates with Lakera Guard for professional prompt injection detection
 */
export declare class SecurityScanner implements QualityEvaluator {
    name: string;
    private secretDetector;
    private lakeraDetector;
    private detectorInitialized;
    private options;
    constructor(options?: SecurityScannerOptions);
    private initializeSecretDetector;
    evaluate(skill: RawSkill): Promise<QualityEvaluation>;
    scan(skill: RawSkill): Promise<SecurityScanResult>;
}
export { ThreatCategory as ThreatCategoryType };
//# sourceMappingURL=security-scanner.d.ts.map