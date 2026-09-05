import { app, type BrowserWindow } from 'electron';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/** Receives a platform event that can change external fullscreen ownership. */
export type ExternalFullscreenChanged = () => void;

/** Monitors platform fullscreen state without exposing platform details to callers. */
export interface ExternalFullscreenMonitor {
  /** Whether this platform requires explicit external fullscreen monitoring. */
  readonly supported: boolean;
  /** Starts monitoring and returns the current state. */
  start(
    applicationWindow: BrowserWindow,
    onChanged: ExternalFullscreenChanged,
  ): boolean;
  /** Re-evaluates and returns the current state. */
  refresh(applicationWindow: BrowserWindow): boolean;
  /** Returns the platform-observed topmost state when it is available. */
  isAlwaysOnTopApplied(applicationWindow: BrowserWindow): boolean | undefined;
  /** Stops monitoring and releases native resources. */
  stop(): void;
}

/** Native Windows implementation of the shared fullscreen monitor API. */
interface WindowsExternalFullscreenAddon {
  /** Determines whether an external fullscreen window owns the foreground. */
  isExternalFullscreenActive(nativeWindowHandle: Buffer): boolean;
  /** Determines whether the application HWND still has WS_EX_TOPMOST. */
  isApplicationWindowTopmost(nativeWindowHandle: Buffer): boolean;
  /** Starts foreground and window-geometry event monitoring. */
  startExternalFullscreenMonitor(
    nativeWindowHandle: Buffer,
    onChanged: ExternalFullscreenChanged,
  ): boolean;
  /** Stops foreground and window-geometry event monitoring. */
  stopExternalFullscreenMonitor(): void;
}

/** Defines the shared addon manifest file name constant. */
const ADDON_MANIFEST_FILE_NAME = 'kawaikara_windows_foreground.json';
/** Defines the legacy unversioned addon file name constant. */
const LEGACY_ADDON_FILE_NAME = 'kawaikara_windows_foreground.node';
/** Defines the versioned addon file name pattern constant. */
const VERSIONED_ADDON_FILE_NAME_PATTERN =
  /^kawaikara_windows_foreground-[a-f0-9]{16}\.node$/;

/** Creates the platform implementation of the shared fullscreen monitor. */
export function createExternalFullscreenMonitor(): ExternalFullscreenMonitor {
  return process.platform === 'win32'
    ? new WindowsExternalFullscreenMonitor()
    : new UnsupportedExternalFullscreenMonitor();
}

/** No-op implementation for platforms whose native window policy handles fullscreen. */
class UnsupportedExternalFullscreenMonitor
implements ExternalFullscreenMonitor {
  /** Whether this platform requires explicit external fullscreen monitoring. */
  readonly supported = false;

  /** Starts monitoring and returns the current state. */
  start(
    _applicationWindow: BrowserWindow,
    _onChanged: ExternalFullscreenChanged,
  ): boolean {
    return false;
  }

  /** Re-evaluates and returns the current state. */
  refresh(_applicationWindow: BrowserWindow): boolean {
    return false;
  }

  /** Returns no platform state when explicit monitoring is unsupported. */
  isAlwaysOnTopApplied(
    _applicationWindow: BrowserWindow,
  ): boolean | undefined {
    return undefined;
  }

  /** Stops monitoring and releases native resources. */
  stop(): void {}
}

/** Windows event-driven implementation of the shared fullscreen monitor. */
class WindowsExternalFullscreenMonitor implements ExternalFullscreenMonitor {
  /** Whether this platform requires explicit external fullscreen monitoring. */
  readonly supported = true;

  /** The native addon value. */
  private addon?: WindowsExternalFullscreenAddon;
  /** Whether loading the native addon has failed. */
  private loadFailed = false;

  /** Starts monitoring and returns the current state. */
  start(
    applicationWindow: BrowserWindow,
    onChanged: ExternalFullscreenChanged,
  ): boolean {
    if (applicationWindow.isDestroyed()) return false;
    try {
      return this.loadAddon()?.startExternalFullscreenMonitor(
        applicationWindow.getNativeWindowHandle(),
        onChanged,
      ) ?? false;
    } catch (error) {
      this.handleFailure(
        'Kawaikara could not start Windows fullscreen monitoring.',
        error,
      );
      return false;
    }
  }

  /** Re-evaluates and returns the current state. */
  refresh(applicationWindow: BrowserWindow): boolean {
    if (applicationWindow.isDestroyed()) return false;
    try {
      return this.loadAddon()?.isExternalFullscreenActive(
        applicationWindow.getNativeWindowHandle(),
      ) ?? false;
    } catch (error) {
      this.handleFailure(
        'Kawaikara could not inspect the Windows foreground window.',
        error,
      );
      return false;
    }
  }

  /** Reads the actual Win32 topmost flag instead of Electron's cached value. */
  isAlwaysOnTopApplied(
    applicationWindow: BrowserWindow,
  ): boolean | undefined {
    if (applicationWindow.isDestroyed()) return false;
    try {
      return this.loadAddon()?.isApplicationWindowTopmost(
        applicationWindow.getNativeWindowHandle(),
      );
    } catch (error) {
      this.handleFailure(
        'Kawaikara could not inspect its Windows topmost state.',
        error,
      );
      return undefined;
    }
  }

  /** Stops monitoring and releases native resources. */
  stop(): void {
    try {
      this.addon?.stopExternalFullscreenMonitor();
    } catch (error) {
      console.warn(
        'Kawaikara could not stop Windows fullscreen monitoring.',
        error,
      );
    }
  }

  /** Loads the native implementation. */
  private loadAddon(): WindowsExternalFullscreenAddon | undefined {
    if (this.addon || this.loadFailed) return this.addon;
    const nativeDirectory = app.isPackaged
      ? path.join(process.resourcesPath, 'native')
      : path.join(app.getAppPath(), 'dist', 'native');
    try {
      const addonPath = resolveAddonPath(nativeDirectory);
      const requireFromApplication = createRequire(__filename);
      this.addon = requireFromApplication(
        addonPath,
      ) as WindowsExternalFullscreenAddon;
      return this.addon;
    } catch (error) {
      this.handleFailure(
        'Kawaikara could not load its Windows foreground-window bridge.',
        error,
      );
      return undefined;
    }
  }

  /** Records a terminal native bridge failure. */
  private handleFailure(message: string, error: unknown): void {
    this.stop();
    this.addon = undefined;
    this.loadFailed = true;
    console.warn(message, error);
  }
}

/** Resolves the immutable addon selected by the native-build manifest. */
function resolveAddonPath(nativeDirectory: string): string {
  const manifestPath = path.join(nativeDirectory, ADDON_MANIFEST_FILE_NAME);
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
    fileName = LEGACY_ADDON_FILE_NAME;
  }
  return path.join(nativeDirectory, fileName);
}
