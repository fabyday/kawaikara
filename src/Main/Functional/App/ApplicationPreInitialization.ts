import { configureCaptureCompatibleGraphics } from '../../Platform/Graphics';
import { app, Menu } from 'electron';
import { UPDATE_TEST_PROFILE } from '../../../Common/BuildConfig';
import path from 'node:path';
import { readStartupGraphicsMode } from './Preferences';
import { LoggingManager } from '../../Manager/LoggingManager';
import { KAWAIKARA_PROTOCOL } from '../External/ExternalOpen';
import { configureUserDataPaths, getKawaiDataPath } from './UserDataPaths';

/** Describes the pre initialized application contract. */
export interface PreInitializedApplication {
    /** The application log value. */
    readonly applicationLog: ReturnType<LoggingManager['getLogger']>;
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
    const applicationLog = logging.getLogger('application');
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
export function configureGraphics(
    preferenceFilePath: string,
    applicationLog: ReturnType<LoggingManager['getLogger']>,
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
        // Preserve Chromium's driver workarounds and default rasterization policy.
        // Capture compatibility changes overlays only, not GPU safety decisions.
        if (graphicsMode === 'capture') {
            configureCaptureCompatibleGraphics();
        }
        applicationLog.info(`Electron graphics mode: ${graphicsMode}.`);
    }

    applicationLog.info(
        `libmpv hardware decoding mode: ${process.env.MPV_HWDEC}.`,
    );
}

/** Registers the protocol client. */
function registerProtocolClient(): void {
    if (UPDATE_TEST_PROFILE) return;
    if (process.defaultApp && process.argv[1]) {
        app.setAsDefaultProtocolClient(KAWAIKARA_PROTOCOL, process.execPath, [
            path.resolve(process.argv[1]),
        ]);
        return;
    }
    app.setAsDefaultProtocolClient(KAWAIKARA_PROTOCOL);
}
