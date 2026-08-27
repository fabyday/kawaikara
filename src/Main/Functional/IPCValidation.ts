import { ipcMain } from 'electron';
import type {
  ApplicationLinkId,
  AppLocale,
  AppTheme,
  DevToolsMode,
  IpcChannel,
} from '../../Common/IPC';

/** Removes the IPC handlers. */
export function removeIpcHandlers(channels: readonly IpcChannel[]): void {
  for (const channel of channels) ipcMain.removeHandler(channel);
}

/** Determines whether the application link ID condition applies. */
export function isApplicationLinkId(
  value: unknown,
): value is ApplicationLinkId {
  return (
    typeof value === 'string' &&
    ['website', 'github', 'discord', 'developerYouTube'].includes(value)
  );
}

/** Determines whether the dev tools mode condition applies. */
export function isDevToolsMode(value: unknown): value is DevToolsMode {
  return (
    typeof value === 'string' &&
    ['left', 'right', 'bottom', 'undocked', 'detach'].includes(value)
  );
}

/** Determines whether the you tube URL condition applies. */
export function isYouTubeUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(
      host,
    );
  } catch {
    return false;
  }
}

/** Performs the require path string operation. */
export function requirePathString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('A local path is required.');
  }
  return value;
}

/** Performs the require search query operation. */
export function requireSearchQuery(value: unknown): string {
  if (typeof value !== 'string' || value.length > 260) {
    throw new TypeError('A valid search query is required.');
  }
  return value;
}

/** Performs the require identifier operation. */
export function requireIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value || value.length > 260) {
    throw new TypeError(`${label} id must be a valid string.`);
  }
  return value;
}

/** Performs the require app locale operation. */
export function requireAppLocale(value: unknown): AppLocale {
  if (
    value !== 'system' &&
    value !== 'ko-KR' &&
    value !== 'en-US' &&
    value !== 'ja-JP'
  ) {
    throw new TypeError('A supported app locale is required.');
  }
  return value;
}

/** Performs the require app theme operation. */
export function requireAppTheme(value: unknown): AppTheme {
  if (value !== 'dark' && value !== 'light') {
    throw new TypeError('A supported app theme is required.');
  }
  return value;
}

/** Reads the requested graphics mode. */
export function readRequestedGraphicsMode(
  patch: unknown,
): 'native' | 'capture' | 'software' | undefined {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return undefined;
  }
  const value = (patch as { readonly graphicsMode?: unknown
  }).graphicsMode;
  return value === 'native' || value === 'capture' || value === 'software'
    ? value
    : undefined;
}

/** Determines whether the graphics restart confirmed condition applies. */
export function isGraphicsRestartConfirmed(options: unknown): boolean {
  return Boolean(
    options &&
      typeof options === 'object' &&
      !Array.isArray(options) &&
      (options as { readonly restartForGraphicsChange?: unknown
      })
        .restartForGraphicsChange === true,
  );
}
