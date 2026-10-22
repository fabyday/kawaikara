import { markDownloadedFile } from '../../../Platform/DistributionInstaller';
import { app, dialog, shell } from 'electron';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type {
    DistributionActionResult,
    DistributionPreview,
} from '../../../../Common/ExternalAppDistribution';
import type { AppMessages } from '../../../../Common/IPC';
import { openPublicResource } from './PublicResource';

/**
 * Downloads a selected artifact, verifies its digest, and optionally opens its native installer.
 * A native installer handoff is never reported as installation or connection success.
 */
export async function prepareDistributionArtifact(
    preview: DistributionPreview,
    install: boolean,
    labels: AppMessages['externalApps']['distribution'],
    testOrigin?: string,
): Promise<DistributionActionResult> {
    const testService =
        typeof __KAWAIKARA_EXTERNAL_APP_TESTING__ !== 'undefined' &&
        __KAWAIKARA_EXTERNAL_APP_TESTING__
            ? (require('./InstallTesting') as typeof import('./InstallTesting'))
            : undefined;
    const testPaths = testService?.installationTestPaths(preview.descriptor.id);
    const artifact = preview.target?.artifact;
    if (
        !artifact ||
        (install && preview.action !== 'install') ||
        preview.target?.os !== process.platform
    )
        throw new Error('Unsupported installation target.');
    if (
        testPaths &&
        install &&
        (process.platform !== 'darwin' ||
            !['dmg', 'zip'].includes(artifact.format))
    )
        throw new Error(
            'This native installer cannot be isolated; use a portable test artifact.',
        );
    const filename = `${preview.descriptor.id}-${(preview.target?.version ?? 'release').replace(/[^a-zA-Z0-9._-]/g, '_')}.${artifact.format}`;
    let destination: string | undefined;
    if (install) {
        const answer = await dialog.showMessageBox({
            type: 'question',
            title: labels.install,
            message: `${labels.install}: ${preview.descriptor.name}`,
            detail: `${testPaths ? labels.testInstallConfirm : labels.installConfirm}\n\n${preview.target.os} / ${preview.target.arch} / ${preview.target.version ?? ''}\n${preview.sourceUrl}\n${artifact.url}`,
            buttons: [labels.install, labels.cancel],
            defaultId: 1,
            cancelId: 1,
            noLink: true,
        });
        if (answer.response !== 0) return 'canceled';
    } else if (testPaths) {
        destination = path.join(testPaths.downloads, filename);
    } else {
        const answer = await dialog.showSaveDialog({
            title: labels.download,
            defaultPath: path.join(app.getPath('downloads'), filename),
        });
        if (answer.canceled || !answer.filePath) return 'canceled';
        destination = answer.filePath;
    }
    // Manual downloads stage on the same filesystem for atomic replacement after verification.
    const parent = destination
        ? path.dirname(destination)
        : (testPaths?.downloads ??
          path.join(app.getPath('temp'), 'kawaikara-installers'));
    await mkdir(parent, { recursive: true, mode: 0o700 });
    const directory = await mkdtemp(path.join(parent, '.kawaikara-'));
    const temporary = path.join(directory, filename);
    let handedOff = false;
    try {
        const response = await openPublicResource(
            artifact.url,
            AbortSignal.timeout(10 * 60_000),
            0,
            testOrigin,
        );
        const hash = createHash('sha256');
        let size = 0;
        const bounded = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
                size += chunk.length;
                if (size > 2 * 1024 * 1024 * 1024) {
                    callback(new Error('Installer exceeds size limit.'));
                    return;
                }
                hash.update(chunk);
                callback(null, chunk);
            },
        });
        await pipeline(
            response,
            bounded,
            createWriteStream(temporary, { mode: 0o600, flags: 'wx' }),
        );
        if (hash.digest('hex') !== artifact.sha256)
            throw new Error('Installer checksum mismatch.');
        await markDownloadedFile(temporary, artifact.url);
        if (destination) {
            await rename(temporary, destination);
            return 'downloaded';
        }
        if (testPaths && testService) {
            const saved = path.join(testPaths.downloads, filename);
            await rename(temporary, saved);
            await testService.installTestApplication(
                preview.descriptor.id,
                saved,
                artifact.format,
            );
            return 'installed';
        }
        const error = await shell.openPath(temporary);
        if (error) throw new Error(error);
        // Keep files for the independent OS installer; ordinary OS temp cleanup owns them afterwards.
        handedOff = true;
        return 'installer-opened';
    } finally {
        if (!handedOff) await rm(directory, { recursive: true, force: true });
    }
}
