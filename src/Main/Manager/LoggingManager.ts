import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { app, shell, type WebContents } from 'electron';
import log from 'electron-log/main';
import { BUILD_CHANNEL } from '../../Common/BuildConfig';
import type { LogLevelPreference } from '../../Common/IPC';
import {
  formatConsoleSource,
  resolveEnvironmentLogLevel,
  resolveLogLevel,
  sanitizeLogValue,
} from '../Functional/Logging';
import { getKawaiDataPath } from '../Functional/UserDataPaths';

/** Defines the shared log file name constant. */
const LOG_FILE_NAME = 'kawaikara.log';
/** Defines the shared log max size bytes constant. */
const LOG_MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Coordinates logging behavior. */
export class LoggingManager {
  /** The initialized value. */
  private initialized = false;
  /** The session ID value. */
  private readonly sessionId = randomUUID();

  /** Initializes the operation. */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    log.scope.labelPadding = false;
    log.transports.file.fileName = LOG_FILE_NAME;
    log.transports.file.level = resolveLogLevel();
    log.transports.file.maxSize = LOG_MAX_SIZE_BYTES;
    log.transports.file.resolvePathFn = () => this.getLogFilePath();
    log.transports.file.inspectOptions = {
      depth: 5,
      maxArrayLength: 80,
      maxStringLength: 8_000,
    };
    log.transports.console.level = app.isPackaged ? 'info' : 'debug';
    log.hooks.push((message) => ({
      ...message,
      data: message.data.map((value) => sanitizeLogValue(value)),
    }));

    // Route existing manager and plugin console calls through the same file
    // transport without exposing a logging IPC bridge to remote site pages.
    Object.assign(console, log.functions);
    log.errorHandler.startCatching({ showDialog: false
    });
    log.eventLogger.startLogging({
      level: 'warn',
      scope: 'electron',
    });

    this.createLogger('application').info('Log session started.', {
      sessionId: this.sessionId,
      version: app.getVersion(),
      channel: BUILD_CHANNEL,
      packaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
    });
  }

  /** Creates the logger. */
  createLogger(scope: string) {
    return log.scope(scope.trim() || 'application');
  }

  /** Returns the updater logger. */
  get updaterLogger() {
    return log;
  }

  /** Performs the configure level operation. */
  configureLevel(level: LogLevelPreference): void {
    const environmentLevel = resolveEnvironmentLogLevel();
    log.transports.file.level =
      environmentLevel ?? (level === 'none' ? false : level);
  }

  /** Returns the log file path. */
  getLogFilePath(): string {
    return getKawaiDataPath('logs', LOG_FILE_NAME);
  }

  /** Opens the directory. */
  async openDirectory(): Promise<void> {
    const directory = path.dirname(this.getLogFilePath());
    mkdirSync(directory, { recursive: true
    });
    const error = await shell.openPath(directory);
    if (error) throw new Error(error);
  }

  /** Attaches the renderer. */
  attachRenderer(
    webContents: WebContents,
    scope: string,
    includeMessage: (message: string) => boolean = () => true,
  ): () => void {
    const rendererLog = this.createLogger(`renderer:${scope}`);
    /** Handles the console message. */
    const handleConsoleMessage = (
      details: Electron.Event<Electron.WebContentsConsoleMessageEventParams>,
    ) => {
      if (!includeMessage(details.message)) return;
      const source = formatConsoleSource(details.sourceId, details.lineNumber);
      const args = source ? [details.message, source] : [details.message];
      switch (details.level) {
        case 'error':
          rendererLog.error(...args);
          break;
        case 'warning':
          rendererLog.warn(...args);
          break;
        case 'debug':
          rendererLog.debug(...args);
          break;
        default:
          rendererLog.info(...args);
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
    this.createLogger('application').info('Log session finished.', {
      sessionId: this.sessionId,
    });
  }
}
