import { app, type BrowserWindow } from 'electron';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/** Native bridge for inspecting the external foreground window on Windows. */
interface WindowsForegroundWindowAddon {
  /** Determines whether an external fullscreen window owns the foreground. */
  isExternalFullscreenForeground(nativeWindowHandle: Buffer): boolean;
}

/** Defines the shared addon manifest file name constant. */
const ADDON_MANIFEST_FILE_NAME = 'kawaikara_windows_foreground.json';
/** Defines the legacy unversioned addon file name constant. */
const LEGACY_ADDON_FILE_NAME = 'kawaikara_windows_foreground.node';
/** Defines the versioned addon file name pattern constant. */
const VERSIONED_ADDON_FILE_NAME_PATTERN =
  /^kawaikara_windows_foreground-[a-f0-9]{16}\.node$/;
/** Stores the addon value. */
let addon: WindowsForegroundWindowAddon | undefined;
/** Stores the load failed value. */
let loadFailed = false;

/** Determines whether an external fullscreen window owns the foreground. */
export function isWindowsExternalFullscreenForeground(
  applicationWindow: BrowserWindow,
): boolean {
  if (process.platform !== 'win32' || applicationWindow.isDestroyed()) {
    return false;
  }
  try {
    return loadAddon()?.isExternalFullscreenForeground(
      applicationWindow.getNativeWindowHandle(),
    ) ?? false;
  } catch (error) {
    addon = undefined;
    loadFailed = true;
    console.warn(
      'Kawaikara could not inspect the Windows foreground window.',
      error,
    );
    return false;
  }
}

/** Loads the addon. */
function loadAddon(): WindowsForegroundWindowAddon | undefined {
  if (addon || loadFailed) return addon;
  const nativeDirectory = app.isPackaged
    ? path.join(process.resourcesPath, 'native')
    : path.join(app.getAppPath(), 'dist', 'native');
  try {
    const addonPath = resolveAddonPath(nativeDirectory);
    const requireFromApplication = createRequire(__filename);
    addon = requireFromApplication(addonPath) as WindowsForegroundWindowAddon;
    return addon;
  } catch (error) {
    loadFailed = true;
    console.warn(
      'Kawaikara could not load its Windows foreground-window bridge.',
      error,
    );
    return undefined;
  }
}

/** Resolves the immutable addon selected by the native-build manifest. */
function resolveAddonPath(nativeDirectory: string): string {
  const manifestPath = path.join(
    nativeDirectory,
    ADDON_MANIFEST_FILE_NAME,
  );
  let fileName: string;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      /** The selected addon file value. */
      readonly file?: unknown;
    };
    if (
      typeof manifest.file !== 'string' ||
      !VERSIONED_ADDON_FILE_NAME_PATTERN.test(manifest.file)
    ) {
      throw new Error(`Invalid Windows native manifest: ${manifestPath}`);
    }
    fileName = manifest.file;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    // Keep developer checkouts and older packages usable until build:native
    // has generated the immutable addon manifest for the first time.
    fileName = LEGACY_ADDON_FILE_NAME;
  }
  return path.join(nativeDirectory, fileName);
}
