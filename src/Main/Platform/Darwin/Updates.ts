import { autoUpdater as nativeAutoUpdater } from 'electron';
import type { AppUpdater } from 'electron-updater';
import type { UpdateLogger } from '../UpdateLogger';
import { waitForNativeUpdate } from './UpdateStaging';

/** Configure the platform's installer and downloaded-code verification requirements. */
export function configureUpdateInstaller(
    updater: AppUpdater,
    executable: string,
    logger: UpdateLogger,
): void {}

/** In-app consent replaces the NSIS wizard; other updaters retain their native behavior. */
export function shouldInstallUpdateSilently(): boolean {
    return false;
}

/** Stage Squirrel before irreversible shutdown; other updaters finish staging during download. */
export async function prepareNativeUpdate(): Promise<void> {
    await waitForNativeUpdate(nativeAutoUpdater, () =>
        nativeAutoUpdater.checkForUpdates(),
    );
}
