/** One explicit loopback fixture replaces a single Provider-declared app source for this process. */
export interface LocalDistributionTest {
    /** Exact HTTP loopback origin; arbitrary local networks remain inaccessible. */
    readonly origin: string;
    /** Product identity whose manifest may be replaced. */
    readonly appId: string;
    /** Test document, including icon/artifact URLs resolved relative to it. */
    readonly manifestUrl: string;
}

/**
 * Reads a deliberate local test override without changing normal public-resource policy.
 * @param value Startup environment value: app.id=http://127.0.0.1:PORT/manifest.json.
 * @returns Validated single-product override, or undefined when not configured.
 * @throws Invalid identities, credentials, non-loopback hosts or privileged/absent ports.
 * @remarks Works for packaged and development hosts; adapter mode and permissions remain independent.
 */
export function localDistributionTest(
    value?: string,
): LocalDistributionTest | undefined {
    if (value === undefined) return undefined;
    const separator = value.indexOf('=');
    const appId = value.slice(0, separator);
    if (separator < 1 || !/^[a-z0-9]+(?:[.-][a-z0-9-]+)+$/.test(appId))
        throw new Error('Invalid local distribution app ID.');
    const url = new URL(value.slice(separator + 1));
    if (
        url.protocol !== 'http:' ||
        url.hostname !== '127.0.0.1' ||
        Number(url.port) < 1024 ||
        !url.port ||
        url.username ||
        url.password ||
        url.hash
    )
        throw new Error(
            'Local distribution tests require http://127.0.0.1:PORT (1024–65535).',
        );
    return {
        /** Product explicitly selected for local testing. */
        appId,
        /** Single allowed loopback origin. */
        origin: url.origin,
        /** Exact local manifest source. */
        manifestUrl: url.href,
    };
}
