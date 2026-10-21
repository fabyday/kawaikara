import type {
    DistributionConnection,
    DistributionFormat,
    DistributionPlatform,
    DistributionTarget,
    ExternalAppDistribution,
} from '../../../../Common/ExternalAppDistribution';

/** Normalizes a public HTTPS resource, including manifest-relative URLs. */
export function publicResourceUrl(value: unknown, base?: string): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 4096)
        throw new Error('Invalid resource URL.');
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
        throw new Error('Public HTTPS resources are required.');
    return url.href;
}
/** Resolves resources under an explicit process-local test origin, otherwise requiring public HTTPS. */
export function distributionResourceUrl(
    value: unknown,
    base?: string,
    testOrigin?: string,
): string {
    if (testOrigin && typeof value === 'string' && value.trim() && value.length <= 4096) {
        const url = new URL(value, base);
        if (url.origin === testOrigin && !url.username && !url.password)
            return url.href;
    }
    return publicResourceUrl(value, base);
}
/** Rejects missing objects/arrays before any field is inspected. */
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid distribution object.');
    return value as Record<string, unknown>;
}
/** Reads bounded human-readable text without interpreting markup. */
function text(value: unknown, limit: number): string {
    if (
        typeof value !== 'string' ||
        !value.trim() ||
        value.length > limit ||
        /[\u0000-\u001f\u007f]/.test(value)
    )
        throw new Error('Invalid distribution text.');
    return value.trim();
}
/** Reads optional public URLs from an object. */
function url(
    value: unknown,
    base: string,
    testOrigin?: string,
): string | undefined {
    return value === undefined
        ? undefined
        : distributionResourceUrl(value, base, testOrigin);
}
/** Parses an advisory connection declaration without loading adapters or granting access. */
function connection(
    value: unknown,
    base: string,
    testOrigin?: string,
): DistributionConnection | undefined {
    if (value === undefined) return undefined;
    const item = object(value);
    if (
        !Number.isSafeInteger(item.protocolVersion) ||
        Number(item.protocolVersion) < 1 ||
        item.transport !== 'loopback'
    )
        throw new Error('Invalid connection declaration.');
    const launchScheme =
        item.launchScheme === undefined
            ? undefined
            : text(item.launchScheme, 100);
    if (
        launchScheme &&
        (!/^[a-z][a-z0-9+.-]*$/.test(launchScheme) ||
            /^(https?|file|javascript|data|shell|ms-settings)$/.test(
                /** Validated display-only OS scheme. */
                launchScheme,
            ))
    )
        throw new Error('Invalid application scheme.');
    return {
        /** Validated advisory handshake version. */
        protocolVersion: item.protocolVersion as number,
        /** Known advisory transport. */
        transport: 'loopback',
        /** Validated display-only OS scheme. */
        launchScheme,
        /** Resolved public guide. */
        guideUrl: url(item.guideUrl, base, testOrigin),
    };
}
/**
 * Parses a data-only manifest and resolves relative URLs against the original document URL.
 * @param value Untrusted JSON; unknown fields never reach the returned descriptor.
 * @param sourceUrl Public document URL, retained even after CDN redirects.
 * @param expectedId Optional Provider-declared identity; mismatches fail before caching.
 * @param testOrigin Optional native-process test origin; never supplied by manifest contents.
 * @returns Validated presentation and target records, without executable commands/permissions.
 */
export function parseDistribution(
    value: unknown,
    sourceUrl: string,
    expectedId?: string,
    testOrigin?: string,
): ExternalAppDistribution {
    const base = distributionResourceUrl(sourceUrl, undefined, testOrigin);
    const item = object(value);
    const id = text(item.id, 160);
    if (
        item.schemaVersion !== 1 ||
        !/^[a-z0-9]+(?:[.-][a-z0-9-]+)+$/.test(id) ||
        (expectedId && expectedId !== id)
    )
        throw new Error('Unsupported distribution identity or schema.');
    if (!Array.isArray(item.targets) || item.targets.length > 64)
        throw new Error('Invalid distribution targets.');
    const targets = item.targets.map((value): DistributionTarget => {
        const target = object(value);
        if (
            typeof target.os !== 'string' ||
            typeof target.arch !== 'string' ||
            !['darwin', 'win32', 'linux'].includes(target.os) ||
            !['arm64', 'x64', 'ia32', 'arm', 'universal'].includes(
                String(target.arch),
            )
        )
            throw new Error('Unsupported target.');
        let artifact: DistributionTarget['artifact'];
        if (target.artifact !== undefined) {
            const candidate = object(target.artifact);
            if (
                typeof candidate.format !== 'string' ||
                ![
                    'dmg',
                    'pkg',
                    'zip',
                    'exe',
                    'msi',
                    'appimage',
                    'deb',
                    'rpm',
                    'tar.gz',
                ].includes(String(candidate.format)) ||
                typeof candidate.sha256 !== 'string' ||
                !/^[a-f\d]{64}$/i.test(candidate.sha256)
            )
                throw new Error('Invalid distribution artifact.');
            artifact = {
                url: distributionResourceUrl(candidate.url, base, testOrigin),
                sha256: candidate.sha256.toLowerCase(),
                format: candidate.format as DistributionFormat,
            };
        }
        return {
            os: target.os as DistributionPlatform,
            arch: target.arch as DistributionTarget['arch'],
            version:
                target.version === undefined
                    ? undefined
                    : text(target.version, 80),
            guideUrl: url(target.guideUrl, base, testOrigin),
            artifact,
            connection: connection(target.connection, base, testOrigin),
        };
    });
    return {
        /** Supported distribution document version. */
        schemaVersion: 1,
        /** Validated stable product identity. */
        id,
        /** Bounded display name. */
        name: text(item.name, 160),
        /** Resolved public icon resource. */
        icon: url(item.icon, base, testOrigin),
        /** Public fallback product page. */
        homepage: url(item.homepage, base, testOrigin),
        /** Resolved public guide. */
        guideUrl: url(item.guideUrl, base, testOrigin),
        /** Advisory connection metadata without credentials. */
        connection: connection(item.connection, base, testOrigin),
        /** Validated target variants. */
        targets,
    };
}
/** Selects an exact native CPU before a universal build, preserving manifest preference order. */
export function selectDistributionTarget(
    descriptor: ExternalAppDistribution,
    os: string,
    arch: string,
): DistributionTarget | undefined {
    return (
        descriptor.targets.find(
            (target) => target.os === os && target.arch === arch,
        ) ??
        descriptor.targets.find(
            (target) => target.os === os && target.arch === 'universal',
        )
    );
}
/** Only OS-owned installer opening is supported; archives/packages otherwise remain manual downloads. */
export function distributionAction(
    descriptor: ExternalAppDistribution,
    target: DistributionTarget | undefined,
): 'install' | 'download' | 'guide' | 'unsupported' {
    if (!target) return 'unsupported';
    if (target.artifact) {
        if (
            (target.os === 'darwin' &&
                ['dmg', 'pkg'].includes(target.artifact.format)) ||
            (target.os === 'win32' &&
                ['exe', 'msi'].includes(target.artifact.format))
        )
            return 'install';
        return 'download';
    }
    return target.guideUrl || descriptor.guideUrl || descriptor.homepage
        ? 'guide'
        : 'unsupported';
}
