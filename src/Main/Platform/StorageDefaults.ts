import path from 'node:path';
/** Standard profile locations do not use an installer-owned data locator. */
export function readInstalledDataRoot(
    appData: string,
    appId: string,
    productName: string,
    executablePath: string,
): string | undefined {
    return undefined;
}

/** Reject relocation when no native data-locator integration is available. */
export function resolveDataRootSelection(
    input: string,
    productName: string,
    executablePath: string,
    activeRoot: string,
): string {
    throw new Error('Custom data locations are unsupported on this platform.');
}

/** Reject persistence without creating or moving profile data. */
export async function writeInstalledDataRoot(
    appData: string,
    appId: string,
    selected: string,
    activeRoot: string,
    executablePath: string,
): Promise<void> {
    throw new Error('Custom data locations are unsupported on this platform.');
}

/** Whether this platform supports choosing a persistent app data root. */
export function supportsCustomDataLocation(): boolean {
    return false;
}

/** Compare file paths using the platform's existing path-key policy. */
export function normalizeFilePathKey(value: string): string {
    return path.normalize(value);
}

/** Keep the standard filesystem root label unchanged. */
export function getFileSystemRootLabel(root: string): string {
    return root;
}

/** Enumerate accessible filesystem roots; Linux mount discovery is not implemented. */
export async function listFileSystemRoots(): Promise<string[]> {
    return ['/'];
}
