import { app, shell } from 'electron';
import fs from 'node:fs/promises';
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
    pathExists,
    runExternalDownloaderCommand,
} from '../ExternalDownloaderSupport';

/** Native target used in companion release metadata. */
export const platform: ExternalDownloaderPlatform = 'darwin';
/** Preferred distributable formats supported by this installer. */
export const artifactKinds: readonly string[] = ['dmg', 'zip'];
/** Native installation mechanism exposed without OS-name checks. */
export function getExternalDownloaderInstallMethod():
    | 'copy-application'
    | 'installer'
    | 'unsupported' {
    return 'copy-application';
}
/** Discover the companion through native application registration. */
export async function findInstalledExternalDownloaderApp(): Promise<InstalledExternalDownloaderApp | null> {
    const candidates = [
        process.env.YT_DOWNLOADER_APP_PATH?.trim(),
        path.join(app.getPath('home'), 'Applications', APP_BUNDLE_NAME),
        path.join('/Applications', APP_BUNDLE_NAME),
    ];
    for (const candidate of candidates) {
        if (!candidate) continue;
        const installed = await inspectMacApp(path.resolve(candidate));
        if (installed) return installed;
    }
    try {
        const output = await runExternalDownloaderCommand('/usr/bin/mdfind', [
            `kMDItemCFBundleIdentifier == '${APP_BUNDLE_ID}'`,
        ]);
        for (const candidate of output.split(/\r?\n/)) {
            if (!candidate.endsWith('.app')) continue;
            const installed = await inspectMacApp(candidate);
            if (installed) return installed;
        }
    } catch {
        // Known install locations are sufficient when Spotlight is disabled.
    }
    return null;
}

/** Expected companion application bundle. */
const APP_BUNDLE_NAME = `${EXTERNAL_DOWNLOADER_APP_NAME}.app`;
/** Identity required before replacing a companion app. */
const APP_BUNDLE_ID = 'com.ytdownloader.app';

/** Installs the external downloader mac artifact. */
async function installExternalDownloaderMacArtifact(
    manifest: ExternalDownloaderReleaseManifest,
    artifact: ExternalDownloaderReleaseArtifact,
): Promise<InstalledExternalDownloaderApp> {
    const temporaryDirectory = await fs.mkdtemp(
        path.join(app.getPath('temp'), 'kawaikara-ytd-install-'),
    );
    const archivePath = path.join(
        temporaryDirectory,
        `download.${artifact.kind}`,
    );
    const extractPath = path.join(temporaryDirectory, 'extract');
    let mounted = false;
    try {
        await downloadVerifiedArtifact(artifact, archivePath);
        await removeQuarantine(archivePath, false);
        if (artifact.kind === 'dmg') {
            await fs.mkdir(extractPath);
            await runExternalDownloaderCommand('/usr/bin/hdiutil', [
                'attach',
                '-readonly',
                '-nobrowse',
                '-mountpoint',
                extractPath,
                archivePath,
            ]);
            mounted = true;
        } else if (artifact.kind === 'zip') {
            await fs.mkdir(extractPath);
            await runExternalDownloaderCommand('/usr/bin/ditto', [
                '-x',
                '-k',
                archivePath,
                extractPath,
            ]);
        } else {
            throw new Error(
                `Unsupported macOS release artifact: ${artifact.kind}`,
            );
        }

        const sourceApp = await findSingleAppBundle(extractPath);
        if (!(await inspectMacApp(sourceApp))) {
            throw new Error(
                `The downloaded app bundle is not ${EXTERNAL_DOWNLOADER_APP_NAME}.`,
            );
        }
        const applicationsDirectory = path.join(
            app.getPath('home'),
            'Applications',
        );
        await fs.mkdir(applicationsDirectory, { recursive: true });
        const targetApp = path.join(applicationsDirectory, APP_BUNDLE_NAME);
        const stagingApp = path.join(
            applicationsDirectory,
            `.YT-Section-Downloader-${process.pid}-${Date.now()}.app`,
        );
        await runExternalDownloaderCommand('/usr/bin/ditto', [
            sourceApp,
            stagingApp,
        ]);
        try {
            if (!(await inspectMacApp(stagingApp))) {
                throw new Error(
                    'The staged YT Downloader app failed identity validation.',
                );
            }
            await removeQuarantine(stagingApp, true);
            if (await pathExists(targetApp)) await shell.trashItem(targetApp);
            await fs.rename(stagingApp, targetApp);
        } catch (error) {
            await fs.rm(stagingApp, { recursive: true, force: true });
            throw error;
        }
        const installed = await inspectMacApp(targetApp);
        if (!installed)
            throw new Error('YT Downloader installation validation failed.');
        return {
            ...installed,
            /** The version value. */
            version: installed.version ?? manifest.version,
        };
    } finally {
        if (mounted) {
            await runExternalDownloaderCommand('/usr/bin/hdiutil', [
                'detach',
                extractPath,
            ]).catch(() => undefined);
        }
        await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
}

/** Performs the inspect mac app operation. */
async function inspectMacApp(
    appPath: string,
): Promise<InstalledExternalDownloaderApp | null> {
    try {
        if (!(await fs.stat(appPath)).isDirectory()) return null;
        const infoPlist = path.join(appPath, 'Contents', 'Info.plist');
        const bundleId = (
            await runExternalDownloaderCommand('/usr/bin/plutil', [
                '-extract',
                'CFBundleIdentifier',
                'raw',
                '-o',
                '-',
                infoPlist,
            ])
        ).trim();
        if (bundleId !== APP_BUNDLE_ID) return null;
        const version = (
            await runExternalDownloaderCommand('/usr/bin/plutil', [
                '-extract',
                'CFBundleShortVersionString',
                'raw',
                '-o',
                '-',
                infoPlist,
            ])
        ).trim();
        return {
            /** The path value. */
            path: appPath,
            /** The version value. */
            version: version || undefined,
        };
    } catch {
        return null;
    }
}

/** Finds the single app bundle. */
async function findSingleAppBundle(directory: string): Promise<string> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const apps = entries
        .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
        .map((entry) => path.join(directory, entry.name));
    if (apps.length !== 1) {
        throw new Error(
            'The release must contain exactly one top-level app bundle.',
        );
    }
    return apps[0];
}

/** Removes the quarantine. */
async function removeQuarantine(
    target: string,
    recursive: boolean,
): Promise<void> {
    try {
        await runExternalDownloaderCommand('/usr/bin/xattr', [
            recursive ? '-dr' : '-d',
            'com.apple.quarantine',
            target,
        ]);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : String(error || '');
        if (!/No such xattr|No such file/i.test(message)) throw error;
    }
}

/** Open the installed app bundle or its registered protocol handler. */
export async function launchExternalDownloader(
    deepLink: string,
    appPath?: string,
): Promise<void> {
    if (appPath)
        await runExternalDownloaderCommand('/usr/bin/open', [
            '-a',
            appPath,
            deepLink,
        ]);
    else await shell.openExternal(deepLink);
}
/** Copy and validate the application bundle before reporting completion. */
export async function installExternalDownloaderArtifact(
    manifest: ExternalDownloaderReleaseManifest,
    artifact: ExternalDownloaderReleaseArtifact,
): Promise<ExternalDownloaderInstallation> {
    const installed = await installExternalDownloaderMacArtifact(
        manifest,
        artifact,
    );
    return {
        /** Installation completed in this process. */
        installerStarted: false,
        /** Validated installed version. */
        version: installed.version ?? manifest.version,
    };
}
