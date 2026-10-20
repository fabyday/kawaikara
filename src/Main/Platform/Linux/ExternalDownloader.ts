import { shell } from 'electron';
import type { ExternalDownloaderPlatform } from '../../../Common/Download';
import type {
    ExternalDownloaderInstallation,
    ExternalDownloaderReleaseArtifact,
    ExternalDownloaderReleaseManifest,
    InstalledExternalDownloaderApp,
} from '../ExternalDownloaderSupport';
import { runExternalDownloaderCommand } from '../ExternalDownloaderSupport';

/** Native target used in companion release metadata. */
export const platform: ExternalDownloaderPlatform = 'linux';
/** Preferred distributable formats supported by this installer. */
export const artifactKinds: readonly string[] = [];
/** Native installation mechanism exposed without OS-name checks. */
export function getExternalDownloaderInstallMethod():
    | 'copy-application'
    | 'installer'
    | 'unsupported' {
    return 'unsupported';
}
/** Discover the companion through native application registration. */
export async function findInstalledExternalDownloaderApp(): Promise<InstalledExternalDownloaderApp | null> {
    try {
        const output = await runExternalDownloaderCommand('xdg-mime', [
            'query',
            'default',
            'x-scheme-handler/kawai-downloader',
        ]);
        return output.trim() ? {} : null;
    } catch {
        return null;
    }
}

/** Launch the registered desktop protocol handler. */
export async function launchExternalDownloader(
    deepLink: string,
    _appPath?: string,
): Promise<void> {
    await shell.openExternal(deepLink);
}
/** Reject automatic installation before any download or native command. */
export async function installExternalDownloaderArtifact(
    _manifest: ExternalDownloaderReleaseManifest,
    _artifact: ExternalDownloaderReleaseArtifact,
): Promise<ExternalDownloaderInstallation> {
    throw new Error(
        'Automatic downloader installation is unsupported on this platform.',
    );
}
