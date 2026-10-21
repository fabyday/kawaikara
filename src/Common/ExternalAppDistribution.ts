/** Supported target operating systems in a public distribution descriptor. */
export type DistributionPlatform = 'darwin' | 'win32' | 'linux';
/** Artifact formats describe data, never commands or executable arguments. */
export type DistributionFormat =
    | 'dmg'
    | 'pkg'
    | 'zip'
    | 'exe'
    | 'msi'
    | 'appimage'
    | 'deb'
    | 'rpm'
    | 'tar.gz';
/** Connection information is advisory; adapters and permissions remain locally registered. */
export interface DistributionConnection {
    /** Version of the existing Kawaikara handshake. */
    readonly protocolVersion: number;
    /** Declared transport, not a remote endpoint or credential. */
    readonly transport: 'loopback';
    /** Optional OS-registered application scheme; never executed from metadata. */
    readonly launchScheme?: string;
    /** Public instructions for starting or connecting this application. */
    readonly guideUrl?: string;
}
/** Downloadable release artifact for one target. */
export interface DistributionArtifact {
    /** Public HTTPS download URL. */
    readonly url: string;
    /** Exact SHA-256 digest of the distributed bytes. */
    readonly sha256: string;
    /** Native package/container format. */
    readonly format: DistributionFormat;
}
/** One platform/architecture variant, optionally providing instructions only. */
export interface DistributionTarget {
    /** Native operating system. */
    readonly os: DistributionPlatform;
    /** Exact process architecture, or universal fallback. */
    readonly arch: 'arm64' | 'x64' | 'ia32' | 'arm' | 'universal';
    /** Version of this variant. */
    readonly version?: string;
    /** OS-specific installation instructions, overriding the common page. */
    readonly guideUrl?: string;
    /** Optional verified download. */
    readonly artifact?: DistributionArtifact;
    /** Optional complete override of the common connection information. */
    readonly connection?: DistributionConnection;
}
/** Public, data-only document independent of registration/permission declarations. */
export interface ExternalAppDistribution {
    /** Distribution schema version; unknown versions are rejected. */
    readonly schemaVersion: 1;
    /** Stable product ID; an ID alone does not authenticate a publisher. */
    readonly id: string;
    /** Display text, not markup. */
    readonly name: string;
    /** Optional public image URL; decoded and cached by Main. */
    readonly icon?: string;
    /** Public product page. */
    readonly homepage?: string;
    /** Common installation guide used when a target has no specific guide. */
    readonly guideUrl?: string;
    /** Common connection declaration. */
    readonly connection?: DistributionConnection;
    /** Available OS/CPU variants in preference order; exact CPU wins over universal. */
    readonly targets: readonly DistributionTarget[];
}
/** Safe renderer preview; source metadata does not declare installation/liveness. */
export interface DistributionPreview {
    /** Opaque Main-owned selection used for subsequent actions. */
    readonly token: string;
    /** User-selected source, displayed before any installation. */
    readonly sourceUrl: string;
    /** Validated public descriptor. */
    readonly descriptor: ExternalAppDistribution;
    /** Native target chosen by Main; absent if this environment is unsupported. */
    readonly target?: DistributionTarget;
    /** Safe PNG data URL from the presentation cache. */
    readonly icon?: string;
    /** Indicates the last verified document is being used offline. */
    readonly cached: boolean;
    /** Capabilities of this local host, not instructions from the server. */
    readonly action: 'install' | 'download' | 'guide' | 'unsupported';
}
/** Outcome never implies installed, paired, or authorized. */
export type DistributionActionResult =
    'canceled' | 'downloaded' | 'installer-opened' | 'page-opened';
/** Trusted application UI bridge; all action URLs are resolved by Main. */
export interface ExternalAppDistributionApi {
    /** Reads a public manifest and previews its matching target. Does not install or register. */
    preview(url: string, expectedId?: string): Promise<DistributionPreview>;
    /** Executes an explicit user action for an immutable Main-owned preview. */
    act(
        token: string,
        action: 'install' | 'download' | 'guide' | 'connection-guide',
    ): Promise<DistributionActionResult>;
}
