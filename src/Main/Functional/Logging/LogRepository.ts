import { shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
    lstat,
    mkdir,
    readdir,
    readFile,
    rmdir,
    stat,
    unlink,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import type {
    ApplicationLogDeleteResult,
    ApplicationLogDocument,
    ApplicationLogFileReference,
    ApplicationLogFileSummary,
    ApplicationLogGroupSummary,
    ApplicationLogRepository,
} from '../../../Common/IPC';
import { FileReadError, readFileBytes } from '../Files/FileRead';
import { readJsonFile } from '../Files/JsonFile';

import {
    EXTERNAL_GROUP_METADATA_FILE_NAME,
    EXTERNAL_LOG_DIRECTORY_NAME,
    EXTERNAL_UNGROUPED_GROUP_ID,
    IMPORTED_LOG_MAX_SIZE_BYTES,
} from './LogConstants';
import {
    isRecord,
    LogImportError,
    parseLogEntries,
    sanitizeImportedLogBuffer,
} from './LogParsing';
/** Describes an external log group metadata document. */
export interface ExternalLogGroupMetadata {
    /** The metadata schema version value. */
    readonly schemaVersion: 1;
    /** The stable readable group ID value. */
    readonly id: string;
    /** The user-assigned alias value. */
    readonly alias: string;
    /** The source installation ID values. */
    readonly sourceDeviceIds: readonly string[];
    /** The import timestamp value. */
    readonly importedAt: string;
}
/** Mutable per-session repository cache owned by LoggingManager; no event or transport state. */
export interface LogRepositoryState {
    /** Absolute app-owned log root. */
    readonly directory: string;
    /** Active session file, protected from deletion. */
    readonly logFileName: string;
    /** Last parsed document, invalidated by filesystem identity and timestamps. */
    cachedDocument?: {
        /** Absolute validated source path. */
        path: string;
        /** Device, inode, size and modification timestamps. */
        fingerprint: string;
        /** Immutable parsed viewer response. */
        document: ApplicationLogDocument;
    };
}

/** Lists the safely readable external log groups. */
export async function listLogGroups(
    state: LogRepositoryState,
): Promise<ApplicationLogGroupSummary[]> {
    const externalDirectory = getRepositoryDirectory(state, 'external');
    await mkdir(externalDirectory, { recursive: true });
    const entries = await readdir(externalDirectory, {
        withFileTypes: true,
    });
    const groups: ApplicationLogGroupSummary[] = [];
    const ungroupedFiles = entries.filter(
        (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.log'),
    );
    if (ungroupedFiles.length > 0) {
        const fileMetadata = await Promise.all(
            ungroupedFiles.map((entry) =>
                stat(path.join(externalDirectory, entry.name)),
            ),
        );
        groups.push({
            /** The stable group ID value. */
            id: EXTERNAL_UNGROUPED_GROUP_ID,
            /** The user-assigned alias value. */
            alias: '',
            /** The source installation ID values. */
            sourceDeviceIds: [],
            /** The import timestamp value. */
            importedAt:
                fileMetadata
                    .map((metadata) => metadata.mtime.toISOString())
                    .sort()
                    .at(-1) ?? new Date(0).toISOString(),
            /** The contained log count value. */
            fileCount: ungroupedFiles.length,
        });
    }
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
        const metadata = await readExternalGroupMetadata(
            path.join(externalDirectory, entry.name),
        );
        if (!metadata || metadata.id !== entry.name) continue;
        const files = await listLogFilesInDirectory(
            path.join(externalDirectory, entry.name),
        );
        groups.push({
            /** The stable group ID value. */
            id: metadata.id,
            /** The user-assigned alias value. */
            alias: metadata.alias,
            /** The source installation ID values. */
            sourceDeviceIds: metadata.sourceDeviceIds,
            /** The import timestamp value. */
            importedAt: metadata.importedAt,
            /** The contained log count value. */
            fileCount: files.length,
        });
    }
    return groups.sort((left, right) =>
        right.importedAt.localeCompare(left.importedAt),
    );
}

/** Lists one log repository or external group with the active session first. */
export async function listLogFiles(
    state: LogRepositoryState,
    repository: ApplicationLogRepository,
    groupId?: string,
): Promise<ApplicationLogFileSummary[]> {
    if (repository === 'external' && !groupId) return [];
    const directory = await getLogDirectory(state, repository, groupId);
    await mkdir(directory, { recursive: true });
    const entries = await listLogFilesInDirectory(directory);
    const summaries = await Promise.all(
        entries.map(async (entry) => {
            const metadata = await stat(path.join(directory, entry.name));
            return {
                /** The repository value. */
                repository,
                /** The file name value. */
                fileName: entry.name,
                /** The owning external group ID value. */
                groupId: repository === 'external' ? groupId : undefined,
                /** The byte size value. */
                size: metadata.size,
                /** The modified timestamp value. */
                modifiedAt: metadata.mtime.toISOString(),
                /** Whether this is the active log value. */
                active:
                    repository === 'application' &&
                    entry.name === state.logFileName,
            } satisfies ApplicationLogFileSummary;
        }),
    );
    return summaries.sort(compareLogFileSummaries);
}

/** Reads one validated log without scanning application siblings; caches only unchanged file identities.
 * @param state Session-owned root, active file name and last-document cache.
 * @param repository Application logs or the isolated external-import repository.
 * @param fileName Basename ending in `.log`; paths and symbolic links are rejected.
 * @param groupId Required external group, validated against stored metadata.
 * @returns Parsed and bounded viewer entries; unchanged files retain object identity.
 */
export async function readLogDocument(
    state: LogRepositoryState,
    repository: ApplicationLogRepository,
    fileName: string,
    groupId?: string,
): Promise<ApplicationLogDocument> {
    const file = await requireLogFile(state, repository, fileName, groupId);
    const directory = await getLogDirectory(state, repository, groupId);
    const filePath = path.join(directory, file.fileName);
    const identity = await lstat(filePath);
    if (!identity.isFile() || identity.isSymbolicLink())
        throw new Error('A regular log file is required.');
    const fingerprint = `${identity.dev}:${identity.ino}:${identity.size}:${identity.mtimeMs}:${identity.ctimeMs}`;
    if (
        state.cachedDocument?.path === filePath &&
        state.cachedDocument.fingerprint === fingerprint
    )
        return state.cachedDocument.document;
    const value =
        repository === 'external'
            ? await readImportedLog(filePath)
            : await readFile(filePath, 'utf8');
    const parsed = parseLogEntries(value);
    if (
        repository === 'external' &&
        (parsed.invalidMetadata || parsed.entries.length === 0)
    ) {
        throw new Error('The external log failed safety validation.');
    }
    const document = {
        /** The source file summary value. */
        file,
        /** The validated metadata header value. */
        metadata: parsed.metadata,
        /** The parsed entries value. */
        entries: parsed.entries,
        /** Whether older entries were omitted. */
        truncated: parsed.truncated,
    };
    state.cachedDocument = { path: filePath, fingerprint, document };
    return document;
}

/** Resolves a renderer-provided file name to an existing log summary. */
export async function requireLogFile(
    state: LogRepositoryState,
    repository: ApplicationLogRepository,
    fileName: string,
    groupId?: string,
): Promise<ApplicationLogFileSummary> {
    if (
        typeof fileName !== 'string' ||
        fileName !== path.basename(fileName) ||
        !fileName.toLowerCase().endsWith('.log')
    ) {
        throw new TypeError('A valid log file name is required.');
    }
    const directory = await getLogDirectory(state, repository, groupId);
    const metadata = await lstat(path.join(directory, fileName));
    if (!metadata.isFile() || metadata.isSymbolicLink())
        throw new Error('A regular log file is required.');
    return {
        /** The repository value. */
        repository,
        /** The file name value. */
        fileName,
        /** The group ID value. */
        groupId: repository === 'external' ? groupId : undefined,
        /** The size value. */
        size: metadata.size,
        /** The modified at value. */
        modifiedAt: metadata.mtime.toISOString(),
        /** Whether the active option is enabled. */
        active: repository === 'application' && fileName === state.logFileName,
    };
}

/** Returns the resolved root for a log repository. */
export function getRepositoryDirectory(
    state: LogRepositoryState,
    repository: ApplicationLogRepository,
): string {
    const applicationDirectory = path.dirname(
        path.join(state.directory, state.logFileName),
    );
    return repository === 'external'
        ? path.join(applicationDirectory, EXTERNAL_LOG_DIRECTORY_NAME)
        : applicationDirectory;
}

/** Returns a validated application or external group log directory. */
export async function getLogDirectory(
    state: LogRepositoryState,
    repository: ApplicationLogRepository,
    groupId?: string,
): Promise<string> {
    if (repository === 'application')
        return getRepositoryDirectory(state, repository);
    if (!groupId) throw new TypeError('An external log group is required.');
    const externalRoot = getRepositoryDirectory(state, 'external');
    if (groupId === EXTERNAL_UNGROUPED_GROUP_ID) return externalRoot;
    const group = (await listLogGroups(state)).find(
        (value) => value.id === groupId,
    );
    if (!group) throw new Error('The external log group no longer exists.');
    return path.join(externalRoot, group.id);
}

/** Removes one external group after its last log was deleted. */
async function removeExternalGroupIfEmpty(
    state: LogRepositoryState,
    groupId: string,
): Promise<void> {
    const directory = await getLogDirectory(state, 'external', groupId);
    const files = await listLogFilesInDirectory(directory);
    if (files.length > 0) return;
    await removeEmptyExternalGroupDirectory(
        directory,
        getRepositoryDirectory(state, 'external'),
    );
}

/** Deletes validated inactive files; active or invalid references are reported as skipped.
 * @param state Session repository whose active file must be retained.
 * @param references Renderer-supplied references, deduplicated and validated before each removal.
 * @returns Deleted count and references that were not removed.
 */
export async function deleteLogFiles(
    state: LogRepositoryState,
    references: readonly ApplicationLogFileReference[],
): Promise<ApplicationLogDeleteResult> {
    const uniqueReferences = deduplicateLogReferences(references);
    const skipped: ApplicationLogFileReference[] = [];
    const affectedGroups = new Set<string>();
    let deleted = 0;
    for (const reference of uniqueReferences) {
        try {
            const file = await requireLogFile(
                state,
                reference.repository,
                reference.fileName,
                reference.groupId,
            );
            if (file.active) {
                skipped.push(reference);
                continue;
            }
            const directory = await getLogDirectory(
                state,
                reference.repository,
                reference.groupId,
            );
            await unlink(path.join(directory, file.fileName));
            deleted += 1;
            if (
                reference.repository === 'external' &&
                reference.groupId &&
                reference.groupId !== EXTERNAL_UNGROUPED_GROUP_ID
            ) {
                affectedGroups.add(reference.groupId);
            }
        } catch {
            skipped.push(reference);
        }
    }
    for (const groupId of affectedGroups) {
        await removeExternalGroupIfEmpty(state, groupId);
    }
    return {
        /** The number of deleted log files. */
        deleted,
        /** The skipped log file values. */
        skipped,
    };
}

/** Reads one bounded external group metadata document. */
async function readExternalGroupMetadata(
    directory: string,
): Promise<ExternalLogGroupMetadata | undefined> {
    try {
        const metadataPath = path.join(
            directory,
            EXTERNAL_GROUP_METADATA_FILE_NAME,
        );
        const value = await readJsonFile(metadataPath, {
            maxBytes: 64 * 1024,
            rejectSymbolicLinks: true,
        });
        if (
            !isRecord(value) ||
            value.schemaVersion !== 1 ||
            typeof value.id !== 'string' ||
            !/^LOGSET-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value.id) ||
            typeof value.alias !== 'string' ||
            value.alias.length > 120 ||
            !Array.isArray(value.sourceDeviceIds) ||
            value.sourceDeviceIds.length > 64 ||
            !value.sourceDeviceIds.every(
                (entry) => typeof entry === 'string' && entry.length <= 80,
            ) ||
            typeof value.importedAt !== 'string' ||
            value.importedAt.length > 80
        ) {
            return undefined;
        }
        return {
            /** The metadata schema version value. */
            schemaVersion: 1,
            /** The stable readable group ID value. */
            id: value.id,
            /** The user-assigned alias value. */
            alias: value.alias,
            /** The source installation ID values. */
            sourceDeviceIds: value.sourceDeviceIds,
            /** The import timestamp value. */
            importedAt: value.importedAt,
        };
    } catch {
        return undefined;
    }
}

