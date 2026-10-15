import { app, shell } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { ExternalDownloaderPlatform } from '../../../Common/Download';
import type {
    ExternalDownloaderInstallation,
    ExternalDownloaderReleaseArtifact,
    ExternalDownloaderReleaseManifest,
    InstalledExternalDownloaderApp,
} from '../ExternalDownloaderSupport';
import {
    downloadVerifiedArtifact,
    EXTERNAL_DOWNLOADER_APP_NAME,
    isFile,
    runExternalDownloaderCommand,
} from '../ExternalDownloaderSupport';

/** Native target used in companion release metadata. */
export const platform: ExternalDownloaderPlatform = 'win32';
/** Preferred distributable formats supported by this installer. */
export const artifactKinds: readonly string[] = ['exe'];
/** Native installation mechanism exposed without OS-name checks. */
export function getExternalDownloaderInstallMethod():
    | 'copy-application'
    | 'installer'
    | 'unsupported' {
    return 'installer';
}
/** Discover the companion through native application registration. */
export async function findInstalledExternalDownloaderApp(): Promise<InstalledExternalDownloaderApp | null> {
    const candidates = [
        process.env.YT_DOWNLOADER_APP_PATH?.trim(),
        process.env.LOCALAPPDATA
            ? path.join(
                  process.env.LOCALAPPDATA,
                  'Programs',
                  'yt-section-downloader',
                  `${EXTERNAL_DOWNLOADER_APP_NAME}.exe`,
              )
            : undefined,
        process.env.PROGRAMFILES
            ? path.join(
                  process.env.PROGRAMFILES,
                  EXTERNAL_DOWNLOADER_APP_NAME,
                  `${EXTERNAL_DOWNLOADER_APP_NAME}.exe`,
              )
            : undefined,
    ];
    for (const candidate of candidates) {
        if (candidate && (await isFile(candidate)))
            return {
                /** The path value. */
                path: candidate,
            };
    }
    try {
        await runExternalDownloaderCommand('reg.exe', [
            'query',
            'HKCU\\Software\\Classes\\yt-downloader\\shell\\open\\command',
            '/ve',
        ]);
        return {};
    } catch {
        return null;
    }
}

/** Performs the download external downloader Windows installer operation. */
async function downloadExternalDownloaderWindowsInstaller(
    manifest: ExternalDownloaderReleaseManifest,
    artifact: ExternalDownloaderReleaseArtifact,
): Promise<string> {
    if (artifact.kind !== 'exe') {
        throw new Error(
            `Unsupported Windows release artifact: ${artifact.kind}`,
        );
    }
    const filePath = path.join(
        app.getPath('downloads'),
        `YT-Section-Downloader-${manifest.version}-${artifact.arch}.exe`,
    );
    await downloadVerifiedArtifact(artifact, filePath);
    return filePath;
}

/** Launch the installed executable or its registered protocol handler. */
export async function launchExternalDownloader(
    deepLink: string,
    appPath?: string,
): Promise<void> {
    if (appPath) {
        const child = spawn(appPath, [deepLink], {
            detached: true,
            stdio: 'ignore',
            windowsHide: false,
        });
        await new Promise<void>((resolve, reject) => {
            child.once('spawn', resolve);
            child.once('error', reject);
        });
        child.unref();
    } else {
        await shell.openExternal(deepLink);
    }
}
/** Download the verified installer and hand it to the native shell. */
export async function installExternalDownloaderArtifact(
    manifest: ExternalDownloaderReleaseManifest,
    artifact: ExternalDownloaderReleaseArtifact,
): Promise<ExternalDownloaderInstallation> {
    const installerPath = await downloadExternalDownloaderWindowsInstaller(
        manifest,
        artifact,
    );
    const launchError = await shell.openPath(installerPath);
    if (launchError) throw new Error(launchError);
    return {
        /** Completion is owned by the native installer. */
        installerStarted: true,
    };
}
