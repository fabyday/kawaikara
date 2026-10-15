import { stat } from 'node:fs/promises';
import path from 'node:path';
export {
    readWindowsDataRoot as readInstalledDataRoot,
    resolveWindowsDataRootSelection as resolveDataRootSelection,
    writeWindowsDataRoot as writeInstalledDataRoot,
} from './DataLocation';

/** Whether this platform supports choosing a persistent app data root. */
export function supportsCustomDataLocation(): boolean {
    return true;
}

/** Compare file paths using the platform's existing path-key policy. */
export function normalizeFilePathKey(value: string): string {
    const normalized = path.normalize(value);
    return normalized.toLowerCase();
}

/** Display a filesystem root without a trailing Windows drive separator. */
export function getFileSystemRootLabel(root: string): string {
    return root.replace(/[\\/]$/, '');
}

/** Enumerate accessible Windows drive roots. */
export async function listFileSystemRoots(): Promise<string[]> {
    const candidates = Array.from(
        { length: 26 },
        (_, index) => `${String.fromCharCode(65 + index)}:\\`,
    );
    const available = await Promise.all(
        candidates.map(async (candidate) => {
            try {
                return (await stat(candidate)).isDirectory()
                    ? candidate
                    : undefined;
            } catch {
                return undefined;
            }
        }),
    );
    return available.filter((value): value is string => value !== undefined);
}
