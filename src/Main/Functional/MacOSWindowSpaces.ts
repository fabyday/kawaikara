import { app, type BrowserWindow } from 'electron';
import { createRequire } from 'node:module';
import path from 'node:path';

/** Native bridge for presenting Kawaikara PiP across macOS fullscreen Spaces. */
interface MacOSWindowSpacesAddon {
  /** Sets the full screen auxiliary. */
  setFullScreenAuxiliary(nativeWindowHandle: Buffer): void;
  /** Clears the full screen auxiliary. */
  clearFullScreenAuxiliary(nativeWindowHandle: Buffer): void;
}

/** Defines the shared addon file name constant. */
const ADDON_FILE_NAME = 'kawaikara_macos_window_spaces.node';
/** Stores the addon value. */
let addon: MacOSWindowSpacesAddon | undefined;
/** Stores the load failed value. */
let loadFailed = false;

/** Performs the enable mac OS full screen auxiliary operation. */
export function enableMacOSFullScreenAuxiliary(
  window: BrowserWindow,
): void {
  if (process.platform !== 'darwin' || window.isDestroyed()) return;
  loadAddon()?.setFullScreenAuxiliary(window.getNativeWindowHandle());
}

/** Performs the disable mac OS full screen auxiliary operation. */
export function disableMacOSFullScreenAuxiliary(
  window: BrowserWindow,
): void {
  if (process.platform !== 'darwin' || window.isDestroyed()) return;
  loadAddon()?.clearFullScreenAuxiliary(window.getNativeWindowHandle());
}

/** Loads the addon. */
function loadAddon(): MacOSWindowSpacesAddon | undefined {
  if (addon || loadFailed) return addon;
  const addonPath = app.isPackaged
    ? path.join(process.resourcesPath, 'native', ADDON_FILE_NAME)
    : path.join(app.getAppPath(), 'dist', 'native', ADDON_FILE_NAME);
  try {
    const requireFromApplication = createRequire(__filename);
    addon = requireFromApplication(addonPath) as MacOSWindowSpacesAddon;
    return addon;
  } catch (error) {
    loadFailed = true;
    console.warn(
      'Kawaikara could not load its macOS fullscreen Space bridge.',
      error,
    );
    return undefined;
  }
}
