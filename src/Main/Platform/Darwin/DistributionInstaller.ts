import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/** Applies quarantine to a newly downloaded file without disabling Gatekeeper. */
export async function markDownloadedFile(
    file: string,
    _source: string,
): Promise<void> {
    await promisify(execFile)('/usr/bin/xattr', [
        '-w',
        'com.apple.quarantine',
        `0083;${Math.floor(Date.now() / 1000).toString(16)};Kawaikara;`,
        file,
    ]);
}
