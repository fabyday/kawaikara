import { dialog } from 'electron';
import { constants } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

/**
 * Lets the user select a local application and starts it without shell arguments.
 * Selection is native-only: Renderer cannot supply an executable path. Launching
 * does not register the app or grant permissions; its authenticated connection
 * request must still pass the existing adapter and consent checks.
 * @returns Resolves after cancellation or successful OS process handoff.
 * @throws If the selected file is not a supported executable or launch fails.
 */
export async function launchManualConnection(): Promise<void> {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        ...(process.platform === 'darwin'
            ? { filters: [{ name: 'Application', extensions: ['app'] }] }
            : process.platform === 'win32'
              ? { filters: [{ name: 'Application', extensions: ['exe'] }] }
              : {}),
    });
    if (result.canceled || !result.filePaths[0]) return;
    const selected = await realpath(result.filePaths[0]);
    const info = await stat(selected);
    if (process.platform === 'darwin') {
        if (!info.isDirectory() || !selected.endsWith('.app'))
            throw new Error('Select an application bundle.');
        await promisify(execFile)('/usr/bin/open', ['-a', selected]);
        return;
    }
    if (!info.isFile() || (process.platform === 'win32' && !/\.exe$/i.test(selected)))
        throw new Error('Select an executable application.');
    await access(selected, constants.X_OK);
    await new Promise<void>((resolve, reject) => {
        const child = spawn(selected, [], {
            shell: false,
            detached: true,
            stdio: 'ignore',
        });
        child.once('error', reject);
        child.once('spawn', () => {
            child.unref();
            resolve();
        });
    });
}
