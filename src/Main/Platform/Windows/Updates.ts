import type { AppUpdater } from 'electron-updater';
import type { UpdateLogger } from '../UpdateLogger';
import { configureWindowsUpdateSignatureVerification } from './UpdateSignature';

/** Configure the platform's installer and downloaded-code verification requirements. */
export function configureUpdateInstaller(
    updater: AppUpdater,
    executable: string,
    logger: UpdateLogger,
): void {
    updater.disableWebInstaller = true;
    configureWindowsUpdateSignatureVerification(updater, executable, logger);
}

/** In-app consent replaces the NSIS wizard; other updaters retain their native behavior. */
export function shouldInstallUpdateSilently(): boolean {
    return true;
}

/** Stage Squirrel before irreversible shutdown; other updaters finish staging during download. */
export async function prepareNativeUpdate(): Promise<void> {}
