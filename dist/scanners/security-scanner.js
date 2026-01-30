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
import { spawn } from 'child_process';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
// ============================================================================
// Threat Taxonomy (non-secret threats use pattern detection)
// ============================================================================
/**
 * Threat taxonomy aligned with Cisco AI Defense framework
 * NOTE: Secret detection is handled by dedicated tools, not regex
 */
export const THREAT_TAXONOMY = {
    // AITech-1.1, AITech-1.2 - Prompt Injection
    PROMPT_INJECTION: {
        id: 'PROMPT_INJECTION',
        aitech: ['AITech-1.1', 'AITech-1.2'],
        severity: 'HIGH',
        description: 'Malicious instructions that manipulate AI behavior or bypass safety systems',
        patterns: [
            /ignore\s+(previous|all|any)\s+(instructions?|rules?|guidelines?)/i,
            /disregard\s+(previous|all|any)\s+(instructions?|rules?)/i,
            /you\s+are\s+now\s+(in\s+)?(unrestricted|jailbreak|dan|developer)\s+mode/i,
            /pretend\s+(you\s+are|to\s+be)\s+(not\s+)?an?\s+(ai|assistant|chatbot)/i,
            /don['']?t\s+tell\s+(the\s+)?user/i,
            /hide\s+this\s+from\s+(the\s+)?user/i,
            /bypass\s+(safety|security|content)\s+(filters?|restrictions?|guidelines?)/i,
            /override\s+(your|system)\s+(instructions?|prompt|rules?)/i
        ]
    },
    // AITech-9.1.4 - Command & Code Injection (non-secret)
    CODE_INJECTION: {
        id: 'CODE_INJECTION',
        aitech: ['AITech-9.1.4'],
        severity: 'CRITICAL',
        description: 'Unsafe code execution enabling arbitrary command execution',
        patterns: [
            /\beval\s*\(\s*[^)]+\)/i, // eval(something) - not empty
            /\bexec\s*\(\s*[^)]+\)/i, // exec(something) - not empty
            /os\.system\s*\(\s*[^)]+\)/i, // os.system(cmd)
            /subprocess\.(call|run|Popen)\s*\([^)]*shell\s*=\s*True/i,
            /child_process\.(exec|execSync|spawn)\s*\(/i,
            /\$\([^)]{5,}\)/, // $(command) shell substitution (min 5 chars)
            /;\s*(rm|del|format|mkfs)\s+(-rf?\s+)?[\/~]/i, // Dangerous commands
            /reverse\s*shell/i,
            /bind\s*shell/i,
            /nc\s+-[el].*\d+/i, // netcat listening
            /bash\s+-i\s+>&/i // bash reverse shell
        ]
    },
    // AITech-8.2, AITech-8.2.3 - Data Exfiltration (sensitive path access)
    DATA_EXFILTRATION: {
        id: 'DATA_EXFILTRATION',
        aitech: ['AITech-8.2', 'AITech-8.2.3'],
        severity: 'HIGH',
        description: 'Unauthorized data access and transmission to external locations',
        patterns: [
            /~\/\.aws/,
            /~\/\.ssh/,
            /~\/\.config/,
            /~\/\.env/,
            /process\.env\[/,
            /os\.environ/i,
            /getenv\s*\(/i,
            /curl\s+.*-d.*\$|wget\s+.*--post-data/i,
            /requests?\.(post|put)\s*\([^)]*env/i
        ]
    },
    // AITech-12.1 - Tool & Permission Abuse
    TOOL_ABUSE: {
        id: 'TOOL_ABUSE',
        aitech: ['AITech-12.1'],
        severity: 'HIGH',
        description: 'Violating allowed-tools restrictions or undeclared capabilities',
        patterns: [
            /install\s+(packages?|dependencies|modules?)/i,
            /pip\s+install/i,
            /npm\s+install/i,
            /apt(-get)?\s+install/i,
            /brew\s+install/i,
            /chmod\s+[0-7]{3,4}/,
            /chown\s+/i,
            /sudo\s+/i,
            /su\s+-/i,
            /modify\s+(system|kernel|boot)/i
        ]
    },
    // Obfuscation
    OBFUSCATION: {
        id: 'OBFUSCATION',
        aitech: [],
        severity: 'HIGH',
        description: 'Deliberate code obfuscation hiding malicious intent',
        patterns: [
            /base64\.(b64)?decode\s*\(\s*['"]/i,
            /atob\s*\(/i,
            /Buffer\.from\s*\([^)]+,\s*['"]base64['"]\)/i,
            /\\x[0-9a-f]{2}\\x[0-9a-f]{2}/i, // Hex encoded strings
            /fromCharCode\s*\(\s*\d+\s*(,\s*\d+\s*){5,}\)/i,
            /\.encode\(['"]rot13['"]\)/i
        ]
    },
    // AITech-2.1 - Social Engineering
    SOCIAL_ENGINEERING: {
        id: 'SOCIAL_ENGINEERING',
        aitech: ['AITech-2.1'],
        severity: 'MEDIUM',
        description: 'Misrepresentation, impersonation, or deceptive metadata',
        patterns: [
            /official\s+(openai|anthropic|google|microsoft)\s+skill/i,
            /verified\s+by\s+(openai|anthropic|google)/i,
            /certified\s+(ai|agent)\s+skill/i,
            /guaranteed\s+(safe|secure|trusted)/i,
            /100%\s+(safe|secure|tested)/i
        ]
    },
    // AITech-1.2 - Transitive Trust
    TRANSITIVE_TRUST: {
        id: 'TRANSITIVE_TRUST',
        aitech: ['AITech-1.2'],
        severity: 'HIGH',
        description: 'Delegating trust to untrusted external content',
        patterns: [
            /follow\s+(the\s+)?(instructions|commands)\s+(from|on|in)\s+(the\s+)?(webpage|url|link|file)/i,
            /execute\s+(the\s+)?(code|script|commands?)\s+(from|found|in)/i,
            /obey\s+(the\s+)?(file|content|instructions)/i,
            /do\s+what(ever)?\s+(the\s+)?(url|webpage|file)\s+(says|tells)/i,
            /load\s+and\s+(run|execute)\s+from\s+(remote|external|url)/i
        ]
    },
    // AITech-9.1 - Autonomy Abuse
    AUTONOMY_ABUSE: {
        id: 'AUTONOMY_ABUSE',
        aitech: ['AITech-9.1'],
        severity: 'MEDIUM',
        description: 'Excessive autonomous behavior without user confirmation',
        patterns: [
            /keep\s+(trying|retrying)\s+(forever|indefinitely|until)/i,
            /run\s+without\s+(asking|confirmation|approval)/i,
            /ignore\s+(all\s+)?errors?\s+and\s+continue/i,
            /auto(matically)?\s+(approve|confirm|accept)\s+all/i,
            /never\s+ask\s+(for\s+)?(confirmation|permission|approval)/i,
            /modify\s+(yourself|your\s+own\s+code|self)/i
        ]
    },
    // AITech-8.2.3 - Tool Chaining
    TOOL_CHAINING: {
        id: 'TOOL_CHAINING',
        aitech: ['AITech-8.2.3'],
        severity: 'HIGH',
        description: 'Multi-step operations chaining tools for data exfiltration',
        patterns: [
            /read\s+.*then\s+.*send/i,
            /collect\s+.*and\s+.*post/i,
            /gather\s+.*upload/i,
            /export\s+.*to\s+.*external/i,
            /pipe\s+.*to\s+.*remote/i
        ]
    },
    // AITech-13.3.2 - Resource Abuse
    RESOURCE_ABUSE: {
        id: 'RESOURCE_ABUSE',
        aitech: ['AITech-13.3.2'],
        severity: 'MEDIUM',
        description: 'Excessive resource consumption causing instability',
        patterns: [
            /while\s*\(\s*true\s*\)/i,
            /for\s*\(\s*;;\s*\)/,
            /fork\s*\(\s*\)/i,
            /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/, // Fork bomb
            /Array\s*\(\s*\d{9,}\s*\)/i, // Large array allocation
            /repeat\s+forever/i
        ]
    }
};
// ============================================================================
// Gitleaks Secret Detector
// ============================================================================
export class GitleaksDetector {
    name = 'gitleaks';
    async isAvailable() {
        return new Promise((resolve) => {
            const proc = spawn('gitleaks', ['version'], { shell: true });
            proc.on('close', (code) => resolve(code === 0));
            proc.on('error', () => resolve(false));
        });
    }
    async detect(content, _filePath) {
        const findings = [];
        // Create temp file for scanning
        const tempDir = await mkdtemp(join(tmpdir(), 'gitleaks-'));
        const tempFile = join(tempDir, 'scan-content.txt');
        try {
            await writeFile(tempFile, content, 'utf-8');
            const result = await new Promise((resolve, reject) => {
                let output = '';
                const proc = spawn('gitleaks', [
                    'detect',
                    '--source', tempDir,
                    '--no-git',
                    '--report-format', 'json',
                    '--report-path', '/dev/stdout'
                ], { shell: true });
                proc.stdout.on('data', (data) => { output += data.toString(); });
                proc.stderr.on('data', () => { });
                proc.on('close', () => resolve(output));
                proc.on('error', reject);
            });
            if (result.trim()) {
                try {
                    const parsed = JSON.parse(result);
                    if (Array.isArray(parsed)) {
                        for (const finding of parsed) {
                            findings.push({
                                category: 'HARDCODED_SECRETS',
                                aitech: ['AITech-8.2'],
                                severity: 'CRITICAL',
                                description: `Secret detected: ${finding.Description || finding.RuleID || 'Unknown'}`,
                                match: finding.Secret ? finding.Secret.slice(0, 20) + '...' : finding.Match?.slice(0, 40) || 'redacted',
                                location: `Line ${finding.StartLine || 'unknown'}`,
                                confidence: 0.95,
                                detector: 'gitleaks'
                            });
                        }
                    }
                }
                catch {
                    // JSON parse failed, no findings
                }
            }
        }
        finally {
            try {
                await unlink(tempFile);
                await unlink(tempDir).catch(() => { });
            }
            catch {
                // Cleanup failed, not critical
            }
        }
        return findings;
    }
}
// ============================================================================
// TruffleHog Secret Detector
// ============================================================================
export class TruffleHogDetector {
    name = 'trufflehog';
    async isAvailable() {
        return new Promise((resolve) => {
            const proc = spawn('trufflehog', ['--version'], { shell: true });
            proc.on('close', (code) => resolve(code === 0));
            proc.on('error', () => resolve(false));
        });
    }
    async detect(content, _filePath) {
        const findings = [];
        // Create temp dir for scanning
        const tempDir = await mkdtemp(join(tmpdir(), 'trufflehog-'));
        const tempFile = join(tempDir, 'scan-content.txt');
        try {
            await writeFile(tempFile, content, 'utf-8');
            const result = await new Promise((resolve, reject) => {
                let output = '';
                const proc = spawn('trufflehog', [
                    'filesystem',
                    tempDir,
                    '--json',
                    '--no-verification' // Skip verification for speed in analysis
                ], { shell: true });
                proc.stdout.on('data', (data) => { output += data.toString(); });
                proc.stderr.on('data', () => { });
                proc.on('close', () => resolve(output));
                proc.on('error', reject);
            });
            // TruffleHog outputs newline-delimited JSON
            const lines = result.split('\n').filter(l => l.trim());
            for (const line of lines) {
                try {
                    const finding = JSON.parse(line);
                    findings.push({
                        category: 'HARDCODED_SECRETS',
                        aitech: ['AITech-8.2'],
                        severity: 'CRITICAL',
                        description: `Secret detected: ${finding.DetectorName || finding.detectorName || 'Unknown'}`,
                        match: finding.Raw ? finding.Raw.slice(0, 20) + '...' : 'redacted',
                        location: `Line ${finding.SourceMetadata?.Data?.Filesystem?.line || 'unknown'}`,
                        confidence: finding.Verified ? 1.0 : 0.85,
                        detector: 'trufflehog'
                    });
                }
                catch {
                    // Line is not valid JSON, skip
                }
            }
        }
        finally {
            try {
                await unlink(tempFile);
                await unlink(tempDir).catch(() => { });
            }
            catch {
                // Cleanup failed, not critical
            }
        }
        return findings;
    }
}
// ============================================================================
// Fallback Pattern-Based Secret Detector (when no tools available)
// ============================================================================
export class FallbackSecretDetector {
    name = 'fallback-patterns';
    async isAvailable() {
        return true; // Always available as fallback
    }
    /**
     * Pattern-based secret detection as fallback
     * NOTE: This is less accurate than gitleaks/trufflehog
     * Consider installing proper tools for production use
     */
    SECRET_PATTERNS = [
        // AWS
        { pattern: /AKIA[0-9A-Z]{16}/, type: 'AWS Access Key' },
        { pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/, type: 'AWS Secret Key' },
        // GitHub
        { pattern: /ghp_[a-zA-Z0-9]{36}/, type: 'GitHub Personal Access Token' },
        { pattern: /gho_[a-zA-Z0-9]{36}/, type: 'GitHub OAuth Token' },
        { pattern: /ghu_[a-zA-Z0-9]{36}/, type: 'GitHub User-to-Server Token' },
        { pattern: /ghs_[a-zA-Z0-9]{36}/, type: 'GitHub Server-to-Server Token' },
        { pattern: /ghr_[a-zA-Z0-9]{36}/, type: 'GitHub Refresh Token' },
        // OpenAI
        { pattern: /sk-proj-[a-zA-Z0-9]{48}/, type: 'OpenAI API Key (Project)' },
        { pattern: /sk-[a-zA-Z0-9]{48}/, type: 'OpenAI API Key' },
        // Slack
        { pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/, type: 'Slack Token' },
        // Private Keys
        { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, type: 'Private Key' },
        { pattern: /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/, type: 'OpenSSH Private Key' },
        { pattern: /-----BEGIN\s+PGP\s+PRIVATE\s+KEY\s+BLOCK-----/, type: 'PGP Private Key' },
        // JWTs (only if they look like actual secrets, not examples)
        { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, type: 'JWT Token' },
        // Database connection strings with credentials
        { pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/i, type: 'MongoDB Connection String' },
        { pattern: /postgres(ql)?:\/\/[^:]+:[^@]+@/i, type: 'PostgreSQL Connection String' },
        { pattern: /mysql:\/\/[^:]+:[^@]+@/i, type: 'MySQL Connection String' },
        { pattern: /redis:\/\/:[^@]+@/i, type: 'Redis Connection String' },
        // API Keys (generic patterns)
        { pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/i, type: 'Generic API Key' },
        { pattern: /(?:secret[_-]?key|secretkey)\s*[=:]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/i, type: 'Generic Secret Key' },
        // Stripe
        { pattern: /sk_live_[a-zA-Z0-9]{24}/, type: 'Stripe Live Secret Key' },
        { pattern: /sk_test_[a-zA-Z0-9]{24}/, type: 'Stripe Test Secret Key' },
        { pattern: /rk_live_[a-zA-Z0-9]{24}/, type: 'Stripe Restricted Key' },
        // Google
        { pattern: /AIza[0-9A-Za-z_-]{35}/, type: 'Google API Key' },
        // Azure
        { pattern: /(?:AccountKey|SharedAccessKey)\s*=\s*['"]?([A-Za-z0-9+/=]{44,})['"]?/, type: 'Azure Storage Key' },
        // Twilio
        { pattern: /SK[a-f0-9]{32}/, type: 'Twilio API Key' },
        // SendGrid
        { pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/, type: 'SendGrid API Key' },
        // Discord
        { pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/, type: 'Discord Bot Token' },
        // npm
        { pattern: /npm_[A-Za-z0-9]{36}/, type: 'npm Access Token' },
        // PyPI
        { pattern: /pypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{70,}/, type: 'PyPI API Token' },
    ];
    async detect(content, _filePath) {
        const findings = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const { pattern, type } of this.SECRET_PATTERNS) {
                const match = line.match(pattern);
                if (match) {
                    // Avoid false positives for obvious placeholders
                    const matchStr = match[1] || match[0];
                    if (this.looksLikePlaceholder(matchStr)) {
                        continue;
                    }
                    findings.push({
                        category: 'HARDCODED_SECRETS',
                        aitech: ['AITech-8.2'],
                        severity: 'CRITICAL',
                        description: `Potential ${type} detected`,
                        match: matchStr.slice(0, 20) + '...',
                        location: `Line ${i + 1}`,
                        confidence: 0.7, // Lower confidence for pattern-based detection
                        detector: 'fallback-patterns'
                    });
                }
            }
        }
        return findings;
    }
    looksLikePlaceholder(value) {
        const placeholderPatterns = [
            /^(your[_-]?)?xxx+$/i,
            /^(your[_-]?)?(api[_-]?)?key[_-]?here$/i,
            /^\$\{.*\}$/,
            /^<.*>$/,
            /^{{.*}}$/,
            /^placeholder$/i,
            /^example$/i,
            /^test$/i,
            /^dummy$/i,
            /^fake$/i,
            /^sample$/i,
            /^todo$/i,
            /^replace[_-]?me$/i,
        ];
        return placeholderPatterns.some(p => p.test(value));
    }
}
/**
 * Lakera Guard API client for professional prompt injection detection
 * @see https://docs.lakera.ai/docs/api
 */
export class LakeraGuardDetector {
    name = 'lakera-guard';
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.LAKERA_GUARD_API_KEY;
    }
    isAvailable() {
        return !!this.apiKey;
    }
    async detect(content) {
        if (!this.apiKey) {
            return [];
        }
        const findings = [];
        try {
            const response = await fetch('https://api.lakera.ai/v2/guard', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [{ role: 'user', content }],
                    breakdown: true
                })
            });
            if (!response.ok) {
                console.warn(`Lakera API error: ${response.status}`);
                return [];
            }
            const result = (await response.json());
            if (result.flagged && result.breakdown) {
                // Map Lakera categories to our threat taxonomy
                const categoryMap = {
                    prompt_injection: { category: 'PROMPT_INJECTION', severity: 'HIGH', aitech: ['AITech-1.1', 'AITech-1.2'] },
                    jailbreak: { category: 'PROMPT_INJECTION', severity: 'CRITICAL', aitech: ['AITech-1.1'] },
                    unknown_links: { category: 'TRANSITIVE_TRUST', severity: 'MEDIUM', aitech: ['AITech-1.2'] },
                    pii: { category: 'DATA_EXFILTRATION', severity: 'MEDIUM', aitech: ['AITech-8.2'] },
                };
                for (const [category, data] of Object.entries(result.breakdown)) {
                    if (data?.detected) {
                        const mapping = categoryMap[category] || {
                            category: 'PROMPT_INJECTION',
                            severity: 'HIGH',
                            aitech: []
                        };
                        findings.push({
                            category: mapping.category,
                            aitech: mapping.aitech,
                            severity: mapping.severity,
                            description: `Lakera Guard detected: ${category}`,
                            match: `[Lakera Guard: ${category}]`,
                            location: 'Content',
                            confidence: 0.95, // Lakera Guard has high accuracy
                            detector: 'lakera-guard'
                        });
                    }
                }
            }
        }
        catch (error) {
            console.warn(`Lakera Guard scan failed: ${error}`);
        }
        return findings;
    }
}
/**
 * Security scanner implementing Cisco skill-scanner threat taxonomy
 * Uses proper secret detection tools (gitleaks/trufflehog) when available
 * Optionally integrates with Lakera Guard for professional prompt injection detection
 */
export class SecurityScanner {
    name = 'security-scanner';
    secretDetector = null;
    lakeraDetector = null;
    detectorInitialized = false;
    options;
    constructor(options = {}) {
        this.options = {
            preferredDetectors: ['gitleaks', 'trufflehog', 'fallback'],
            ...options
        };
        // Initialize Lakera Guard if enabled
        if (options.enableLakera || options.lakeraApiKey) {
            this.lakeraDetector = new LakeraGuardDetector(options.lakeraApiKey);
        }
    }
    async initializeSecretDetector() {
        if (this.detectorInitialized)
            return;
        this.detectorInitialized = true;
        if (this.options.skipSecretDetection) {
            return;
        }
        const detectors = {
            gitleaks: new GitleaksDetector(),
            trufflehog: new TruffleHogDetector(),
            fallback: new FallbackSecretDetector()
        };
        for (const detectorName of this.options.preferredDetectors) {
            const detector = detectors[detectorName];
            if (detector && await detector.isAvailable()) {
                this.secretDetector = detector;
                console.log(`  Using ${detector.name} for secret detection`);
                return;
            }
        }
    }
    async evaluate(skill) {
        const result = await this.scan(skill);
        const observations = [
            `Security Status: ${result.isSecure ? 'SECURE' : 'ISSUES FOUND'}`,
            `Max Severity: ${result.maxSeverity}`,
            `Total Findings: ${result.findings.length}`,
            `Scan Duration: ${result.scanDuration}ms`
        ];
        // Group findings by category
        const byCategory = new Map();
        for (const finding of result.findings) {
            const list = byCategory.get(finding.category) || [];
            list.push(finding);
            byCategory.set(finding.category, list);
        }
        for (const [category, findings] of byCategory) {
            observations.push(`${category}: ${findings.length} finding(s)`);
        }
        const suggestions = [];
        if (!result.isSecure) {
            for (const finding of result.findings.slice(0, 5)) {
                suggestions.push(`[${finding.severity}] ${finding.description}: "${finding.match.slice(0, 50)}..."`);
            }
        }
        return {
            evaluator: this.name,
            evaluatedAt: new Date().toISOString(),
            scores: {
                security: {
                    score: result.isSecure ? 100 : Math.max(0, 100 - result.findings.length * 20),
                    confidence: 0.8,
                    reasoning: result.isSecure
                        ? 'No security threats detected'
                        : `Found ${result.findings.length} potential security issues`
                }
            },
            observations,
            suggestions,
            raw: result
        };
    }
    async scan(skill) {
        const startTime = Date.now();
        const findings = [];
        const secretFindings = [];
        const content = skill.content + '\n' + skill.description;
        const lines = content.split('\n');
        // Initialize secret detector (once)
        await this.initializeSecretDetector();
        // 1. Scan for secrets using proper detector
        if (this.secretDetector) {
            try {
                const detected = await this.secretDetector.detect(content, skill.path);
                secretFindings.push(...detected);
                findings.push(...detected);
            }
            catch (error) {
                console.error(`Secret detection failed: ${error}`);
            }
        }
        // 2. Scan with Lakera Guard (professional prompt injection detection)
        if (this.lakeraDetector && this.lakeraDetector.isAvailable()) {
            try {
                if (this.options.verbose) {
                    console.log('  Scanning with Lakera Guard...');
                }
                const lakeraFindings = await this.lakeraDetector.detect(content);
                findings.push(...lakeraFindings);
                if (lakeraFindings.length > 0 && this.options.verbose) {
                    console.log(`  Lakera Guard found ${lakeraFindings.length} issue(s)`);
                }
            }
            catch (error) {
                console.warn(`Lakera Guard scan failed: ${error}`);
            }
        }
        // 3. Scan for other threat categories (pattern-based)
        for (const [category, threat] of Object.entries(THREAT_TAXONOMY)) {
            for (const pattern of threat.patterns) {
                // Search line by line for better location reporting
                for (let i = 0; i < lines.length; i++) {
                    const match = lines[i].match(pattern);
                    if (match) {
                        findings.push({
                            category: category,
                            aitech: [...threat.aitech],
                            severity: threat.severity,
                            description: threat.description,
                            match: match[0],
                            location: `Line ${i + 1}`,
                            line: i + 1,
                            confidence: 0.7,
                            detector: 'pattern-scanner'
                        });
                    }
                }
            }
        }
        // Deduplicate findings (same match at same location)
        const unique = new Map();
        for (const f of findings) {
            const key = `${f.category}:${f.location}:${f.match}`;
            if (!unique.has(key)) {
                unique.set(key, f);
            }
        }
        const uniqueFindings = [...unique.values()];
        // Calculate max severity
        const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'SAFE'];
        let maxSeverity = 'SAFE';
        for (const f of uniqueFindings) {
            if (severityOrder.indexOf(f.severity) < severityOrder.indexOf(maxSeverity)) {
                maxSeverity = f.severity;
            }
        }
        return {
            isSecure: uniqueFindings.length === 0,
            maxSeverity,
            findings: uniqueFindings,
            scanDuration: Date.now() - startTime,
            secretsResult: {
                secretsDetected: secretFindings.length > 0,
                findings: secretFindings,
                detector: this.secretDetector?.name
            }
        };
    }
}
//# sourceMappingURL=security-scanner.js.map