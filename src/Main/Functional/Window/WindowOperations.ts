import {
    getPrimaryShortcutModifier,
    supportsRedoWithY,
} from '../../Platform/Keyboard';
import path from 'node:path';
import {
    app,
    screen,
    type BrowserWindow,
    type Input,
    type Rectangle,
    type Session,
    type WebContents,
} from 'electron';
import type { SiteCookieStore } from '@kawaikara/site-api';
import type {
    PictureInPictureLastPlacement,
    PictureInPicturePlacementPreference,
} from '../../../Common/PictureInPicture';
import { PAUSE_DOCUMENT_MEDIA_SCRIPT } from '../../Inject/MediaCleanup';
import {
    capturePictureInPicturePlacement,
    fitPictureInPictureSize,
    resolvePictureInPictureBounds,
    resolvePictureInPictureDisplay,
} from './PictureInPicture/PictureInPictureRuntime';

/** Defines the shared navigation handoff settle ms constant. */
const NAVIGATION_HANDOFF_SETTLE_MS = 180;
/** Outgoing renderer cleanup must not hold a new Provider hostage. */
const NAVIGATION_MEDIA_CLEANUP_TIMEOUT_MS = 200;

/** Resolves the MPV addon path. */
export function resolveMpvAddonPath(): string {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'mpv', 'mpv_addon.node');
    }
    return path.resolve(
        __dirname,
        '../../node_modules/electron-mpv-video/native/mpv-addon/build/Release/mpv_addon.node',
    );
}

/** Determines whether the expected spa navigation handoff condition applies. */
function isExpectedSpaNavigationHandoff(
    error: unknown,
    requestedUrl: string,
    currentUrl: string,
): boolean {
    if (
        !hasErrorCode(error, 'ERR_FAILED') &&
        !hasErrorCode(error, 'ERR_ABORTED')
    ) {
        return false;
    }

    try {
        const requested = new URL(requestedUrl);
        const current = new URL(currentUrl);
        return (
            ['http:', 'https:'].includes(current.protocol) &&
            normalizeNavigationHost(current.hostname) ===
                normalizeNavigationHost(requested.hostname)
        );
    } catch {
        return false;
    }
}

/** Prepares the current document for navigation. */
export async function prepareCurrentDocumentForNavigation(
    webContents: WebContents,
): Promise<void> {
    if (
        webContents.isDestroyed() ||
        !isScriptableDocumentUrl(webContents.getURL())
    ) {
        return;
    }

    // executeJavaScript waits for loading to stop. Stop the outgoing document
    // first, including stalled images/iframes, rather than waiting for its network.
    if (webContents.isLoading()) webContents.stop();
    const outgoingUrl = webContents.getURL();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        const cleanup = webContents.executeJavaScript(
            `if (location.href === ${JSON.stringify(outgoingUrl)}) { ${PAUSE_DOCUMENT_MEDIA_SCRIPT} }`,
        );
        await Promise.race([
            cleanup,
            new Promise<void>((resolve) => {
                timeout = setTimeout(
                    resolve,
                    NAVIGATION_MEDIA_CLEANUP_TIMEOUT_MS,
                );
            }),
        ]);
    } catch (error) {
        console.debug(
            'The previous site document was unavailable during media cleanup.',
            error,
        );
    } finally {
        if (timeout !== undefined) clearTimeout(timeout);
    }

    if (!webContents.isDestroyed()) {
        webContents.stop();
        await delay(32);
    }
}

