export interface InstallResult {
    success: boolean;
    presetName: string;
    filesCreated: string[];
    warnings: string[];
}
export declare function installPreset(nameOrPath: string, projectRoot: string, options?: {
    force?: boolean;
    config?: Record<string, string | number | boolean>;
}): Promise<InstallResult>;
//# sourceMappingURL=installer.d.ts.map