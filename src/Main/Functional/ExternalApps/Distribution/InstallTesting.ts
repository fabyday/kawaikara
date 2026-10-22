import path from 'node:path';
import {
    cp,
    mkdir,
    mkdtemp,
    readdir,
    realpath,
    rename,
    rm,
} from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { inspectMacApp } from '../../../Platform/Darwin/ExternalDownloader';
import type { DistributionFormat } from '../../../../Common/ExternalAppDistribution';

/** Paths belonging to a single explicit installation test, separate from grants and rendezvous records. */
export function installationTestPaths(appId: string) {
    if (process.env.KAWAIKARA_EXTERNAL_APP_INSTALL_TEST !== '1')
        return undefined;
    if (!/^[a-z0-9]+(?:[.-][a-z0-9-]+)+$/.test(appId))
        throw new Error('Invalid installation test identity.');
    const root = __KAWAIKARA_EXTERNAL_APP_INSTALL_TEST_ROOT__;
    if (!root || !path.isAbsolute(root))
        throw new Error('Installation test root is unavailable.');
    const directory = path.join(root, appId);
    return {
        /** Manifest and icon cache for this test. */
        cache: path.join(directory, 'cache'),
        /** Verified artifacts and temporary extraction work. */
        downloads: path.join(directory, 'downloads'),
        /** The only application location considered installed in this test. */
        installed: path.join(directory, 'installed'),
    };
}

/** Rejects redirected test directories so installation never writes through a symlink into a real install. */
async function requirePrivateDirectory(directory: string): Promise<void> {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const root = __KAWAIKARA_EXTERNAL_APP_INSTALL_TEST_ROOT__!;
    if (
        (await realpath(directory)) !==
        path.join(await realpath(root), path.relative(root, directory))
    )
        throw new Error('Installation test directory must not be a symlink.');
}

/** Finds only the validated test copy; never queries Spotlight, protocols or the regular Applications directories. */
export async function findTestApplication(appId: string) {
    const paths = installationTestPaths(appId);
    if (!paths || process.platform !== 'darwin') return null;
    const candidate = path.join(paths.installed, 'kawai-downloader.app');
    try {
        const root = __KAWAIKARA_EXTERNAL_APP_INSTALL_TEST_ROOT__!;
        if (
            (await realpath(candidate)) !==
            path.join(await realpath(root), path.relative(root, candidate))
        )
            return null;
        return await inspectMacApp(candidate);
    } catch {
        return null;
    }
}

/**
 * Copies a verified macOS test artifact into its isolated installation root.
 * @param appId - Trusted adapter identity, not an arbitrary remote installer command.
 * @param artifact - Already hash-verified artifact inside this product's test downloads directory.
 * @param format - Supported container; native system installers are deliberately rejected.
 * @returns Only after the copied application identity has been validated.
 * @remarks No protocol registration, quarantine removal, or installed production app replacement occurs.
 */
export async function installTestApplication(
    appId: string,
    artifact: string,
    format: DistributionFormat,
): Promise<void> {
    const paths = installationTestPaths(appId);
    if (
        !paths ||
        appId !== 'day.faby.kawai-downloader' ||
        process.platform !== 'darwin' ||
        !['dmg', 'zip'].includes(format)
    )
        throw new Error(
            'Isolated installation requires a supported portable application artifact.',
        );
    await requirePrivateDirectory(paths.downloads);
    await requirePrivateDirectory(paths.installed);
    const directory = await mkdtemp(path.join(paths.downloads, '.extract-'));
    const extracted = path.join(directory, 'contents');
    const staged = path.join(directory, 'kawai-downloader.app');
    const run = promisify(execFile);
    let mounted = false;
    try {
        await mkdir(extracted);
        if (format === 'dmg') {
            await run('/usr/bin/hdiutil', [
                'attach',
                '-readonly',
                '-nobrowse',
                '-mountpoint',
                extracted,
                artifact,
            ]);
            mounted = true;
        } else await run('/usr/bin/ditto', ['-x', '-k', artifact, extracted]);
        const apps = (await readdir(extracted, { withFileTypes: true })).filter(
            (item) => item.isDirectory() && item.name.endsWith('.app'),
        );
        if (apps.length !== 1)
            throw new Error('Expected one application in test artifact.');
        const source = path.join(extracted, apps[0].name);
        if (!(await inspectMacApp(source)))
            throw new Error('Test application identity mismatch.');
        await cp(source, staged, { recursive: true, dereference: false });
        if (!(await inspectMacApp(staged)))
            throw new Error('Invalid staged application.');
        const target = path.join(paths.installed, 'kawai-downloader.app');
        // Refuse replacement: callers explicitly remove the previous test copy to test reinstall.
        await rename(staged, target);
    } finally {
        if (mounted) await run('/usr/bin/hdiutil', ['detach', extracted]);
        await rm(directory, { recursive: true, force: true });
    }
}
