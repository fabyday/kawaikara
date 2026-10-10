import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isVideoPath } from '../Video/VideoLibrary';

/** Defines the shared Kawaikara protocol constant. */
export const KAWAIKARA_PROTOCOL = 'kawaikara';

/** Defines the shared max deep link length constant. */
const MAX_DEEP_LINK_LENGTH = 16_384;
/** Defines the shared max target URL length constant. */
const MAX_TARGET_URL_LENGTH = 8_192;

/** Describes the external open request contract. */
export interface ExternalOpenRequest {
    /** The target URL value. */
    readonly targetUrl: string;
    /** Absolute local video supplied by the operating system, never by a deep link. */
    readonly localVideoPath?: string;
}

/** Parses the external open URL. */
export function parseExternalOpenUrl(
    value: string,
): ExternalOpenRequest | undefined {
    if (!value || value.length > MAX_DEEP_LINK_LENGTH) {
        return undefined;
    }

    try {
        const deepLink = new URL(value);
        if (
            deepLink.protocol !== `${KAWAIKARA_PROTOCOL}:` ||
            deepLink.hostname !== 'open' ||
            (deepLink.pathname !== '' && deepLink.pathname !== '/') ||
            deepLink.username ||
            deepLink.password ||
            deepLink.port ||
            deepLink.searchParams.getAll('url').length !== 1
        ) {
            return undefined;
        }

        const targetValue = deepLink.searchParams.get('url');
        if (!targetValue || targetValue.length > MAX_TARGET_URL_LENGTH) {
            return undefined;
        }

        const target = new URL(targetValue);
        if (
            target.protocol !== 'https:' ||
            target.username ||
            target.password ||
            target.port
        ) {
            return undefined;
        }

        // Provider availability is intentionally resolved after Bundle discovery.
        // ExternalOpen is used before Electron is ready, when installed and
        // development Bundle manifests have not been loaded yet. ProviderManager later
        // matches this URL against each live Provider's contributes.address.hosts.
        return {
            /** The target URL value. */
            targetUrl: target.href,
        };
    } catch {
        return undefined;
    }
}

/** Parses the external open arguments. */
export function parseExternalOpenArguments(
    args: readonly string[],
): ExternalOpenRequest[] {
    return args.flatMap((value, index) => {
        const request =
            parseExternalOpenUrl(value) ??
            (index > 0 ? parseExternalVideoFile(value) : undefined);
        return request ? [request] : [];
    });
}

/** Accepts absolute video arguments without granting local access to protocol URLs. */
export function parseExternalVideoFile(
    value: string,
): ExternalOpenRequest | undefined {
    if (!value || value.length > 4096 || value.includes('\0')) return undefined;
    try {
        const filename = value.startsWith('file:')
            ? fileURLToPath(value)
            : value;
        if (
            !path.isAbsolute(filename) ||
            /^\\\\[?.]\\/.test(filename) ||
            !isVideoPath(filename)
        )
            return undefined;
        return {
            /** Canonical file URL used in diagnostics. */
            targetUrl: pathToFileURL(filename).href,
            /** OS-provided path validated again by the video library before playback. */
            localVideoPath: filename,
        };
    } catch {
        return undefined;
    }
}
