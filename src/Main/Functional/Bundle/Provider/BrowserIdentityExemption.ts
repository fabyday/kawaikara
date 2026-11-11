import { matchesSiteUrlHost } from '@kawaikara/site-api';

/**
 * Authentication hosts whose documents must see the real browser platform.
 *
 * Login services fingerprint the browser in page JavaScript and compare the
 * result with the request User-Agent. A Provider identity that claims another
 * platform (for example CHZZK's macOS Chrome UA on Linux) makes Naver reject
 * correct CAPTCHA answers indefinitely.
 */
export const BROWSER_IDENTITY_EXEMPT_HOSTS: readonly string[] = [
    'nid.naver.com',
];

/**
 * Determines whether a main-frame destination suspends the Provider identity.
 *
 * @param url - The main-frame navigation URL.
 * @returns True when the URL belongs to an exempt authentication host.
 */
export function isBrowserIdentityExemptUrl(url: string): boolean {
    return matchesSiteUrlHost(url, BROWSER_IDENTITY_EXEMPT_HOSTS);
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