/** Lists direct regular `.log` files without following symbolic links. */
async function listLogFilesInDirectory(
    directory: string,
): Promise<import('node:fs').Dirent[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter(
        (entry) =>
            entry.isFile() &&
            !entry.isSymbolicLink() &&
            entry.name.toLowerCase().endsWith('.log'),
    );
}

/** Sorts active and numerically indexed dated logs newest first. */
function compareLogFileSummaries(
    left: ApplicationLogFileSummary,
    right: ApplicationLogFileSummary,
): number {
    if (left.active !== right.active) return left.active ? -1 : 1;
    const leftName = /^(\d{4}-\d{2}-\d{2})-(\d+)\.log$/i.exec(left.fileName);
    const rightName = /^(\d{4}-\d{2}-\d{2})-(\d+)\.log$/i.exec(right.fileName);
    if (leftName && rightName) {
        const dateComparison = rightName[1].localeCompare(leftName[1]);
        if (dateComparison !== 0) return dateComparison;
        return Number(rightName[2]) - Number(leftName[2]);
    }
    return right.modifiedAt.localeCompare(left.modifiedAt);
}

/** Removes duplicate renderer-provided log references. */
export function deduplicateLogReferences(
    references: readonly ApplicationLogFileReference[],
): ApplicationLogFileReference[] {
    const unique = new Map<string, ApplicationLogFileReference>();
    for (const reference of references) {
        const key = [
            reference.repository,
            reference.groupId ?? '',
            reference.fileName,
        ].join('\0');
        unique.set(key, reference);
    }
    return [...unique.values()];
}

