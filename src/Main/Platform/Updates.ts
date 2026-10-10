import { autoUpdater as nativeAutoUpdater } from 'electron';
import type { AppUpdater } from 'electron-updater';
import {
    configureWindowsUpdateSignatureVerification,
    type WindowsUpdateSignatureLogger,
} from './Windows/UpdateSignature';
import { waitForNativeUpdate } from './macOS/UpdateStaging';

/** Configure the platform's installer and downloaded-code verification requirements. */
export function configureUpdateInstaller(
    updater: AppUpdater,
    executable: string,
    logger: WindowsUpdateSignatureLogger,
): void {
    if (process.platform !== 'win32') return;
    updater.disableWebInstaller = true;
    configureWindowsUpdateSignatureVerification(updater, executable, logger);
}

/** In-app consent replaces the NSIS wizard; other updaters retain their native behavior. */
export function shouldInstallUpdateSilently(): boolean {
    return process.platform === 'win32';
}

/** Stage Squirrel before irreversible shutdown; other updaters finish staging during download. */
export async function prepareNativeUpdate(): Promise<void> {
    if (process.platform !== 'darwin') return;
    await waitForNativeUpdate(nativeAutoUpdater, () =>
        nativeAutoUpdater.checkForUpdates(),
    );
}
