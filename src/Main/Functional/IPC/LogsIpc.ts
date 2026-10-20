import path from 'node:path';
import {
    IPC_CHANNELS,
    type ApplicationLogFileReference,
    type ApplicationLogRepository,
} from '../../../Common/IPC';
import type { LoggingManager } from '../../Manager/LoggingManager';
import type { PreferenceManager } from '../../Manager/PreferenceManager';
import { type ViewerRuntime } from '../Viewer/ViewerRuntime';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Bounds one log export/delete request. */
const MAX_LOG_FILE_SELECTION = 128;

/** Dependencies used by logs IPC only. */
interface LogsIpcDependencies {
    /** Application-scoped logging dependency. */
    readonly logging: LoggingManager;
    /** Application-scoped viewerRuntime dependency. */
    readonly viewerRuntime: Pick<ViewerRuntime, 'diagnostics'>;
    /** Application-scoped preferences dependency. */
    readonly preferences: PreferenceManager;
}

/** Connects logs requests and events to their application services. */
export function connectLogsIpc({
    logging,
    viewerRuntime,
    preferences,
}: LogsIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.handle(
            IPC_CHANNELS.logViewer.command,
            (event, command: unknown) => {
                if (event.senderFrame !== event.sender.mainFrame)
                    throw new Error(
                        'Log viewer commands require the main frame.',
                    );
                return viewerRuntime.diagnostics.commandLogViewer(
                    event.sender.id,
                    command,
                );
            },
        );
        ipc.handle(IPC_CHANNELS.application.openLogDirectory, () =>
            logging.openDirectory(),
        );
        ipc.handle(
            IPC_CHANNELS.application.openLogRepositoryDirectory,
            (_event, repository: unknown, groupId: unknown) =>
                logging.openRepositoryDirectory(
                    requireLogRepository(repository),
                    requireOptionalLogGroupId(groupId),
                ),
        );
        ipc.handle(IPC_CHANNELS.application.listLogGroups, () =>
            logging.listGroups(),
        );
        ipc.handle(
            IPC_CHANNELS.application.listLogFiles,
            (_event, repository: unknown, groupId: unknown) =>
                logging.listFiles(
                    requireLogRepository(repository),
                    requireOptionalLogGroupId(groupId),
                ),
        );
        ipc.handle(
            IPC_CHANNELS.application.readLogFile,
            (
                _event,
                repository: unknown,
                fileName: unknown,
                groupId: unknown,
            ) => {
                if (typeof fileName !== 'string') {
                    throw new TypeError('A log file name is required.');
                }
                return logging.readFile(
                    requireLogRepository(repository),
                    fileName,
                    requireOptionalLogGroupId(groupId),
                );
            },
        );
        ipc.handle(
            IPC_CHANNELS.application.exportLogFiles,
            (_event, references: unknown) =>
                logging.exportFiles(
                    requireLogFileReferences(references),
                    preferences.get().appLocale,
                ),
        );
        ipc.handle(
            IPC_CHANNELS.application.deleteLogFiles,
            (_event, references: unknown) =>
                logging.deleteFiles(requireLogFileReferences(references)),
        );
        ipc.handle(IPC_CHANNELS.application.selectLogImportFiles, () =>
            logging.selectImportFiles(preferences.get().appLocale),
        );
        ipc.handle(
            IPC_CHANNELS.application.importLogFiles,
            (_event, token: unknown, alias: unknown) => {
                if (typeof token !== 'string' || typeof alias !== 'string') {
                    throw new TypeError(
                        'A pending import token and alias are required.',
                    );
                }
                return logging.importFiles(token, alias);
            },
        );
        ipc.handle(
            IPC_CHANNELS.application.cancelLogImport,
            (_event, token: unknown) => {
                if (typeof token !== 'string') {
                    throw new TypeError('A pending import token is required.');
                }
                logging.cancelImport(token);
            },
        );
    });
}

/** Requires a supported application log repository. */
function requireLogRepository(value: unknown): ApplicationLogRepository {
    if (value === 'application' || value === 'external') return value;
    throw new TypeError('Unknown application log repository.');
}

/** Requires an optional bounded external log group ID. */
function requireOptionalLogGroupId(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (
        typeof value === 'string' &&
        (value === 'ungrouped' ||
            /^LOGSET-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value))
    ) {
        return value;
    }
    throw new TypeError('Invalid external log group ID.');
}

/** Requires a bounded list of application log file references. */
function requireLogFileReferences(
    value: unknown,
): readonly ApplicationLogFileReference[] {
    if (
        !Array.isArray(value) ||
        value.length === 0 ||
        value.length > MAX_LOG_FILE_SELECTION
    ) {
        throw new TypeError('A bounded log file selection is required.');
    }
    return value.map((entry) => {
        if (
            typeof entry !== 'object' ||
            entry === null ||
            !('repository' in entry) ||
            !('fileName' in entry)
        ) {
            throw new TypeError('Invalid log file reference.');
        }
        const repository = requireLogRepository(entry.repository);
        if (
            typeof entry.fileName !== 'string' ||
            entry.fileName !== path.basename(entry.fileName) ||
            !entry.fileName.toLowerCase().endsWith('.log')
        ) {
            throw new TypeError('Invalid log file name.');
        }
        return {
            /** The repository value. */
            repository,
            /** The file name value. */
            fileName: entry.fileName,
            /** The owning external group ID value. */
            groupId: requireOptionalLogGroupId(
                'groupId' in entry ? entry.groupId : undefined,
            ),
        };
    });
}
