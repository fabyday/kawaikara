import { lookup } from 'node:dns/promises';
import { get } from 'node:https';
import { get as getLocal, type IncomingMessage } from 'node:http';
import { BlockList, isIP } from 'node:net';

/** Global IPv6 space accepted for public resources. */
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
/** Special-purpose ranges inside global unicast are not public app hosts. */
const reservedV6 = new BlockList();
reservedV6.addSubnet('2001::', 23, 'ipv6');
reservedV6.addSubnet('2001:db8::', 32, 'ipv6');
reservedV6.addSubnet('2002::', 16, 'ipv6');
reservedV6.addSubnet('3fff::', 20, 'ipv6');
import { distributionResourceUrl } from './Descriptor';

/** Rejects local, special-use and mapped addresses before opening a public resource socket. */
export function isPublicAddress(address: string): boolean {
    if (isIP(address) === 4) {
        const [a, b] = address.split('.').map(Number);
        return !(
            a === 0 ||
            a === 10 ||
            a === 127 ||
            a >= 224 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && (b === 168 || b === 0 || b === 2)) ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 198 && [18, 19, 51].includes(b)) ||
            (a === 203 && b === 0)
        );
    }
    return (
        isIP(address) === 6 &&
        globalV6.check(address, 'ipv6') &&
        !reservedV6.check(address, 'ipv6')
    );
}
/**
 * Opens a bounded public HTTPS request without Electron cookies, credentials, or private network access.
 * DNS results are checked and pinned to the socket; every redirect repeats validation.
 */
export async function openPublicResource(
    value: string,
    signal: AbortSignal,
    redirects = 0,
    testOrigin?: string,
): Promise<IncomingMessage> {
    const url = new URL(distributionResourceUrl(value, undefined, testOrigin));
    const local = url.origin === testOrigin;
    const host = url.hostname.replace(/^\[|\]$/g, '');
    signal.throwIfAborted();
    let abort: (() => void) | undefined;
    const canceled = new Promise<never>((_resolve, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
    });
    const addresses = await (
        isIP(host)
            ? Promise.resolve([{ address: host, family: isIP(host) }])
            : Promise.race([lookup(host, { all: true }), canceled])
    ).finally(() => {
        if (abort) signal.removeEventListener('abort', abort);
    });
    signal.throwIfAborted();
    if (
        !addresses.length ||
        addresses.some(
            (item) =>
                !isPublicAddress(item.address) &&
                !(local && item.address === '127.0.0.1'),
        )
    )
        throw new Error('Only public internet resources are allowed.');
    const chosen = addresses[0];
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
        const request = (local ? getLocal : get)(
            url,
            {
                signal,
                headers: {
                    'User-Agent': 'Kawaikara-Distribution/1',
                    Accept: '*/*',
                },
                lookup: (_hostname, options, callback) => {
                    if (options.all) callback(null, [chosen]);
                    else callback(null, chosen.address, chosen.family);
                },
            },
            resolve,
        );
        request.on('error', reject);
    });
    if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
        response.destroy();
        if (redirects >= 5 || !response.headers.location)
            throw new Error('Too many resource redirects.');
        return openPublicResource(
            distributionResourceUrl(
                response.headers.location,
                url.href,
                testOrigin,
            ),
            signal,
            redirects + 1,
            testOrigin,
        );
    }
    if (response.statusCode !== 200) {
        response.destroy();
        throw new Error(`Resource request failed (${response.statusCode}).`);
    }
    return response;
}
/** Downloads a bounded metadata/image buffer; large installer bytes use a separate streaming path. */
export async function readPublicResource(
    url: string,
    maxBytes: number,
    testOrigin?: string,
): Promise<Buffer> {
    const response = await openPublicResource(
        url,
        AbortSignal.timeout(15_000),
        0,
        testOrigin,
    );
    const chunks: Buffer[] = [];
    let size = 0;
    try {
        for await (const value of response) {
            const chunk = Buffer.from(value);
            size += chunk.length;
            if (size > maxBytes)
                throw new Error('Resource exceeds size limit.');
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    } finally {
        response.destroy();
    }
}
