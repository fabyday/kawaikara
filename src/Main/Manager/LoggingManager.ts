import { randomUUID } from 'node:crypto';
import type { WebContents } from 'electron';
import type {
    AppLocale,
    ApplicationLogDocument,
    ApplicationLogMetadata,
    ApplicationLogRepository,
    ApplicationLogFileSummary,
    ApplicationLogGroupSummary,
    ApplicationLogFileReference,
    ApplicationLogExportResult,
    ApplicationLogDeleteResult,
    ApplicationLogImportSelection,
    ApplicationLogImportResult,
    LogLevelPreference,
    LogSourcePreference,
} from '../../Common/IPC';
import { getKawaiDataPath } from '../Functional/App/UserDataPaths';
import {
    createLogMetadata,
    getOrCreateLogDeviceId,
    createAvailableLogFileName,
} from '../Functional/Logging/LogSession';
import {
    initializeLogTransport,
    createScopedLogger,
    isLogSourceEnabled,
    configureLogTransport,
} from '../Functional/Logging/LogTransport';
import { connectRendererLogging } from '../Functional/Logging/RendererLoggingEvents';
import {
    type LogRepositoryState,
    listLogGroups,
    listLogFiles,
    readLogDocument,
    deleteLogFiles,
    openLogDirectory,
} from '../Functional/Logging/LogRepository';
import {
    exportFiles,
    importFiles,
    selectLogImportPaths,
} from '../Functional/Logging/LogTransfer';
import type {
    ApplicationLogSourceId,
    PendingLogImport,
} from '../Functional/Logging/LogTypes';
import { PENDING_IMPORT_MAX_AGE_MS } from '../Functional/Logging/LogConstants';
export type { ApplicationLogSourceId } from '../Functional/Logging/LogTypes';

