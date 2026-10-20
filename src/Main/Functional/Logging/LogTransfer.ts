import { app, dialog } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
    ApplicationLogExportResult,
    ApplicationLogFileReference,
    ApplicationLogFileSummary,
    ApplicationLogGroupSummary,
    ApplicationLogImportFailure,
    ApplicationLogImportResult,
    ApplicationLogMetadata,
    AppLocale,
} from '../../../Common/IPC';
import { getLocaleMessages } from '../Localization/Locale';
import {
    createKawaiLogArchive,
    KAWAI_LOG_ARCHIVE_EXTENSION,
    readKawaiLogArchive,
} from './LogArchive';

import {
    EXTERNAL_GROUP_METADATA_FILE_NAME,
    IMPORTED_LOG_INPUT_MAX_COUNT,
} from './LogConstants';
import {
    createPortableArchiveStem,
    LogImportError,
    normalizeGroupAlias,
    requireImportCapacity,
    requireImportedLog,
    resolveImportFailureReason,
    sanitizeImportedLogBuffer,
} from './LogParsing';
import {
    createExternalGroupId,
    deduplicateLogReferences,
    type ExternalLogGroupMetadata,
    getLogDirectory,
    getRepositoryDirectory,
    listLogGroups,
    type LogRepositoryState,
    readImportedLog,
    removeEmptyExternalGroupDirectory,
    requireLogFile,
    writeImportedLog,
} from './LogRepository';

/** Exports selected validated logs through a localized native save dialog.
 * @param state Repository root and active-session file identity.
 * @param metadata Trusted session metadata included in the portable archive.
 * @param deviceId Persistent installation identity of the exporting application.
 * @param references One to 128 distinct file references, validated before reading.
 * @param locale Locale used for the native dialog label.
 * @returns Cancellation or the completed archive path; write failures propagate.
 */
export async function exportFiles(
    state: LogRepositoryState,
    metadata: ApplicationLogMetadata,
    deviceId: string,
    references: readonly ApplicationLogFileReference[],
    locale: AppLocale = 'system',
): Promise<ApplicationLogExportResult> {
    const uniqueReferences = deduplicateLogReferences(references);
    if (uniqueReferences.length === 0 || uniqueReferences.length > 128) {
        throw new TypeError('Between 1 and 128 log files must be selected.');
    }
    const sources = [];
    for (const reference of uniqueReferences) {
        const file = await requireLogFile(
            state,
            reference.repository,
            reference.fileName,
            reference.groupId,
        );
        const directory = await getLogDirectory(
            state,
            reference.repository,
            reference.groupId,
        );
        sources.push({
            /** The original file name value. */
            fileName: file.fileName,
            /** The immutable log contents value. */
            contents: await readFile(path.join(directory, file.fileName)),
        });
    }
    let alias = 'Kawaikara';
    const externalGroupIds = new Set(
        uniqueReferences
            .filter((reference) => reference.repository === 'external')
            .map((reference) => reference.groupId),
    );
    if (externalGroupIds.size === 1) {
        const groupId = [...externalGroupIds][0];
        const group = (await listLogGroups(state)).find(
            (value) => value.id === groupId,
        );
        if (group?.alias) alias = group.alias;
    }
    const result = await dialog.showSaveDialog({
        defaultPath: path.join(
            app.getPath('documents'),
            `${createPortableArchiveStem(alias)}${KAWAI_LOG_ARCHIVE_EXTENSION}`,
        ),
        filters: [
            {
                name: getLocaleMessages(locale, app.getLocale()).nativeDialogs
                    .logArchive,
                extensions: ['kawailog'],
            },
        ],
    });
    if (result.canceled || !result.filePath) {
        return {
            /** The status value. */
            status: 'cancelled',
        };
    }
    const destinationPath = result.filePath
        .toLowerCase()
        .endsWith(KAWAI_LOG_ARCHIVE_EXTENSION)
        ? result.filePath
        : `${result.filePath}${KAWAI_LOG_ARCHIVE_EXTENSION}`;
    await createKawaiLogArchive(
        destinationPath,
        alias,
        {
            /** The application name value. */
            applicationName: metadata.applicationName,
            /** The application version value. */
            version: metadata.version,
            /** The release channel value. */
            channel: metadata.channel,
            /** The operating system label value. */
            platform: metadata.platform,
            /** The processor architecture value. */
            arch: metadata.arch,
            /** The Site API version value. */
            siteApiVersion: metadata.siteApiVersion,
            /** The runtime version values. */
            runtime: metadata.runtime,
            /** The readable installation ID value. */
            deviceId: deviceId,
        },
        sources,
    );
    return {
        /** The status value. */
        status: 'exported',
        /** The exported file path value. */
        path: destinationPath,
    };
}

/** Imports raw logs and verified archives into a newly allocated external group.
 * @param state Repository root owned by the logging session.
 * @param filePaths Trusted native-picker paths after the manager consumes its one-use token.
 * @param alias User-visible group name; normalized and bounded before storage.
 * @returns Imported files and per-input failures; one bad input does not discard valid inputs.
 */
