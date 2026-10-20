import { createHash, randomUUID } from 'node:crypto';
import {
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
    stat,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';

/** Local protocol v1. Both applications keep this module compatible; no page data is stored here. */
export async function writeRecord(file: string, value: unknown): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporary, JSON.stringify(value), {
            flag: 'wx',
            mode: 0o600,
        });
        await rename(temporary, file);
    } finally {
        await rm(temporary, { force: true });
    }
}
/** Reads bounded same-user private records. Missing records are normal; unsafe records fail closed. */
export async function readRecord(
    file: string,
): Promise<Record<string, unknown> | undefined> {
    try {
        const info = await stat(file);
        if (
            !info.isFile() ||
            info.size > 4096 ||
            (process.platform !== 'win32' &&
                ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()))
        )
            throw new Error('Unsafe connection record.');
        const value = JSON.parse(await readFile(file, 'utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new Error('Invalid connection record.');
        return value;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            return undefined;
        throw error;
    }
}
/** A binding-scoped immutable tombstone. Fresh explicit consent uses a new key, never deletes old revocations. */
function revocationFile(
    directory: string,
    hostId: string,
    clientId: string,
    key: string,
): string {
    const digest = createHash('sha256')
        .update(JSON.stringify([hostId, clientId, key]))
        .digest('hex');
    return path.join(directory, 'revocations', `${digest}.json`);
}
export async function revokeBinding(
    directory: string,
    hostId: string,
    clientId: string,
    key: string,
): Promise<void> {
    await writeRecord(revocationFile(directory, hostId, clientId, key), {
        revoked: true,
    });
}
export async function isRevoked(
    directory: string,
    hostId: string,
    clientId: string,
    key: string,
): Promise<boolean> {
    return (
        (await readRecord(revocationFile(directory, hostId, clientId, key)))
            ?.revoked === true
    );
}
export interface ClientPresence {
    clientId: string;
    appId: string;
    token: string;
    pid: number;
}
/** Returns only live same-user client advertisements; callers still filter trusted adapter identities. */
export async function clients(directory: string): Promise<ClientPresence[]> {
    const folder = path.join(directory, 'clients');
    const names = await readdir(folder).catch(() => [] as string[]);
    const result: ClientPresence[] = [];
    for (const name of names
        .filter((name) => /^[a-f0-9-]{36}\.json$/.test(name))
        .slice(0, 64)) {
        try {
            const value = await readRecord(path.join(folder, name));
            if (
                !value ||
                value.schemaVersion !== 1 ||
                name !== `${value.clientId}.json` ||
                typeof value.appId !== 'string' ||
                !/^[a-f0-9]{64}$/.test(String(value.token)) ||
                !Number.isSafeInteger(value.pid) ||
                Number(value.pid) < 1
            )
                continue;
            process.kill(Number(value.pid), 0);
            result.push(value as unknown as ClientPresence);
        } catch {
            /* Closed clients and malformed advertisements are not candidates. */
        }
    }
    return result;
}