/** Owns logging session, source preferences and pending picker tokens; functional modules perform I/O and event wiring. */
export class LoggingManager {
    /** The initialized value. */
    private initialized = false;
    /** The session ID value. */
    private readonly sessionId = randomUUID();
    /** The persistent readable installation ID value. */
    private readonly deviceId = getOrCreateLogDeviceId();
    /** The trusted session metadata value. */
    private readonly metadata = createLogMetadata(
        this.sessionId,
        this.deviceId,
    );
    /** The active session log file name value. */
    private readonly logFileName = createAvailableLogFileName(new Date());
    /** The pending native import selections keyed by opaque token. */
    private readonly pendingImports = new Map<string, PendingLogImport>();
    /** Source IDs enabled for file logging; undefined means every source. */
    private enabledSourceIds?: ReadonlySet<string>;
    /** Filesystem root and parsed-document cache for this session. */
    private readonly repository: LogRepositoryState = {
        /** The directory value. */
        directory: getKawaiDataPath('logs'),
        /** The log file name value. */
        logFileName: this.logFileName,
    };
    /** Returns trusted current-session metadata without reading a log file. */
    getMetadata(): ApplicationLogMetadata {
        return structuredClone(this.metadata);
    }
    /** Initializes the process transport once and records successful setup. */
    initialize(): void {
        if (this.initialized) return;
        initializeLogTransport(
            this.getLogFilePath(),
            this.logFileName,
            this.metadata,
            (scope) => isLogSourceEnabled(this.enabledSourceIds, scope),
        );
        this.initialized = true;
        this.getLogger('application').info('Log session started.');
    }
    /** Returns a scoped source logger; location is normalized by the transport module. */
    getLogger(source: ApplicationLogSourceId, location?: string) {
        return createScopedLogger(source, location);
    }
    /** Returns the updater logger. */
    get updaterLogger() {
        return this.getLogger('updates');
    }
    /** Updates dynamic file-source filtering and the preference/environment severity threshold. */
    configure(level: LogLevelPreference, sources: LogSourcePreference): void {
        configureLogTransport(level);
        this.enabledSourceIds =
            sources === 'all' ? undefined : new Set(sources);
    }
    /** Returns the log file path. */
    getLogFilePath(): string {
        return getKawaiDataPath('logs', this.logFileName);
    }
    /** Opens the application log repository in the OS file browser. */
    openDirectory(): Promise<void> {
        return openLogDirectory(this.repository, 'application');
    }
    /** Lists validated external groups without parsing their log contents. */
    listGroups(): Promise<ApplicationLogGroupSummary[]> {
        return listLogGroups(this.repository);
    }
    /** Lists summaries for an application repository or one validated external group. */
    listFiles(
        repository: ApplicationLogRepository,
        groupId?: string,
    ): Promise<ApplicationLogFileSummary[]> {
        return listLogFiles(this.repository, repository, groupId);
    }
    /** Reads one validated file; repeated reads reuse the repository's fingerprinted document. */
    readFile(
        repository: ApplicationLogRepository,
        fileName: string,
        groupId?: string,
    ): Promise<ApplicationLogDocument> {
        return readLogDocument(this.repository, repository, fileName, groupId);
    }
    /** Opens a validated repository/group in the OS file browser. */
    openRepositoryDirectory(
        repository: ApplicationLogRepository,
        groupId?: string,
    ): Promise<void> {
        return openLogDirectory(this.repository, repository, groupId);
    }
    /** Exports selected validated logs through the native save dialog. */
    exportFiles(
        references: readonly ApplicationLogFileReference[],
        locale: AppLocale = 'system',
    ): Promise<ApplicationLogExportResult> {
        return exportFiles(
            this.repository,
            this.metadata,
            this.deviceId,
            references,
            locale,
        );
    }
    /** Deletes selected inactive logs and removes resulting empty external groups. */
    deleteFiles(
        references: readonly ApplicationLogFileReference[],
    ): Promise<ApplicationLogDeleteResult> {
        return deleteLogFiles(this.repository, references);
    }
    /** Opens the native picker and stages a bounded external import. */
    async selectImportFiles(
        locale: AppLocale = 'system',
    ): Promise<ApplicationLogImportSelection> {
        this.removeExpiredPendingImports();
        const filePaths = await selectLogImportPaths(locale);
        if (filePaths.length === 0) {
            return {
                /** The status value. */
                status: 'cancelled',
            };
        }
        const token = randomUUID();
        this.pendingImports.set(token, {
            /** The selected absolute path values. */
            filePaths: filePaths,
            /** The selection creation timestamp value. */
            createdAt: Date.now(),
        });
        return {
            /** The status value. */
            status: 'ready',
            /** The opaque pending import token value. */
            token,
            /** The selected input count value. */
            inputCount: filePaths.length,
        };
    }
    /** Cancels and forgets one staged external import. */
    cancelImport(token: string): void {
        this.pendingImports.delete(token);
    }
    /** Consumes a picker token once before handing its trusted paths to the import pipeline. */
    async importFiles(
        token: string,
        alias: string,
    ): Promise<ApplicationLogImportResult> {
        this.removeExpiredPendingImports();
        const pending = this.pendingImports.get(token);
        this.pendingImports.delete(token);
        if (!pending) throw new Error('The pending log import has expired.');
        return importFiles(this.repository, pending.filePaths, alias);
    }
    /** Removes expired native file-picker tokens. */
    private removeExpiredPendingImports(): void {
        const oldestAllowed = Date.now() - PENDING_IMPORT_MAX_AGE_MS;
        for (const [token, pending] of this.pendingImports) {
            if (pending.createdAt < oldestAllowed)
                this.pendingImports.delete(token);
        }
    }
    /** Connects renderer diagnostics and returns an explicit, idempotent unsubscription callback. */
    attachRenderer(
        webContents: WebContents,
        source: ApplicationLogSourceId,
        includeMessage: (message: string) => boolean = () => true,
        location?: string,
    ): () => void {
        return connectRendererLogging(
            createScopedLogger,
            webContents,
            source,
            includeMessage,
            location,
        );
    }
    /** Performs the finish operation. */
    finish(): void {
        if (!this.initialized) return;
        this.getLogger('application').info('Log session finished.', {
            sessionId: this.sessionId,
        });
    }
}
