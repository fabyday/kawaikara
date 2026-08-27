import { app, Menu } from 'electron';
import path from 'node:path';
import { readStartupGraphicsMode } from './Preferences';
import { LoggingManager } from '../Manager/LoggingManager';
import { KAWAIKARA_PROTOCOL } from './ExternalOpen';
import { configureUserDataPaths, getKawaiDataPath } from './UserDataPaths';

/** Describes the pre initialized application contract. */
export interface PreInitializedApplication {
  /** The application log value. */
  readonly applicationLog: ReturnType<LoggingManager['createLogger']>;
  /** The logging value. */
  readonly logging: LoggingManager;
  /** The preference file path value. */
  readonly preferenceFilePath: string;
}

/** Configure process-wide Electron behavior that must be set before ready. */
export function preInitializeApplication(): PreInitializedApplication {
  configureUserDataPaths();
  Menu.setApplicationMenu(null);

  const logging = new LoggingManager();
  logging.initialize();
  const applicationLog = logging.createLogger('application');
  const preferenceFilePath = getKawaiDataPath('preferences.json');

  configureGraphics(preferenceFilePath, applicationLog);
  registerProtocolClient();
  return {
    /** The application log value. */
    applicationLog,
    /** The logging value. */
    logging,
    /** The preference file path value. */
    preferenceFilePath,
  };
}

/** Performs the configure graphics operation. */
function configureGraphics(
  preferenceFilePath: string,
  applicationLog: ReturnType<LoggingManager['createLogger']>,
): void {
  const forceSoftwareRendering =
    process.env.KAWAIKARA_FORCE_SOFTWARE_RENDERING === '1';
  const graphicsMode = forceSoftwareRendering
    ? 'software'
    : readStartupGraphicsMode(preferenceFilePath);

  // Electron GPU policy is process-wide. Native mpv decoding remains
  // independent and may still use VideoToolbox or D3D11 in software mode.
  process.env.MPV_HWDEC ??= 'auto-safe';

  if (graphicsMode === 'software') {
    app.disableHardwareAcceleration();
    applicationLog.info(
      forceSoftwareRendering
        ? 'Electron GPU acceleration: forced off.'
        : 'Electron graphics mode: software.',
    );
  } else {
    app.commandLine.appendSwitch('ignore-gpu-blocklist');
    app.commandLine.appendSwitch('enable-gpu-rasterization');
    app.commandLine.appendSwitch('enable-zero-copy');
    if (graphicsMode === 'capture') {
      if (process.platform === 'darwin') {
        appendDisabledChromiumFeature('avfoundation-overlays');
      } else if (process.platform === 'win32') {
        app.commandLine.appendSwitch(
          'disable_direct_composition_video_overlays',
          '1',
        );
      }
    }
    applicationLog.info(`Electron graphics mode: ${graphicsMode}.`);
  }

  applicationLog.info(`libmpv hardware decoding mode: ${process.env.MPV_HWDEC}.`);
}

/** Performs the append disabled chromium feature operation. */
function appendDisabledChromiumFeature(feature: string): void {
  const disabledFeatures = new Set(
    app.commandLine
      .getSwitchValue('disable-features')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  disabledFeatures.add(feature);
  app.commandLine.removeSwitch('disable-features');
  app.commandLine.appendSwitch(
    'disable-features',
    [...disabledFeatures].join(','),
  );
}

/** Registers the protocol client. */
function registerProtocolClient(): void {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(KAWAIKARA_PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
    return;
  }
  app.setAsDefaultProtocolClient(KAWAIKARA_PROTOCOL);
}