/** Creates a readable collision-resistant external group ID. */
export function createExternalGroupId(externalRoot: string): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const compactId = randomUUID()
            .replace(/-/g, '')
            .slice(0, 8)
            .toUpperCase();
        const groupId = `LOGSET-${compactId.slice(0, 4)}-${compactId.slice(4)}`;
        if (!existsSync(path.join(externalRoot, groupId))) return groupId;
    }
    throw new Error('Unable to allocate an external log group ID.');
}

/** Writes one sanitized imported log into a new external group. */
export async function writeImportedLog(
    directory: string,
    groupId: string,
    originalName: string,
    contents: string,
): Promise<ApplicationLogFileSummary> {
    const fileName = createAvailableImportedLogFileName(
        directory,
        originalName,
    );
    const destinationPath = path.join(directory, fileName);
    await writeFile(destinationPath, contents, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
    });
    const metadata = await stat(destinationPath);
    return {
        /** The repository value. */
        repository: 'external',
        /** The file name value. */
        fileName,
        /** The owning external group ID value. */
        groupId,
        /** The byte size value. */
        size: metadata.size,
        /** The modified timestamp value. */
        modifiedAt: metadata.mtime.toISOString(),
        /** Whether this is the active log value. */
        active: false,
    };
}

/** Removes only an inspected empty external group directory. */
export async function removeEmptyExternalGroupDirectory(
    directory: string,
    externalRoot: string,
): Promise<void> {
    const resolvedDirectory = path.resolve(directory);
    const resolvedRoot = path.resolve(externalRoot);
    if (
        path.dirname(resolvedDirectory) !== resolvedRoot ||
        !/^LOGSET-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(
            path.basename(resolvedDirectory),
        )
    ) {
        throw new Error(
            'Refusing to remove an unexpected external log directory.',
        );
    }
    const entries = await readdir(resolvedDirectory, { withFileTypes: true });
    if (
        entries.some(
            (entry) => entry.name !== EXTERNAL_GROUP_METADATA_FILE_NAME,
        )
    ) {
        throw new Error(
            'Refusing to remove a non-empty external log directory.',
        );
    }
    const metadataPath = path.join(
        resolvedDirectory,
        EXTERNAL_GROUP_METADATA_FILE_NAME,
    );
    if (existsSync(metadataPath)) await unlink(metadataPath);
    await rmdir(resolvedDirectory);
}

