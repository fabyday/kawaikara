import path from 'node:path';
import { stat } from 'node:fs/promises';
import {
    readWindowsDataRoot,
    resolveWindowsDataRootSelection,
    writeWindowsDataRoot,
} from './Windows/DataLocation';

/** Whether this platform supports choosing a persistent app data root. */
export function supportsCustomDataLocation(): boolean {
    return process.platform === 'win32';
}

/** Read an installed application's platform-owned data locator. */
export function readInstalledDataRoot(
    ...args: Parameters<typeof readWindowsDataRoot>
): string | undefined {
    return supportsCustomDataLocation()
        ? readWindowsDataRoot(...args)
        : undefined;
}

/** Validate a next-launch data root using the platform's path and installer rules. */
export function resolveDataRootSelection(
    ...args: Parameters<typeof resolveWindowsDataRootSelection>
): string {
    if (!supportsCustomDataLocation())
        throw new Error(
            'Custom data locations are unsupported on this platform.',
        );
    return resolveWindowsDataRootSelection(...args);
}

/** Persist a next-launch data locator without moving the active profile. */
export async function writeInstalledDataRoot(
    ...args: Parameters<typeof writeWindowsDataRoot>
): Promise<void> {
    if (!supportsCustomDataLocation())
        throw new Error(
            'Custom data locations are unsupported on this platform.',
        );
    await writeWindowsDataRoot(...args);
}

/** Compare file paths using the platform's existing path-key policy. */
export function normalizeFilePathKey(value: string): string {
    const normalized = path.normalize(value);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/** Display a filesystem root without a trailing Windows drive separator. */
export function getFileSystemRootLabel(root: string): string {
    return process.platform === 'win32' ? root.replace(/[\\/]$/, '') : root;
}

/** Enumerate accessible filesystem roots; Linux mount discovery is not implemented. */
export async function listFileSystemRoots(): Promise<string[]> {
    if (process.platform !== 'win32') return ['/'];
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
