import { session } from 'electron';
import type { ExternalAppCookie } from './ExternalAppAdapter';

/**
 * Reads cookies matching one invocation URL from the Provider-selected browser profile.
 * @param partition - Trusted Provider runtime partition, never an adapter-supplied profile ID.
 * @param url - Validated HTTPS source, also checked by the live grant broker before and after this call.
 * @returns Matching cookie values only; callers must keep them out of logs and renderer IPC.
 */
export async function readExternalAppCookies(
    partition: string,
    url: string,
): Promise<readonly ExternalAppCookie[]> {
    if (new URL(url).protocol !== 'https:')
        throw new Error('HTTPS cookie scope required.');
    const cookies = await session.fromPartition(partition).cookies.get({ url });
    return cookies.map(
        ({ name, value, domain, path, secure, httpOnly, expirationDate }) => ({
            name,
            value,
            domain: domain ?? '',
            path: path ?? '/',
            secure: secure ?? false,
            httpOnly: httpOnly ?? false,
            expirationDate,
        }),
    );
}