export async function importFiles(
    state: LogRepositoryState,
    filePaths: readonly string[],
    alias: string,
): Promise<ApplicationLogImportResult> {
    const externalRoot = getRepositoryDirectory(state, 'external');
    const groupId = createExternalGroupId(externalRoot);
    const groupDirectory = path.join(externalRoot, groupId);
    await mkdir(externalRoot, { recursive: true });
    await mkdir(groupDirectory, { recursive: false });
    const imported: ApplicationLogFileSummary[] = [];
    const rejected: ApplicationLogImportFailure[] = [];
    const sourceDeviceIds = new Set<string>();
    let importedByteCount = 0;
    const selectedPaths = filePaths.slice(0, IMPORTED_LOG_INPUT_MAX_COUNT);
    for (const skippedPath of filePaths.slice(IMPORTED_LOG_INPUT_MAX_COUNT)) {
        rejected.push({
            /** The selected file name value. */
            fileName: path.basename(skippedPath),
            /** The rejection reason value. */
            reason: 'unsafe-file',
        });
    }
    for (const selectedPath of selectedPaths) {
        try {
            const extension = path.extname(selectedPath).toLowerCase();
            if (extension === '.log') {
                const contents = await readImportedLog(selectedPath);
                const parsed = requireImportedLog(contents);
                const incomingByteCount = requireImportCapacity(
                    imported.length,
                    importedByteCount,
                    [contents],
                );
                if (parsed.metadata?.deviceId) {
                    sourceDeviceIds.add(parsed.metadata.deviceId);
                }
                imported.push(
                    await writeImportedLog(
                        groupDirectory,
                        groupId,
                        path.basename(selectedPath),
                        contents,
                    ),
                );
                importedByteCount += incomingByteCount;
            } else if (extension === KAWAI_LOG_ARCHIVE_EXTENSION) {
                const archive = await readKawaiLogArchive(
                    selectedPath,
                    app.getPath('temp'),
                );
                sourceDeviceIds.add(archive.deviceId);
                const validatedLogs = archive.logs.map((archiveLog) => {
                    const contents = sanitizeImportedLogBuffer(
                        archiveLog.contents,
                    );
                    const parsed = requireImportedLog(contents);
                    if (parsed.metadata?.deviceId) {
                        sourceDeviceIds.add(parsed.metadata.deviceId);
                    }
                    return {
                        /** The original file name value. */
                        fileName: archiveLog.fileName,
                        /** The sanitized log contents value. */
                        contents,
                    };
                });
                const incomingByteCount = requireImportCapacity(
                    imported.length,
                    importedByteCount,
                    validatedLogs.map((logFile) => logFile.contents),
                );
                for (const archiveLog of validatedLogs) {
                    imported.push(
                        await writeImportedLog(
                            groupDirectory,
                            groupId,
                            archiveLog.fileName,
                            archiveLog.contents,
                        ),
                    );
                }
                importedByteCount += incomingByteCount;
            } else {
                throw new LogImportError('unsafe-file');
            }
        } catch (reason) {
            rejected.push({
                /** The selected file name value. */
                fileName: path.basename(selectedPath),
                /** The rejection reason value. */
                reason: resolveImportFailureReason(reason),
            });
        }
    }
    if (imported.length === 0) {
        await removeEmptyExternalGroupDirectory(groupDirectory, externalRoot);
        return {
            /** The status value. */
            status: 'completed',
            /** The imported file values. */
            imported,
            /** The rejected file values. */
            rejected,
        };
    }
    const groupMetadata: ExternalLogGroupMetadata = {
        /** The metadata schema version value. */
        schemaVersion: 1,
        /** The stable readable group ID value. */
        id: groupId,
        /** The user-assigned alias value. */
        alias: normalizeGroupAlias(alias),
        /** The source installation ID values. */
        sourceDeviceIds: [...sourceDeviceIds].sort(),
        /** The import timestamp value. */
        importedAt: new Date().toISOString(),
    };
    await writeFile(
        path.join(groupDirectory, EXTERNAL_GROUP_METADATA_FILE_NAME),
        JSON.stringify(groupMetadata, null, 2),
        { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );
    const group: ApplicationLogGroupSummary = {
        /** The stable group ID value. */
        id: groupMetadata.id,
        /** The user-assigned alias value. */
        alias: groupMetadata.alias,
        /** The source installation ID values. */
        sourceDeviceIds: groupMetadata.sourceDeviceIds,
        /** The import timestamp value. */
        importedAt: groupMetadata.importedAt,
        /** The contained log count value. */
        fileCount: imported.length,
    };
    return {
        /** The status value. */
        status: 'completed',
        /** The created external group value. */
        group,
        /** The imported file values. */
        imported,
        /** The rejected file values. */
        rejected,
    };
}

/** Opens the localized native picker; only the manager turns its paths into an opaque Renderer token. */
export async function selectLogImportPaths(
    locale: AppLocale,
): Promise<readonly string[]> {
    const selection = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
            {
                name: getLocaleMessages(locale, app.getLocale()).nativeDialogs
                    .logFiles,
                extensions: ['log', 'kawailog'],
            },
        ],
    });
    return selection.canceled ? [] : selection.filePaths;
}