/** Reads, decodes, and strips unsafe terminal controls from an imported log. */
export async function readImportedLog(filePath: string): Promise<string> {
    try {
        return sanitizeImportedLogBuffer(
            await readFileBytes(filePath, {
                maxBytes: IMPORTED_LOG_MAX_SIZE_BYTES,
                rejectSymbolicLinks: true,
            }),
        );
    } catch (error) {
        if (error instanceof FileReadError)
            throw new LogImportError(error.reason);
        throw error;
    }
}

/** Creates a safe, collision-free file name inside the external repository. */
function createAvailableImportedLogFileName(
    directory: string,
    originalName: string,
): string {
    const originalStem = originalName.replace(/\.log$/i, '');
    const safeStem =
        originalStem
            .normalize('NFKC')
            .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
            .replace(/^\.+/, '')
            .trim()
            .slice(0, 96) || 'imported-log';
    const baseName = `${safeStem}.log`;
    if (!existsSync(path.join(directory, baseName))) return baseName;
    for (let index = 2; index < 10_000; index += 1) {
        const candidate = `${safeStem} (${String(index)}).log`;
        if (!existsSync(path.join(directory, candidate))) return candidate;
    }
    return `${safeStem}-${randomUUID()}.log`;
}

/** Opens one log repository or external group directory. */
export async function openLogDirectory(
    state: LogRepositoryState,
    repository: ApplicationLogRepository,
    groupId?: string,
): Promise<void> {
    const directory =
        repository === 'external' && !groupId
            ? getRepositoryDirectory(state, 'external')
            : await getLogDirectory(state, repository, groupId);
    await mkdir(directory, { recursive: true });
    const error = await shell.openPath(directory);
    if (error) throw new Error(error);
}
