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
} from '../../Common/PictureInPicture';
import { PAUSE_DOCUMENT_MEDIA_SCRIPT } from '../Inject/MediaCleanup';

/** Defines the shared navigation handoff settle ms constant. */
const NAVIGATION_HANDOFF_SETTLE_MS = 180;
/** Defines the shared internal video PiP margin constant. */
const INTERNAL_VIDEO_PIP_MARGIN = 20;

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
  if (!hasErrorCode(error, 'ERR_FAILED')) return false;

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

  try {
    await webContents.executeJavaScript(PAUSE_DOCUMENT_MEDIA_SCRIPT);
  } catch (error) {
    console.debug('The previous site document was unavailable during media cleanup.', error);
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
    if (!isRecoverableCrossSiteNavigationFailure(error, requestedUrl, currentUrl)) {
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
      if (isExpectedSpaNavigationHandoff(retryError, requestedUrl, retryUrl)) {
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
    `Navigation to ${requestedUrl} continued after Electron reported ERR_FAILED (${currentUrl}).`,
  );
}

/** Determines whether the error code condition applies. */
function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown
    }).code === code
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
export function createSiteCookieStore(siteSession: Session): SiteCookieStore {
  return {
    /** The list value. */
    list: async ({ domains }) => {
      const normalizedDomains = normalizeCookieQueryDomains(domains);
      const cookies = await siteSession.cookies.get({});
      return cookies
        .filter((cookie): cookie is Electron.Cookie & {
          /** The domain value. */
          domain: string;
        } =>
          typeof cookie.domain === 'string' &&
          cookieMatchesDomains(cookie.domain, normalizedDomains),
        )
        .map(({ name, domain }) => ({ name, domain
        }));
    },
    /** The clear value. */
    clear: async ({ domains, names }) => {
      const normalizedDomains = normalizeCookieQueryDomains(domains);
      const normalizedNames = names === undefined
        ? undefined
        : new Set(names.map(validateCookieName));
      const cookies = await siteSession.cookies.get({});
      const matchingCookies = cookies.filter(
        (cookie): cookie is Electron.Cookie & { domain: string
        } =>
          typeof cookie.domain === 'string' &&
          cookieMatchesDomains(cookie.domain, normalizedDomains) &&
          (normalizedNames === undefined || normalizedNames.has(cookie.name)),
      );
      await Promise.all(matchingCookies.map(async (cookie) => {
        const domain = cookie.domain.replace(/^\./, '');
        const cookiePath = cookie.path ?? '/';
        const pathName = cookiePath.startsWith('/') ? cookiePath : `/${cookiePath}`;
        const protocol = cookie.secure ? 'https:' : 'http:';
        await siteSession.cookies.remove(
          `${protocol}//${domain}${pathName}`,
          cookie.name,
        );
      }));
      return matchingCookies.length;
    },
  };
}

/** Normalizes the cookie query domains. */
function normalizeCookieQueryDomains(domains: readonly string[]): readonly string[] {
  if (domains.length === 0 || domains.length > 32) {
    throw new Error('Cookie queries require between 1 and 32 domains.');
  }
  return [...new Set(domains.map((domain) => {
    const normalized = domain.trim().toLowerCase();
    if (
      normalized.length > 253 ||
      !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(normalized) ||
      normalized.includes('..')
    ) {
      throw new Error(`Invalid cookie query domain: ${domain}`);
    }
    return normalized;
  }))];
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
  return queryDomains.some((domain) =>
    normalized === domain || normalized.endsWith(`.${domain}`),
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

  const primaryModifier = process.platform === 'darwin'
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
      if (process.platform === 'darwin' || input.shift) return false;
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
  const displays = screen.getAllDisplays();
  /** Performs the by ID operation. */
  const byId = (id: string | undefined) =>
    id ? displays.find((display) => String(display.id) === id) : undefined;
  const current = screen.getDisplayMatching(previousBounds);
  const display = preference.monitor.mode === 'display'
    ? byId(preference.monitor.displayId) ?? current
    : preference.monitor.mode === 'last'
      ? byId(preference.lastPlacement?.displayId) ?? current
      : current;
  const workArea = display.workArea;
  const width = Math.min(preferred.width, workArea.width);
  const height = Math.min(preferred.height, workArea.height);
  const availableWidth = Math.max(0, workArea.width - width);
  const availableHeight = Math.max(0, workArea.height - height);
  if (preference.position === 'last' && preference.lastPlacement) {
    return {
      /** The x value. */
      x: Math.round(workArea.x + availableWidth * preference.lastPlacement.xRatio),
      /** The y value. */
      y: Math.round(workArea.y + availableHeight * preference.lastPlacement.yRatio),
      /** The width value. */
      width,
      /** The height value. */
      height,
    };
  }
  const right = preference.position.endsWith('right');
  const bottom = preference.position.startsWith('bottom');
  return {
    /** The x value. */
    x: right
      ? workArea.x + workArea.width - width - INTERNAL_VIDEO_PIP_MARGIN
      : workArea.x + INTERNAL_VIDEO_PIP_MARGIN,
    /** The y value. */
    y: bottom
      ? workArea.y + workArea.height - height - INTERNAL_VIDEO_PIP_MARGIN
      : workArea.y + INTERNAL_VIDEO_PIP_MARGIN,
    /** The width value. */
    width,
    /** The height value. */
    height,
  };
}

/** Performs the capture internal video picture in picture placement operation. */
export function captureInternalVideoPictureInPicturePlacement(
  viewer: BrowserWindow,
): PictureInPictureLastPlacement | undefined {
  const bounds = viewer.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const availableWidth = Math.max(1, display.workArea.width - bounds.width);
  const availableHeight = Math.max(1, display.workArea.height - bounds.height);
  return {
    /** The display ID value. */
    displayId: String(display.id),
    /** The x ratio value. */
    xRatio: Math.min(
      1,
      Math.max(0, (bounds.x - display.workArea.x) / availableWidth),
    ),
    /** The y ratio value. */
    yRatio: Math.min(
      1,
      Math.max(0, (bounds.y - display.workArea.y) / availableHeight),
    ),
  };
}