/** Loads the URL with navigation recovery. */
export async function loadURLWithNavigationRecovery(
    webContents: WebContents,
    requestedUrl: string,
): Promise<void> {
    try {
        await webContents.loadURL(requestedUrl);
        return;
    } catch (error) {
        let currentUrl = webContents.getURL();
        if (isExpectedSpaNavigationHandoff(error, requestedUrl, currentUrl)) {
            logExpectedNavigationHandoff(requestedUrl, currentUrl);
            return;
        }
        if (
            !isRecoverableCrossSiteNavigationFailure(
                error,
                requestedUrl,
                currentUrl,
            )
        ) {
            throw error;
        }

        await delay(NAVIGATION_HANDOFF_SETTLE_MS);
        currentUrl = webContents.getURL();
        if (isExpectedSpaNavigationHandoff(error, requestedUrl, currentUrl)) {
            logExpectedNavigationHandoff(requestedUrl, currentUrl);
            return;
        }

        console.warn(
            `Retrying navigation to ${requestedUrl} after the active site rejected the initial hand-off (${currentUrl}).`,
        );
        webContents.stop();
        await webContents.loadURL('about:blank');

        try {
            await webContents.loadURL(requestedUrl);
        } catch (retryError) {
            await delay(NAVIGATION_HANDOFF_SETTLE_MS);
            const retryUrl = webContents.getURL();
            if (
                isExpectedSpaNavigationHandoff(
                    retryError,
                    requestedUrl,
                    retryUrl,
                )
            ) {
                logExpectedNavigationHandoff(requestedUrl, retryUrl);
                return;
            }
            throw retryError;
        }
    }
}

/** Determines whether the recoverable cross site navigation failure condition applies. */
function isRecoverableCrossSiteNavigationFailure(
    error: unknown,
    requestedUrl: string,
    currentUrl: string,
): boolean {
    if (!hasErrorCode(error, 'ERR_FAILED')) return false;

    try {
        const requested = new URL(requestedUrl);
        const current = new URL(currentUrl);
        return (
            ['http:', 'https:'].includes(requested.protocol) &&
            ['http:', 'https:'].includes(current.protocol) &&
            normalizeNavigationHost(current.hostname) !==
                normalizeNavigationHost(requested.hostname)
        );
    } catch {
        return false;
    }
}

/** Performs the log expected navigation handoff operation. */
function logExpectedNavigationHandoff(
    requestedUrl: string,
    currentUrl: string,
): void {
    console.debug(
        `Navigation to ${requestedUrl} continued after Electron reported a navigation hand-off (${currentUrl}).`,
    );
}

/** Determines whether the error code condition applies. */
function hasErrorCode(error: unknown, code: string): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === code
    );
}

/** Determines whether the scriptable document URL condition applies. */
function isScriptableDocumentUrl(url: string): boolean {
    try {
        return ['file:', 'http:', 'https:'].includes(new URL(url).protocol);
    } catch {
        return false;
    }
}

/** Performs the delay operation. */
function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Normalizes the navigation host. */
function normalizeNavigationHost(hostname: string): string {
    return hostname.toLowerCase().replace(/^www\./, '');
}

/** Creates the site cookie store. */
export function createSiteCookieStore(
    siteSession: Session,
    /** Revalidates ownership after asynchronous reads before mutating a shared Session. */
    requireActive: () => void = () => undefined,
): SiteCookieStore {
    return {
        /** The list value. */
        list: async ({ domains }) => {
            requireActive();
            const normalizedDomains = normalizeCookieQueryDomains(domains);
            const cookies = await siteSession.cookies.get({});
            requireActive();
            return cookies
                .filter(
                    (
                        cookie,
                    ): cookie is Electron.Cookie & {
                        /** The domain value. */
                        domain: string;
                    } =>
                        typeof cookie.domain === 'string' &&
                        cookieMatchesDomains(cookie.domain, normalizedDomains),
                )
                .map(({ name, domain }) => ({ name, domain }));
        },
        /** The clear value. */
        clear: async ({ domains, names }) => {
            requireActive();
            const normalizedDomains = normalizeCookieQueryDomains(domains);
            const normalizedNames =
                names === undefined
                    ? undefined
                    : new Set(names.map(validateCookieName));
            const cookies = await siteSession.cookies.get({});
            requireActive();
            const matchingCookies = cookies.filter(
                (cookie): cookie is Electron.Cookie & { domain: string } =>
                    typeof cookie.domain === 'string' &&
                    cookieMatchesDomains(cookie.domain, normalizedDomains) &&
                    (normalizedNames === undefined ||
                        normalizedNames.has(cookie.name)),
            );
            await Promise.all(
                matchingCookies.map(async (cookie) => {
                    const domain = cookie.domain.replace(/^\./, '');
                    const cookiePath = cookie.path ?? '/';
                    const pathName = cookiePath.startsWith('/')
                        ? cookiePath
                        : `/${cookiePath}`;
                    const protocol = cookie.secure ? 'https:' : 'http:';
                    await siteSession.cookies.remove(
                        `${protocol}//${domain}${pathName}`,
                        cookie.name,
                    );
                }),
            );
            return matchingCookies.length;
        },
    };
}

