import { matchesSiteUrlHost } from '@kawaikara/site-api';

/**
 * Determines whether a main-frame destination suspends a Provider identity.
 *
 * @param url - The main-frame navigation URL.
 * @param exemptHosts - The Provider's declared `browserIdentity.exemptHosts`.
 * @returns True when the URL belongs to one of the exempt hosts or their subdomains.
 */
export function isBrowserIdentityExemptUrl(
    url: string,
    exemptHosts: readonly string[] | undefined,
): boolean {
    if (!exemptHosts?.length) return false;
    return matchesSiteUrlHost(url, exemptHosts);
}

/**
 * Creates a reduced Chrome user agent for the platform Electron actually runs on.
 *
 * @param chromeVersion - Electron's Chromium version, such as `process.versions.chrome`.
 * @param platform - The Node.js platform identifier.
 * @returns A Chrome-style UA without Electron or application product tokens.
 */
export function createPlatformChromeUserAgent(
    chromeVersion: string,
    platform: NodeJS.Platform,
): string {
    const major = chromeVersion.split('.')[0];
    const platformToken =
        platform === 'win32'
            ? 'Windows NT 10.0; Win64; x64'
            : platform === 'darwin'
              ? 'Macintosh; Intel Mac OS X 10_15_7'
              : 'X11; Linux x86_64';
    return `Mozilla/5.0 (${platformToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}
