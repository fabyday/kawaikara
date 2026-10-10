import { readFileSync, statSync } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

/** Reads the per-user NSIS locator; never falls back silently from a broken selected profile. */
export function readWindowsDataRoot(
    appData: string,
    appId: string,
    productName: string,
    executablePath: string,
): string | undefined {
    const locator = path.join(
        appData,
        'Kawaikara Installations',
        `${appId}.ini`,
    );
    let bytes: Buffer;
    try {
        if (statSync(locator).size > 8192)
            throw new Error('App data locator is too large.');
        bytes = readFileSync(locator);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            return undefined;
        throw error;
    }
    const text =
        bytes[0] === 0xff && bytes[1] === 0xfe
            ? bytes.subarray(2).toString('utf16le')
            : bytes.toString('utf8');
    const match = /^\[storage\]\r?\nroot=([^\r\n]+)\r?\n?$/.exec(text);
    if (!match) throw new Error(`Invalid app data locator: ${locator}`);
    const selected = match[1];
    const normalized = path.win32.normalize(selected);
    // Choosing the default again clears the override, including redirected/roaming AppData.
    if (
        normalized.toLowerCase() ===
        path.win32.join(appData, productName).toLowerCase()
    )
        return undefined;
    validateWindowsDataRoot(selected, productName, executablePath);
    return normalized;
}

/** True for a path itself or a descendant, never for sibling prefixes or other drives. */
function contains(parent: string, child: string): boolean {
    const relative = path.win32.relative(parent, child);
    return (
        relative === '' ||
        (!relative.startsWith('..\\') &&
            relative !== '..' &&
            !path.win32.isAbsolute(relative))
    );
}

/** Reject roots that installation, cache resets or another channel could accidentally own. */
function validateWindowsDataRoot(
    selected: string,
    productName: string,
    executablePath: string,
): void {
    const normalized = path.win32.normalize(selected);
    const installDirectory = path.win32.dirname(executablePath);
    if (
        !/^[a-z]:\\/i.test(selected) ||
        /[\x00-\x1f<>"|?*]/.test(selected) ||
        selected.slice(2).includes(':') ||
        path.win32.basename(normalized).toLowerCase() !==
            productName.toLowerCase() ||
        contains(installDirectory, normalized) ||
        contains(normalized, installDirectory)
    ) {
        throw new Error('Unsafe app data location.');
    }
}

/** Accept either an existing channel root or a parent folder, matching the installer convention. */
export function resolveWindowsDataRootSelection(
    input: string,
    productName: string,
    executablePath: string,
    activeRoot: string,
): string {
    const value = input.trim();
    if (!/^[a-z]:\\/i.test(value))
        throw new Error('An absolute local directory is required.');
    const base = path.win32.normalize(value);
    const selected =
        path.win32.basename(base).toLowerCase() === productName.toLowerCase()
            ? base
            : path.win32.join(base, productName);
    validateWindowsDataRoot(selected, productName, executablePath);
    if (
        selected.toLowerCase() !==
            path.win32.normalize(activeRoot).toLowerCase() &&
        (contains(activeRoot, selected) || contains(selected, activeRoot))
    )
        throw new Error('Overlapping app data roots are not supported.');
    validateOutsideSystemDirectories(selected);
    return selected;
}

/** Applies to lexical selections and their resolved junction destinations. */
function validateOutsideSystemDirectories(selected: string): void {
    for (const systemDirectory of [
        process.env.SystemRoot,
        process.env.ProgramFiles,
        process.env['ProgramFiles(x86)'],
    ]) {
        if (systemDirectory && contains(systemDirectory, selected))
            throw new Error('System directories cannot store app data.');
    }
}

/** Atomically replaces only the bootstrap locator; never copies or removes profile contents. */
export async function writeWindowsDataRoot(
    appData: string,
    appId: string,
    selected: string,
    activeRoot: string,
    executablePath: string,
): Promise<void> {
    if (!/^[a-z0-9.-]+$/i.test(appId))
        throw new Error('Invalid application identity.');
    // Validate before creating directories, including callers other than the settings UI.
    const productName = path.win32.basename(activeRoot);
    validateWindowsDataRoot(selected, productName, executablePath);
    resolveWindowsDataRootSelection(
        selected,
        productName,
        executablePath,
        activeRoot,
    );
    await mkdir(selected, { recursive: true });
    if ((await lstat(selected)).isSymbolicLink())
        throw new Error('Linked data roots are not supported.');
    const resolved = await realpath(selected);
    const installed = await realpath(path.win32.dirname(executablePath));
    const current = await realpath(activeRoot);
    // A parent junction must not bypass the lexical system-directory check.
    validateOutsideSystemDirectories(resolved);
    if (
        contains(installed, resolved) ||
        contains(resolved, installed) ||
        (resolved.toLowerCase() !== current.toLowerCase() &&
            (contains(current, resolved) || contains(resolved, current)))
    ) {
        throw new Error(
            'Resolved app data root overlaps protected application directories.',
        );
    }
    // Verify write access before changing the startup pointer. Only this new probe is removed.
    const probe = path.join(selected, `.kawaikara-write-probe-${randomUUID()}`);
    const handle = await open(probe, 'wx');
    await handle.close();
    await unlink(probe);
    const directory = path.join(appData, 'Kawaikara Installations');
    await mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `${appId}.${randomUUID()}.tmp`);
    const output = await open(temporary, 'wx');
    try {
        await output.writeFile(
            Buffer.from(`\ufeff[storage]\r\nroot=${selected}\r\n`, 'utf16le'),
        );
        await output.sync();
    } finally {
        await output.close();
    }
    await rename(temporary, path.join(directory, `${appId}.ini`));
}