/** Normalizes the cookie query domains. */
function normalizeCookieQueryDomains(
    domains: readonly string[],
): readonly string[] {
    if (domains.length === 0 || domains.length > 32) {
        throw new Error('Cookie queries require between 1 and 32 domains.');
    }
    return [
        ...new Set(
            domains.map((domain) => {
                const normalized = domain.trim().toLowerCase();
                if (
                    normalized.length > 253 ||
                    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(normalized) ||
                    normalized.includes('..')
                ) {
                    throw new Error(`Invalid cookie query domain: ${domain}`);
                }
                return normalized;
            }),
        ),
    ];
}

/** Validates the cookie name. */
function validateCookieName(name: string): string {
    if (!name || name.length > 256 || /[\u0000-\u0020\u007f;,]/.test(name)) {
        throw new Error('Invalid cookie name.');
    }
    return name;
}

/** Performs the cookie matches domains operation. */
function cookieMatchesDomains(
    cookieDomain: string,
    queryDomains: readonly string[],
): boolean {
    const normalized = cookieDomain.replace(/^\./, '').toLowerCase();
    return queryDomains.some(
        (domain) => normalized === domain || normalized.endsWith(`.${domain}`),
    );
}

/** Restore standard text-editing accelerators after removing Electron's menu. */
export function handleNativeEditingShortcut(
    webContents: WebContents,
    input: Input,
    editing: boolean,
): boolean {
    if (
        !editing ||
        input.type !== 'keyDown' ||
        input.isAutoRepeat ||
        input.isComposing ||
        input.alt
    ) {
        return false;
    }

    const primaryModifier =
        getPrimaryShortcutModifier() === 'meta'
            ? input.meta && !input.control
            : input.control && !input.meta;
    if (!primaryModifier) return false;

    switch (input.key.toLowerCase()) {
        case 'a':
            if (input.shift) return false;
            webContents.selectAll();
            return true;
        case 'c':
            if (input.shift) return false;
            webContents.copy();
            return true;
        case 'v':
            if (input.shift) return false;
            webContents.paste();
            return true;
        case 'x':
            if (input.shift) return false;
            webContents.cut();
            return true;
        case 'z':
            if (input.shift) webContents.redo();
            else webContents.undo();
            return true;
        case 'y':
            if (!supportsRedoWithY() || input.shift) return false;
            webContents.redo();
            return true;
        default:
            return false;
    }
}

/** Normalizes the video dimension. */
export function normalizeVideoDimension(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? Math.round(value)
        : 0;
}

/** Resolves the internal video picture in picture bounds. */
export function resolveInternalVideoPictureInPictureBounds(
    previousBounds: Rectangle,
    preferred: {
        /** The width value. */
        readonly width: number;
        /** The height value. */
        readonly height: number;
    },
    preference: PictureInPicturePlacementPreference,
): Rectangle {
    const display = resolvePictureInPictureDisplay(previousBounds, preference);
    const size = fitPictureInPictureSize(preferred, display.workArea);
    return resolvePictureInPictureBounds(
        display.workArea,
        size.width,
        size.height,
        preference,
    );
}

/** Performs the capture internal video picture in picture placement operation. */
export function captureInternalVideoPictureInPicturePlacement(
    viewer: BrowserWindow,
): PictureInPictureLastPlacement | undefined {
    return capturePictureInPicturePlacement(viewer);
}
