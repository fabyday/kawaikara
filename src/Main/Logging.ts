import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { app, shell, type WebContents } from 'electron';
import log from 'electron-log/main';
import { BUILD_CHANNEL } from '../Common/BuildConfig';
import type { LogLevelPreference } from '../Common/IPC';
import { getKawaiDataPath } from './UserDataPaths';

const LOG_FILE_NAME = 'kawaikara.log';
const LOG_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const LOG_LEVELS = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];
const SESSION_ID = randomUUID();
const SENSITIVE_KEY =
  /^(?:authorization|cookie|set-cookie|password|passwd|secret|api[-_]?key|token|access[-_]?token|refresh[-_]?token|id[-_]?token|session[-_]?token|credential)$/i;

let initialized = false;

export function initializeLogging(): void {
  if (initialized) return;
  initialized = true;

  log.scope.labelPadding = false;
  log.transports.file.fileName = LOG_FILE_NAME;
  log.transports.file.level = resolveLogLevel();
  log.transports.file.maxSize = LOG_MAX_SIZE_BYTES;
  log.transports.file.resolvePathFn = () => getLogFilePath();
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
  log.errorHandler.startCatching({ showDialog: false });
  log.eventLogger.startLogging({
    level: 'warn',
    scope: 'electron',
  });

  createLogger('application').info('Log session started.', {
    sessionId: SESSION_ID,
    version: app.getVersion(),
    channel: BUILD_CHANNEL,
    packaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  });
}

export function createLogger(scope: string) {
  return log.scope(scope.trim() || 'application');
}

export function configureLogLevel(level: LogLevelPreference): void {
  const environmentLevel = resolveEnvironmentLogLevel();
  log.transports.file.level = environmentLevel ?? (level === 'none' ? false : level);
}

export function getLogFilePath(): string {
  return getKawaiDataPath('logs', LOG_FILE_NAME);
}

export async function openLogDirectory(): Promise<void> {
  const directory = path.dirname(getLogFilePath());
  mkdirSync(directory, { recursive: true });
  const error = await shell.openPath(directory);
  if (error) throw new Error(error);
}

export function attachRendererLogging(
  webContents: WebContents,
  scope: string,
  includeMessage: (message: string) => boolean = () => true,
): () => void {
  const rendererLog = createLogger(`renderer:${scope}`);
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
  const handleUnresponsive = () => rendererLog.warn('Renderer became unresponsive.');
  const handleResponsive = () => rendererLog.info('Renderer became responsive again.');
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

export function finishLogSession(): void {
  if (!initialized) return;
  createLogger('application').info('Log session finished.', {
    sessionId: SESSION_ID,
  });
}

function formatConsoleSource(sourceId: string, lineNumber: number): string {
  if (!sourceId) return '';
  try {
    const url = new URL(sourceId);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return `${url.href}:${String(lineNumber)}`;
  } catch {
    return `${sanitizeString(sourceId)}:${String(lineNumber)}`;
  }
}

function sanitizeLogValue(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): unknown {
  if (typeof value === 'string') return sanitizeString(value);
  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
      cause: depth < 4
        ? sanitizeLogValue(value.cause, seen, depth + 1)
        : undefined,
    };
  }
  if (value instanceof URL) return sanitizeString(value.href);
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  if (depth >= 5) return '[Truncated]';

  seen.add(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, 80)
      .map((entry) => sanitizeLogValue(entry, seen, depth + 1));
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_KEY.test(key)
        ? '[REDACTED]'
        : sanitizeLogValue(entry, seen, depth + 1),
    ]),
  );
}

function sanitizeString(value: string): string {
  return value
    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, sanitizeUrlText)
    .replace(
      /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi,
      '$1 [REDACTED]',
    )
    .replace(
      /([?&](?:access_token|refresh_token|id_token|token|code|password|secret|api_key)=)[^&#\s]+/gi,
      '$1[REDACTED]',
    )
    .replace(
      /(["']?(?:authorization|cookie|set-cookie|password|secret|api[-_]?key|token|access[-_]?token|refresh[-_]?token)["']?\s*[:=]\s*)[^,;\s}\]]+/gi,
      '$1[REDACTED]',
    )
    .replace(/(https?:\/\/)[^/@\s]+@/gi, '$1[REDACTED]@');
}

function sanitizeUrlText(value: string): string {
  try {
    const url = new URL(value);
    const hadSearch = Boolean(url.search);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return `${url.href}${hadSearch ? '?[REDACTED]' : ''}`;
  } catch {
    return value;
  }
}

function resolveLogLevel(): LogLevel {
  const configured = resolveEnvironmentLogLevel();
  return configured
    ? configured
    : app.isPackaged
      ? 'info'
      : 'debug';
}

function resolveEnvironmentLogLevel(): LogLevel | undefined {
  const configured = process.env.KAWAIKARA_LOG_LEVEL?.toLowerCase();
  return LOG_LEVELS.includes(configured as LogLevel)
    ? configured as LogLevel
    : undefined;
}
