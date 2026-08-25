import { app, type BrowserWindow } from 'electron';
import { createRequire } from 'node:module';
import path from 'node:path';

/** Native bridge for presenting Kawaikara PiP across macOS fullscreen Spaces. */
interface MacOSWindowSpacesAddon {
  setFullScreenAuxiliary(nativeWindowHandle: Buffer): void;
  clearFullScreenAuxiliary(nativeWindowHandle: Buffer): void;
}

const ADDON_FILE_NAME = 'kawaikara_macos_window_spaces.node';
let addon: MacOSWindowSpacesAddon | undefined;
let loadFailed = false;

export function enableMacOSFullScreenAuxiliary(
  window: BrowserWindow,
): void {
  if (process.platform !== 'darwin' || window.isDestroyed()) return;
  loadAddon()?.setFullScreenAuxiliary(window.getNativeWindowHandle());
}

export function disableMacOSFullScreenAuxiliary(
  window: BrowserWindow,
): void {
  if (process.platform !== 'darwin' || window.isDestroyed()) return;
  loadAddon()?.clearFullScreenAuxiliary(window.getNativeWindowHandle());
}

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
