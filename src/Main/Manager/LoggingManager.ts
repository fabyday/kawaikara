import { getLocaleMessages } from '../Functional/Locale';
import type { AppLocale } from '../../Common/IPC';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rmdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { app, dialog, shell, type WebContents } from 'electron';
import log from 'electron-log/main';
import { KAWAIKARA_SITE_API_VERSION } from '@kawaikara/site-api';
import { BUILD_CHANNEL } from '../../Common/BuildConfig';
import type {
  ApplicationLogDocument,
  ApplicationLogDeleteResult,
  ApplicationLogEntry,
  ApplicationLogFileSummary,
  ApplicationLogFileReference,
  ApplicationLogGroupSummary,
  ApplicationLogImportFailure,
  ApplicationLogImportFailureReason,
  ApplicationLogImportResult,
  ApplicationLogImportSelection,
  ApplicationLogMetadata,
  ApplicationLogRepository,
  ApplicationLogSourceDefinition,
  ApplicationLogLevel,
  ApplicationLogExportResult,
  LogLevelPreference,
  LogSourcePreference,
} from '../../Common/IPC';
import {
  APPLICATION_LOG_SOURCES,
  type ApplicationLogSourceKey,
} from '../../Common/Logging';
import {
  formatConsoleSource,
  resolveEnvironmentLogLevel,
  resolveLogLevel,
  resolvePreferenceLogLevel,
  sanitizeLogValue,
} from '../Functional/Logging';
import { getKawaiDataPath } from '../Functional/UserDataPaths';
import { getOperatingSystemLabel } from '../Functional/PlatformInfo';
import {
  createKawaiLogArchive,
  KAWAI_LOG_ARCHIVE_EXTENSION,
  KawaiLogArchiveError,
  readKawaiLogArchive,
} from '../Functional/LogArchive';

/** Defines the shared log max size bytes constant. */
const LOG_MAX_SIZE_BYTES = 5 * 1024 * 1024;
/** Defines the maximum number of parsed entries returned to the renderer. */
const LOG_VIEWER_ENTRY_LIMIT = 5_000;
/** Defines the maximum accepted size of one imported log. */
const IMPORTED_LOG_MAX_SIZE_BYTES = 16 * 1024 * 1024;
/** Defines the maximum number of selected inputs accepted from one picker operation. */
const IMPORTED_LOG_INPUT_MAX_COUNT = 32;
/** Defines the maximum number of extracted logs stored by one import operation. */
const IMPORTED_LOG_OUTPUT_MAX_COUNT = 128;
/** Defines the maximum combined UTF-8 log size stored by one import operation. */
const IMPORTED_LOG_TOTAL_SIZE_BYTES = 64 * 1024 * 1024;
/** Defines the maximum retained length of one imported log line. */
const IMPORTED_LOG_MAX_LINE_LENGTH = 65_536;
/** Defines the maximum accepted number of lines in one imported log. */
const IMPORTED_LOG_MAX_LINE_COUNT = 200_000;
/** Defines the maximum visible size of one joined log message. */
const LOG_VIEWER_MESSAGE_MAX_LENGTH = 256 * 1024;
/** Defines the external log repository directory name. */
const EXTERNAL_LOG_DIRECTORY_NAME = 'external';
/** Defines the external group metadata file name. */
const EXTERNAL_GROUP_METADATA_FILE_NAME = 'group.json';
/** Defines the virtual group containing legacy raw external logs. */
const EXTERNAL_UNGROUPED_GROUP_ID = 'ungrouped';
/** Defines the persistent readable log device identity file name. */
const LOG_DEVICE_ID_FILE_NAME = 'log-device.json';
/** Defines the maximum age of an unconfirmed import selection. */
const PENDING_IMPORT_MAX_AGE_MS = 10 * 60 * 1_000;
/** Defines the structured metadata header prefix. */
const LOG_METADATA_PREFIX = '#!kawaikara-log-v1 ';
/** Matches the beginning of an electron-log file line. */
const LOG_ENTRY_PATTERN =
  /^\[([^\]]+)]\s+\[([^\]]+)]\s+(?:\(([^)]+)\)\s+)?(.*)$/;
/** Matches ANSI terminal control sequences in imported text. */
const ANSI_ESCAPE_PATTERN = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
/** Matches unsafe control characters while preserving tabs and line breaks. */
const UNSAFE_CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001a\u001c-\u001f\u007f]/g;

/** Defines a registered application log source key. */
export type ApplicationLogSourceId = ApplicationLogSourceKey;

/** Describes an external log group metadata document. */
interface ExternalLogGroupMetadata {
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

/** Describes a staged native file-picker selection. */
interface PendingLogImport {
  /** The selected absolute path values. */
  readonly filePaths: readonly string[];
  /** The selection creation timestamp value. */
  readonly createdAt: number;
}

/** Coordinates logging behavior. */
export class LoggingManager {
  /** The initialized value. */
  private initialized = false;
  /** The session ID value. */
  private readonly sessionId = randomUUID();
  /** The persistent readable installation ID value. */
  private readonly deviceId = getOrCreateLogDeviceId();
  /** The trusted session metadata value. */
  private readonly metadata = createLogMetadata(this.sessionId, this.deviceId);
  /** The active session log file name value. */
  private readonly logFileName = createAvailableLogFileName(new Date());
  /** The pending native import selections keyed by opaque token. */
  private readonly pendingImports = new Map<string, PendingLogImport>();
  /** Source IDs enabled for file logging; undefined means every source. */
  private enabledSourceIds?: ReadonlySet<string>;

  /** Initializes the operation. */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    const logFilePath = this.getLogFilePath();
    mkdirSync(path.dirname(logFilePath), { recursive: true
    });
    writeFileSync(
      logFilePath,
      `${LOG_METADATA_PREFIX}${JSON.stringify(this.metadata)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600
      },
    );

    log.scope.labelPadding = false;
    log.transports.file.fileName = this.logFileName;
    log.transports.file.level = resolveLogLevel();
    log.transports.file.maxSize = LOG_MAX_SIZE_BYTES;
    log.transports.file.resolvePathFn = () => this.getLogFilePath();
    log.transports.file.inspectOptions = {
      depth: 5,
      maxArrayLength: 80,
      maxStringLength: 8_000,
    };
    log.transports.console.level = app.isPackaged ? 'info' : 'debug';
    log.hooks.push((message, _transport, transportName) => {
      if (
        transportName === 'file' &&
        !this.isSourceEnabled(message.scope)
      ) {
        return false;
      }
      return {
        ...message,
        data: message.data.map((value) => sanitizeLogValue(value)),
      };
    });

    // Route existing manager and plugin console calls through the same file
    // transport without exposing a logging IPC bridge to remote site pages.
    Object.assign(console, log.functions);
    log.errorHandler.startCatching({ showDialog: false
    });
    log.eventLogger.startLogging({
      level: 'warn',
      scope: 'electron',
    });

    this.getLogger('application').info('Log session started.');
  }

  /** Returns a logger registered for an application class or call location. */
  getLogger(source: ApplicationLogSourceId, location?: string) {
    const definition = APPLICATION_LOG_SOURCES[source];
    const normalizedLocation = normalizeLogLocation(location);
    return log.scope(
      normalizedLocation
        ? `${definition.scope}/${normalizedLocation}`
        : definition.scope,
    );
  }

  /** Returns the updater logger. */
  get updaterLogger() {
    return this.getLogger('updates');
  }

  /** Performs the configure level operation. */
  configure(level: LogLevelPreference, sources: LogSourcePreference): void {
    const environmentLevel = resolveEnvironmentLogLevel();
    log.transports.file.level =
      environmentLevel ?? resolvePreferenceLogLevel(level);
    this.enabledSourceIds = sources === 'all'
      ? undefined
      : new Set(sources);
  }

  /** Returns whether a scoped message is enabled for the file transport. */
  private isSourceEnabled(scope?: string): boolean {
    if (!this.enabledSourceIds) return true;
    const resolvedScope = scope ?? APPLICATION_LOG_SOURCES.application.scope;
    const source = Object.values(APPLICATION_LOG_SOURCES).find((definition) =>
      resolvedScope === definition.scope || resolvedScope.startsWith(`${definition.scope}/`));
    return source ? this.enabledSourceIds.has(source.id) : false;
  }

  /** Returns the log file path. */
  getLogFilePath(): string {
    return getKawaiDataPath('logs', this.logFileName);
  }

  /** Opens the directory. */
  async openDirectory(): Promise<void> {
    const directory = path.dirname(this.getLogFilePath());
    mkdirSync(directory, { recursive: true
    });
    const error = await shell.openPath(directory);
    if (error) throw new Error(error);
  }

  /** Lists the safely readable external log groups. */
  async listGroups(): Promise<ApplicationLogGroupSummary[]> {
    const externalDirectory = this.getRepositoryDirectory('external');
    await mkdir(externalDirectory, { recursive: true
    });
    const entries = await readdir(externalDirectory, { withFileTypes: true
    });
    const groups: ApplicationLogGroupSummary[] = [];
    const ungroupedFiles = entries.filter((entry) =>
      entry.isFile() && entry.name.toLowerCase().endsWith('.log'));
    if (ungroupedFiles.length > 0) {
      const fileMetadata = await Promise.all(ungroupedFiles.map((entry) =>
        stat(path.join(externalDirectory, entry.name))));
      groups.push({
        /** The stable group ID value. */
        id: EXTERNAL_UNGROUPED_GROUP_ID,
        /** The user-assigned alias value. */
        alias: '',
        /** The source installation ID values. */
        sourceDeviceIds: [],
        /** The import timestamp value. */
        importedAt: fileMetadata
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
      right.importedAt.localeCompare(left.importedAt));
  }

  /** Lists one log repository or external group with the active session first. */
  async listFiles(
    repository: ApplicationLogRepository,
    groupId?: string,
  ): Promise<ApplicationLogFileSummary[]> {
    if (repository === 'external' && !groupId) return [];
    const directory = await this.getLogDirectory(repository, groupId);
    await mkdir(directory, { recursive: true
    });
    const entries = await listLogFilesInDirectory(directory);
    const summaries = await Promise.all(entries.map(async (entry) => {
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
        active: repository === 'application' && entry.name === this.logFileName,
      } satisfies ApplicationLogFileSummary;
    }));
    return summaries.sort(compareLogFileSummaries);
  }

  /** Reads and parses one application log file. */
  async readFile(
    repository: ApplicationLogRepository,
    fileName: string,
    groupId?: string,
  ): Promise<ApplicationLogDocument> {
    const file = await this.requireLogFile(repository, fileName, groupId);
    const directory = await this.getLogDirectory(repository, groupId);
    const filePath = path.join(directory, file.fileName);
    const value = repository === 'external'
      ? await readImportedLog(filePath)
      : await readFile(filePath, 'utf8');
    const parsed = parseLogEntries(value);
    if (
      repository === 'external' &&
      (parsed.invalidMetadata || parsed.entries.length === 0)
    ) {
      throw new Error('The external log failed safety validation.');
    }
    return {
      /** The source file summary value. */
      file,
      /** The validated metadata header value. */
      metadata: parsed.metadata,
      /** The parsed entries value. */
      entries: parsed.entries,
      /** Whether older entries were omitted. */
      truncated: parsed.truncated,
    };
  }

  /** Opens one log repository or external group directory. */
  async openRepositoryDirectory(
    repository: ApplicationLogRepository,
    groupId?: string,
  ): Promise<void> {
    const directory = repository === 'external' && !groupId
      ? this.getRepositoryDirectory('external')
      : await this.getLogDirectory(repository, groupId);
    await mkdir(directory, { recursive: true
    });
    const error = await shell.openPath(directory);
    if (error) throw new Error(error);
  }

  /** Exports selected logs as one verified Kawai log archive. */
  async exportFiles(
    references: readonly ApplicationLogFileReference[],
    locale: AppLocale = 'system',
  ): Promise<ApplicationLogExportResult> {
    const uniqueReferences = deduplicateLogReferences(references);
    if (uniqueReferences.length === 0 || uniqueReferences.length > 128) {
      throw new TypeError('Between 1 and 128 log files must be selected.');
    }
    const sources = [];
    for (const reference of uniqueReferences) {
      const file = await this.requireLogFile(
        reference.repository,
        reference.fileName,
        reference.groupId,
      );
      const directory = await this.getLogDirectory(
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
    const externalGroupIds = new Set(uniqueReferences
      .filter((reference) => reference.repository === 'external')
      .map((reference) => reference.groupId));
    if (externalGroupIds.size === 1) {
      const groupId = [...externalGroupIds][0];
      const group = (await this.listGroups()).find((value) => value.id === groupId);
      if (group?.alias) alias = group.alias;
    }
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(
        app.getPath('documents'),
        `${createPortableArchiveStem(alias)}${KAWAI_LOG_ARCHIVE_EXTENSION}`,
      ),
      filters: [{ name: getLocaleMessages(locale, app.getLocale()).nativeDialogs.logArchive, extensions: ['kawailog']
      }],
    });
    if (result.canceled || !result.filePath) {
      return {
        /** The status value. */
        status: 'cancelled',
      };
    }
    const destinationPath = result.filePath.toLowerCase().endsWith(
      KAWAI_LOG_ARCHIVE_EXTENSION,
    )
      ? result.filePath
      : `${result.filePath}${KAWAI_LOG_ARCHIVE_EXTENSION}`;
    await createKawaiLogArchive(
      destinationPath,
      alias,
      {
        /** The application name value. */
        applicationName: this.metadata.applicationName,
        /** The application version value. */
        version: this.metadata.version,
        /** The release channel value. */
        channel: this.metadata.channel,
        /** The operating system label value. */
        platform: this.metadata.platform,
        /** The processor architecture value. */
        arch: this.metadata.arch,
        /** The Site API version value. */
        siteApiVersion: this.metadata.siteApiVersion,
        /** The runtime version values. */
        runtime: this.metadata.runtime,
        /** The readable installation ID value. */
        deviceId: this.deviceId,
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

  /** Deletes selected inactive log files and empty external groups. */
  async deleteFiles(
    references: readonly ApplicationLogFileReference[],
  ): Promise<ApplicationLogDeleteResult> {
    const uniqueReferences = deduplicateLogReferences(references);
    const skipped: ApplicationLogFileReference[] = [];
    const affectedGroups = new Set<string>();
    let deleted = 0;
    for (const reference of uniqueReferences) {
      try {
        const file = await this.requireLogFile(
          reference.repository,
          reference.fileName,
          reference.groupId,
        );
        if (file.active) {
          skipped.push(reference);
          continue;
        }
        const directory = await this.getLogDirectory(
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
      await this.removeExternalGroupIfEmpty(groupId);
    }
    return {
      /** The number of deleted log files. */
      deleted,
      /** The skipped log file values. */
      skipped,
    };
  }

  /** Opens the native picker and stages a bounded external import. */
  async selectImportFiles(locale: AppLocale = 'system'): Promise<ApplicationLogImportSelection> {
    this.removeExpiredPendingImports();
    const selection = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{
        name: getLocaleMessages(locale, app.getLocale()).nativeDialogs.logFiles,
        extensions: ['log', 'kawailog'],
      }],
    });
    if (selection.canceled || selection.filePaths.length === 0) {
      return {
        /** The status value. */
        status: 'cancelled',
      };
    }
    const token = randomUUID();
    this.pendingImports.set(token, {
      /** The selected absolute path values. */
      filePaths: selection.filePaths,
      /** The selection creation timestamp value. */
      createdAt: Date.now(),
    });
    return {
      /** The status value. */
      status: 'ready',
      /** The opaque pending import token value. */
      token,
      /** The selected input count value. */
      inputCount: selection.filePaths.length,
    };
  }

  /** Cancels and forgets one staged external import. */
  cancelImport(token: string): void {
    this.pendingImports.delete(token);
  }

  /** Imports staged raw logs and verified Kawai log archives into one group. */
  async importFiles(
    token: string,
    alias: string,
  ): Promise<ApplicationLogImportResult> {
    this.removeExpiredPendingImports();
    const pending = this.pendingImports.get(token);
    this.pendingImports.delete(token);
    if (!pending) throw new Error('The pending log import has expired.');

    const groupId = createExternalGroupId();
    const externalRoot = this.getRepositoryDirectory('external');
    const groupDirectory = path.join(externalRoot, groupId);
    await mkdir(externalRoot, { recursive: true
    });
    await mkdir(groupDirectory, { recursive: false
    });
    const imported: ApplicationLogFileSummary[] = [];
    const rejected: ApplicationLogImportFailure[] = [];
    const sourceDeviceIds = new Set<string>();
    let importedByteCount = 0;
    const selectedPaths = pending.filePaths.slice(0, IMPORTED_LOG_INPUT_MAX_COUNT);
    for (const skippedPath of pending.filePaths.slice(IMPORTED_LOG_INPUT_MAX_COUNT)) {
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
          imported.push(await writeImportedLog(
            groupDirectory,
            groupId,
            path.basename(selectedPath),
            contents,
          ));
          importedByteCount += incomingByteCount;
        } else if (extension === KAWAI_LOG_ARCHIVE_EXTENSION) {
          const archive = await readKawaiLogArchive(
            selectedPath,
            app.getPath('temp'),
          );
          sourceDeviceIds.add(archive.deviceId);
          const validatedLogs = archive.logs.map((archiveLog) => {
            const contents = sanitizeImportedLogBuffer(archiveLog.contents);
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
            imported.push(await writeImportedLog(
              groupDirectory,
              groupId,
              archiveLog.fileName,
              archiveLog.contents,
            ));
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
      { encoding: 'utf8', flag: 'wx', mode: 0o600
      },
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

  /** Resolves a renderer-provided file name to an existing log summary. */
  private async requireLogFile(
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
    const file = (await this.listFiles(repository, groupId))
      .find((entry) => entry.fileName === fileName);
    if (!file) throw new Error('The requested log file no longer exists.');
    return file;
  }

  /** Returns the resolved root for a log repository. */
  private getRepositoryDirectory(repository: ApplicationLogRepository): string {
    const applicationDirectory = path.dirname(this.getLogFilePath());
    return repository === 'external'
      ? path.join(applicationDirectory, EXTERNAL_LOG_DIRECTORY_NAME)
      : applicationDirectory;
  }

  /** Returns a validated application or external group log directory. */
  private async getLogDirectory(
    repository: ApplicationLogRepository,
    groupId?: string,
  ): Promise<string> {
    if (repository === 'application') return this.getRepositoryDirectory(repository);
    if (!groupId) throw new TypeError('An external log group is required.');
    const externalRoot = this.getRepositoryDirectory('external');
    if (groupId === EXTERNAL_UNGROUPED_GROUP_ID) return externalRoot;
    const group = (await this.listGroups()).find((value) => value.id === groupId);
    if (!group) throw new Error('The external log group no longer exists.');
    return path.join(externalRoot, group.id);
  }

  /** Removes one external group after its last log was deleted. */
  private async removeExternalGroupIfEmpty(groupId: string): Promise<void> {
    const directory = await this.getLogDirectory('external', groupId);
    const files = await listLogFilesInDirectory(directory);
    if (files.length > 0) return;
    await removeEmptyExternalGroupDirectory(
      directory,
      this.getRepositoryDirectory('external'),
    );
  }

  /** Removes expired native file-picker tokens. */
  private removeExpiredPendingImports(): void {
    const oldestAllowed = Date.now() - PENDING_IMPORT_MAX_AGE_MS;
    for (const [token, pending] of this.pendingImports) {
      if (pending.createdAt < oldestAllowed) this.pendingImports.delete(token);
    }
  }

  /** Attaches the renderer. */
  attachRenderer(
    webContents: WebContents,
    source: ApplicationLogSourceId,
    includeMessage: (message: string) => boolean = () => true,
    location?: string,
  ): () => void {
    const rendererLog = this.getLogger(source, location);
    /** Handles the console message. */
    const handleConsoleMessage = (
      details: Electron.Event<Electron.WebContentsConsoleMessageEventParams>,
    ) => {
      if (!includeMessage(details.message)) return;
      const consoleSource = formatConsoleSource(
        details.sourceId,
        details.lineNumber,
      );
      const consoleLocation = consoleSource.split(/[\\/]/).at(-1);
      const targetLocation = [location, consoleLocation]
        .filter((value): value is string => Boolean(value))
        .join('/');
      const targetLog = targetLocation
        ? this.getLogger(source, targetLocation)
        : rendererLog;
      switch (details.level) {
        case 'error':
          targetLog.error(details.message);
          break;
        case 'warning':
          targetLog.warn(details.message);
          break;
        case 'debug':
          targetLog.debug(details.message);
          break;
        default:
          targetLog.info(details.message);
          break;
      }
    };
    /** Handles the unresponsive. */
    const handleUnresponsive = () =>
      rendererLog.warn('Renderer became unresponsive.');
    /** Handles the responsive. */
    const handleResponsive = () =>
      rendererLog.info('Renderer became responsive again.');
    /** Releases the operation. */
    const dispose = () => {
      webContents.off('console-message', handleConsoleMessage);
      webContents.off('unresponsive', handleUnresponsive);
      webContents.off('responsive', handleResponsive);
    };

    webContents.on('console-message', handleConsoleMessage);
    webContents.on('unresponsive', handleUnresponsive);
    webContents.on('responsive', handleResponsive);
    webContents.once('destroyed', dispose);
    return dispose;
  }

  /** Performs the finish operation. */
  finish(): void {
    if (!this.initialized) return;
    this.getLogger('application').info('Log session finished.', {
      sessionId: this.sessionId,
    });
  }
}

/** Returns the persistent human-readable installation identity for logs. */
function getOrCreateLogDeviceId(): string {
  const identityPath = getKawaiDataPath(LOG_DEVICE_ID_FILE_NAME);
  try {
    const parsed: unknown = JSON.parse(readFileSync(identityPath, 'utf8'));
    if (
      isRecord(parsed) &&
      parsed.schemaVersion === 1 &&
      typeof parsed.deviceId === 'string' &&
      /^KAWA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(parsed.deviceId)
    ) {
      return parsed.deviceId;
    }
  } catch {
    // A missing or invalid app-owned identity is safely replaced below.
  }
  const compactId = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  const deviceId = `KAWA-${compactId.slice(0, 4)}-${compactId.slice(4)}`;
  mkdirSync(path.dirname(identityPath), { recursive: true
  });
  writeFileSync(identityPath, JSON.stringify({
    /** The identity schema version value. */
    schemaVersion: 1,
    /** The readable installation ID value. */
    deviceId,
    /** The identity creation timestamp value. */
    createdAt: new Date().toISOString(),
  }, null, 2), { encoding: 'utf8', mode: 0o600
  });
  return deviceId;
}

/** Reads one bounded external group metadata document. */
async function readExternalGroupMetadata(
  directory: string,
): Promise<ExternalLogGroupMetadata | undefined> {
  try {
    const metadataPath = path.join(directory, EXTERNAL_GROUP_METADATA_FILE_NAME);
    const fileMetadata = await lstat(metadataPath);
    if (
      !fileMetadata.isFile() ||
      fileMetadata.isSymbolicLink() ||
      fileMetadata.size > 64 * 1024
    ) {
      return undefined;
    }
    const value: unknown = JSON.parse(await readFile(metadataPath, 'utf8'));
    if (
      !isRecord(value) ||
      value.schemaVersion !== 1 ||
      typeof value.id !== 'string' ||
      !/^LOGSET-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value.id) ||
      typeof value.alias !== 'string' ||
      value.alias.length > 120 ||
      !Array.isArray(value.sourceDeviceIds) ||
      value.sourceDeviceIds.length > 64 ||
      !value.sourceDeviceIds.every((entry) =>
        typeof entry === 'string' && entry.length <= 80) ||
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
  const entries = await readdir(directory, { withFileTypes: true
  });
  return entries.filter((entry) =>
    entry.isFile() &&
    !entry.isSymbolicLink() &&
    entry.name.toLowerCase().endsWith('.log'));
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
function deduplicateLogReferences(
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

/** Creates a portable archive file stem from a visible alias. */
function createPortableArchiveStem(alias: string): string {
  return alias
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 80) || 'kawaikara-logs';
}

/** Creates a readable collision-resistant external group ID. */
function createExternalGroupId(): string {
  const externalRoot = getKawaiDataPath('logs', EXTERNAL_LOG_DIRECTORY_NAME);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const compactId = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const groupId = `LOGSET-${compactId.slice(0, 4)}-${compactId.slice(4)}`;
    if (!existsSync(path.join(externalRoot, groupId))) return groupId;
  }
  throw new Error('Unable to allocate an external log group ID.');
}

/** Requires one parsed imported log to use the bounded log schema. */
function requireImportedLog(contents: string): ReturnType<typeof parseLogEntries> {
  const parsed = parseLogEntries(contents);
  if (parsed.invalidMetadata || parsed.entries.length === 0) {
    throw new LogImportError('invalid-format');
  }
  return parsed;
}

/** Requires one import batch to remain within its aggregate disk limits. */
function requireImportCapacity(
  importedCount: number,
  importedByteCount: number,
  incomingLogs: readonly string[],
): number {
  const incomingByteCount = incomingLogs.reduce(
    (total, contents) => total + Buffer.byteLength(contents, 'utf8'),
    0,
  );
  if (
    importedCount + incomingLogs.length > IMPORTED_LOG_OUTPUT_MAX_COUNT ||
    importedByteCount + incomingByteCount > IMPORTED_LOG_TOTAL_SIZE_BYTES
  ) {
    throw new LogImportError('too-large');
  }
  return incomingByteCount;
}

/** Writes one sanitized imported log into a new external group. */
async function writeImportedLog(
  directory: string,
  groupId: string,
  originalName: string,
  contents: string,
): Promise<ApplicationLogFileSummary> {
  const fileName = createAvailableImportedLogFileName(directory, originalName);
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

/** Maps archive and raw-log validation failures to a public reason. */
function resolveImportFailureReason(
  reason: unknown,
): ApplicationLogImportFailureReason {
  if (reason instanceof LogImportError) return reason.reason;
  if (reason instanceof KawaiLogArchiveError) return reason.code;
  return 'copy-failed';
}

/** Normalizes a user-assigned external group alias. */
function normalizeGroupAlias(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 120);
}

/** Removes only an inspected empty external group directory. */
async function removeEmptyExternalGroupDirectory(
  directory: string,
  externalRoot: string,
): Promise<void> {
  const resolvedDirectory = path.resolve(directory);
  const resolvedRoot = path.resolve(externalRoot);
  if (
    path.dirname(resolvedDirectory) !== resolvedRoot ||
    !/^LOGSET-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(path.basename(resolvedDirectory))
  ) {
    throw new Error('Refusing to remove an unexpected external log directory.');
  }
  const entries = await readdir(resolvedDirectory, { withFileTypes: true
  });
  if (entries.some((entry) => entry.name !== EXTERNAL_GROUP_METADATA_FILE_NAME)) {
    throw new Error('Refusing to remove a non-empty external log directory.');
  }
  const metadataPath = path.join(
    resolvedDirectory,
    EXTERNAL_GROUP_METADATA_FILE_NAME,
  );
  if (existsSync(metadataPath)) await unlink(metadataPath);
  await rmdir(resolvedDirectory);
}

/** Creates a unique session file name without merging two rapid restarts. */
function createAvailableLogFileName(date: Date): string {
  const directory = getKawaiDataPath('logs');
  const dateStem = formatLogFileDate(date);
  for (let index = 0; index < 10_000; index += 1) {
    const candidate = `${dateStem}-${String(index)}.log`;
    if (!existsSync(path.join(directory, candidate))) return candidate;
  }
  return `${dateStem}-${randomUUID()}.log`;
}

/** Formats the local date portion of a session log file name. */
function formatLogFileDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Creates the trusted metadata written before the first log entry. */
function createLogMetadata(
  sessionId: string,
  deviceId: string,
): ApplicationLogMetadata {
  return {
    /** The metadata schema version value. */
    schemaVersion: 1,
    /** The session ID value. */
    sessionId,
    /** The application name value. */
    applicationName: app.getName(),
    /** The application version value. */
    version: app.getVersion(),
    /** The release channel value. */
    channel: BUILD_CHANNEL,
    /** The operating system label value. */
    platform: getOperatingSystemLabel(),
    /** The processor architecture value. */
    arch: process.arch,
    /** The Site API version value. */
    siteApiVersion: KAWAIKARA_SITE_API_VERSION,
    /** The session creation timestamp value. */
    createdAt: new Date().toISOString(),
    /** The readable installation ID value. */
    deviceId,
    /** The runtime version values. */
    runtime: {
      /** The Electron runtime version value. */
      electron: process.versions.electron,
      /** The Chrome runtime version value. */
      chrome: process.versions.chrome,
      /** The Node.js runtime version value. */
      node: process.versions.node,
      /** The V8 runtime version value. */
      v8: process.versions.v8,
    },
    /** The registered log source values. */
    sources: Object.values(APPLICATION_LOG_SOURCES),
  };
}

/** Parses electron-log output and joins structured continuation lines. */
function parseLogEntries(value: string): {
  /** The parsed entries value. */
  readonly entries: readonly ApplicationLogEntry[];
  /** The validated metadata value. */
  readonly metadata?: ApplicationLogMetadata;
  /** Whether a present metadata header was invalid. */
  readonly invalidMetadata: boolean;
  /** Whether the result was truncated. */
  readonly truncated: boolean;
} {
  const entries: ApplicationLogEntry[] = [];
  const lines = value.split(/\r?\n/);
  const metadataHeader = parseLogMetadataHeader(lines[0] ?? '');
  const sourceDefinitions = metadataHeader.metadata?.sources ??
    Object.values(APPLICATION_LOG_SOURCES);
  const firstLogLine = metadataHeader.present ? 1 : 0;
  let firstRetainedLine = firstLogLine;
  let retentionBoundary = firstLogLine;
  let retainedEntryCount = 0;
  let truncated = false;
  for (let index = lines.length - 1; index >= firstLogLine; index -= 1) {
    if (!LOG_ENTRY_PATTERN.test(lines[index])) continue;
    retainedEntryCount += 1;
    if (retainedEntryCount === LOG_VIEWER_ENTRY_LIMIT) {
      retentionBoundary = index;
    } else if (retainedEntryCount > LOG_VIEWER_ENTRY_LIMIT) {
      firstRetainedLine = retentionBoundary;
      truncated = true;
      break;
    }
  }
  for (let index = firstRetainedLine; index < lines.length; index += 1) {
    const line = lines[index];
    const match = LOG_ENTRY_PATTERN.exec(line);
    if (match) {
      const resolvedSource = resolveLogSource(
        match[3]?.trim() || 'application',
        sourceDefinitions,
      );
      entries.push({
        id: `${String(index + 1)}:${match[1]}`,
        timestamp: match[1],
        level: normalizeLogLevel(match[2]),
        source: resolvedSource.source,
        location: resolvedSource.location,
        message: match[4].slice(0, LOG_VIEWER_MESSAGE_MAX_LENGTH),
      });
      continue;
    }
    if (!line && index === lines.length - 1) continue;
    const previous = entries.at(-1);
    if (previous) {
      const continuation = `\n${line}`;
      const availableLength = Math.max(
        0,
        LOG_VIEWER_MESSAGE_MAX_LENGTH - previous.message.length,
      );
      entries[entries.length - 1] = {
        ...previous,
        message: availableLength > 0
          ? `${previous.message}${continuation.slice(0, availableLength)}`
          : previous.message,
      };
    } else if (line) {
      entries.push({
        id: `${String(index + 1)}:unstructured`,
        level: 'unknown',
        source: 'application',
        location: 'Application',
        message: line.slice(0, LOG_VIEWER_MESSAGE_MAX_LENGTH),
      });
    }
  }
  return {
    /** The parsed entries value. */
    entries,
    /** The validated metadata value. */
    metadata: metadataHeader.metadata,
    /** Whether a present metadata header was invalid. */
    invalidMetadata: metadataHeader.present && !metadataHeader.metadata,
    /** Whether older entries were omitted. */
    truncated,
  };
}

/** Parses and validates the optional structured log metadata header. */
function parseLogMetadataHeader(value: string): {
  /** Whether a metadata marker was present. */
  readonly present: boolean;
  /** The validated metadata value. */
  readonly metadata?: ApplicationLogMetadata;
} {
  if (!value.startsWith(LOG_METADATA_PREFIX)) {
    return {
      /** Whether a metadata marker was present. */
      present: false,
    };
  }
  try {
    const parsed: unknown = JSON.parse(value.slice(LOG_METADATA_PREFIX.length));
    if (!isRecord(parsed) || parsed.schemaVersion !== 1) {
      return {
        /** Whether a metadata marker was present. */
        present: true,
      };
    }
    if (
      !isBoundedString(parsed.sessionId) ||
      !isBoundedString(parsed.applicationName) ||
      !isBoundedString(parsed.version) ||
      !isReleaseChannel(parsed.channel) ||
      !isBoundedString(parsed.platform) ||
      !isBoundedString(parsed.arch) ||
      typeof parsed.siteApiVersion !== 'number' ||
      !Number.isFinite(parsed.siteApiVersion) ||
      !isBoundedString(parsed.createdAt) ||
      (parsed.deviceId !== undefined && !isBoundedString(parsed.deviceId)) ||
      !isRecord(parsed.runtime) ||
      !isBoundedString(parsed.runtime.electron) ||
      !isBoundedString(parsed.runtime.chrome) ||
      !isBoundedString(parsed.runtime.node) ||
      !isBoundedString(parsed.runtime.v8) ||
      !Array.isArray(parsed.sources) ||
      parsed.sources.length > 100
    ) {
      return {
        /** Whether a metadata marker was present. */
        present: true,
      };
    }
    const sources = parsed.sources.filter(isLogSourceDefinition);
    if (sources.length !== parsed.sources.length) {
      return {
        /** Whether a metadata marker was present. */
        present: true,
      };
    }
    return {
      /** Whether a metadata marker was present. */
      present: true,
      /** The validated metadata value. */
      metadata: {
        /** The metadata schema version value. */
        schemaVersion: 1,
        /** The session ID value. */
        sessionId: parsed.sessionId,
        /** The application name value. */
        applicationName: parsed.applicationName,
        /** The application version value. */
        version: parsed.version,
        /** The release channel value. */
        channel: parsed.channel,
        /** The operating system label value. */
        platform: parsed.platform,
        /** The processor architecture value. */
        arch: parsed.arch,
        /** The Site API version value. */
        siteApiVersion: parsed.siteApiVersion,
        /** The session creation timestamp value. */
        createdAt: parsed.createdAt,
        /** The readable installation ID value, when recorded. */
        deviceId: parsed.deviceId,
        /** The runtime version values. */
        runtime: {
          /** The Electron runtime version value. */
          electron: parsed.runtime.electron,
          /** The Chrome runtime version value. */
          chrome: parsed.runtime.chrome,
          /** The Node.js runtime version value. */
          node: parsed.runtime.node,
          /** The V8 runtime version value. */
          v8: parsed.runtime.v8,
        },
        /** The registered log source values. */
        sources,
      },
    };
  } catch {
    return {
      /** Whether a metadata marker was present. */
      present: true,
    };
  }
}

/** Resolves a serialized scope to a registered source and call location. */
function resolveLogSource(
  scope: string,
  definitions: readonly ApplicationLogSourceDefinition[],
): {
  /** The stable source ID value. */
  readonly source: string;
  /** The visible source or call location value. */
  readonly location: string;
} {
  const definition = [...definitions]
    .sort((left, right) => right.scope.length - left.scope.length)
    .find((candidate) =>
      scope === candidate.scope ||
      scope.startsWith(`${candidate.scope}/`) ||
      scope.startsWith(`${candidate.scope}:`));
  if (!definition) {
    const fallback = normalizeVisibleLogText(scope, 160) || 'Unregistered';
    return {
      /** The stable source ID value. */
      source: fallback,
      /** The visible source or call location value. */
      location: fallback,
    };
  }
  const suffix = scope.slice(definition.scope.length).replace(/^[:/]+/, '');
  return {
    /** The stable source ID value. */
    source: definition.id,
    /** The visible source or call location value. */
    location: suffix
      ? `${definition.label}.${normalizeVisibleLogText(suffix, 120)}`
      : definition.label,
  };
}

/** Reads, decodes, and strips unsafe terminal controls from an imported log. */
async function readImportedLog(filePath: string): Promise<string> {
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new LogImportError('unsafe-file');
  }
  if (metadata.size > IMPORTED_LOG_MAX_SIZE_BYTES) {
    throw new LogImportError('too-large');
  }
  return sanitizeImportedLogBuffer(await readFile(filePath));
}

/** Decodes and sanitizes one bounded imported log buffer. */
function sanitizeImportedLogBuffer(buffer: Buffer): string {
  if (buffer.byteLength > IMPORTED_LOG_MAX_SIZE_BYTES) {
    throw new LogImportError('too-large');
  }
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true
    }).decode(buffer);
  } catch {
    throw new LogImportError('invalid-encoding');
  }
  let lineCount = 1;
  for (let index = 0; index < decoded.length; index += 1) {
    if (decoded.charCodeAt(index) !== 10) continue;
    lineCount += 1;
    if (lineCount > IMPORTED_LOG_MAX_LINE_COUNT) {
      throw new LogImportError('too-large');
    }
  }
  return decoded
    .replace(/^\uFEFF/, '')
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(UNSAFE_CONTROL_CHARACTER_PATTERN, '')
    .split(/\r?\n/)
    .map((line) => line.slice(0, IMPORTED_LOG_MAX_LINE_LENGTH))
    .join('\n');
}

/** Creates a safe, collision-free file name inside the external repository. */
function createAvailableImportedLogFileName(
  directory: string,
  originalName: string,
): string {
  const originalStem = originalName.replace(/\.log$/i, '');
  const safeStem = originalStem
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

/** Normalizes an optional source location into a bounded scope segment. */
function normalizeLogLocation(value: string | undefined): string {
  return value
    ? value.trim().replace(/[^a-zA-Z0-9._:-]+/g, '-').slice(0, 120)
    : '';
}

/** Normalizes externally supplied labels before showing them in the viewer. */
function normalizeVisibleLogText(value: string, maxLength: number): string {
  return value
    .replace(UNSAFE_CONTROL_CHARACTER_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Determines whether the value is a plain object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Determines whether the value is a safe metadata string. */
function isBoundedString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 512;
}

/** Determines whether the value is a supported release channel. */
function isReleaseChannel(value: unknown): value is ApplicationLogMetadata['channel'] {
  return value === 'stable' || value === 'staging' || value === 'nightly';
}

/** Determines whether the value is a safe log source definition. */
function isLogSourceDefinition(
  value: unknown,
): value is ApplicationLogSourceDefinition {
  return isRecord(value) &&
    isBoundedString(value.id) &&
    isBoundedString(value.scope) &&
    isBoundedString(value.label) &&
    value.id.length > 0 &&
    value.scope.length > 0 &&
    value.label.length > 0;
}

/** Represents a deliberate external log import rejection. */
class LogImportError extends Error {
  /** Creates an instance of LogImportError. */
  constructor(
    /** The rejection reason value. */
    readonly reason: ApplicationLogImportFailureReason,
  ) {
    super(reason);
  }
}

/** Normalizes a transport-provided log level. */
function normalizeLogLevel(value: string): ApplicationLogLevel {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'error' ||
    normalized === 'warn' ||
    normalized === 'info' ||
    normalized === 'verbose' ||
    normalized === 'debug' ||
    normalized === 'silly'
  ) {
    return normalized;
  }
  return 'unknown';
}
