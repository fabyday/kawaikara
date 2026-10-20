import { app } from 'electron';
import log from 'electron-log/main';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
    ApplicationLogMetadata,
    LogLevelPreference,
} from '../../../Common/IPC';
import { APPLICATION_LOG_SOURCES } from '../../../Common/Logging';
import {
    resolveEnvironmentLogLevel,
    resolveLogLevel,
    resolvePreferenceLogLevel,
    sanitizeLogValue,
} from './Logging';
import type { ApplicationLogSourceId } from './LogTypes';

import { LOG_MAX_SIZE_BYTES, LOG_METADATA_PREFIX } from './LogConstants';
import { normalizeLogLocation } from './LogParsing';

/** Configures electron-log once for this process and creates the exclusive session file.
 * @param logFilePath App-owned destination; an existing file is never overwritten.
 * @param logFileName Session file name used by rotation.
 * @param metadata Trusted metadata written before the first entry.
 * @param isSourceEnabled Dynamic source policy read at emission time.
 */
export function initializeLogTransport(
    logFilePath: string,
    logFileName: string,
    metadata: ApplicationLogMetadata,
    isSourceEnabled: (scope?: string) => boolean,
): void {
    mkdirSync(path.dirname(logFilePath), { recursive: true });
    writeFileSync(
        logFilePath,
        `${LOG_METADATA_PREFIX}${JSON.stringify(metadata)}\n`,
        { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );

    log.scope.labelPadding = false;
    log.transports.file.fileName = logFileName;
    log.transports.file.level = resolveLogLevel();
    log.transports.file.maxSize = LOG_MAX_SIZE_BYTES;
    log.transports.file.resolvePathFn = () => logFilePath;
    log.transports.file.inspectOptions = {
        depth: 5,
        maxArrayLength: 80,
        maxStringLength: 8_000,
    };
    log.transports.console.level = app.isPackaged ? 'info' : 'debug';
    log.hooks.push((message, _transport, transportName) => {
        if (transportName === 'file' && !isSourceEnabled(message.scope)) {
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
    log.errorHandler.startCatching({ showDialog: false });
    log.eventLogger.startLogging({
        level: 'warn',
        scope: 'electron',
    });
}

/** Returns a logger registered for an application class or call location. */
export function createScopedLogger(
    source: ApplicationLogSourceId,
    location?: string,
) {
    const definition = APPLICATION_LOG_SOURCES[source];
    const normalizedLocation = normalizeLogLocation(location);
    return log.scope(
        normalizedLocation
            ? `${definition.scope}/${normalizedLocation}`
            : definition.scope,
    );
}
/** Returns whether a scoped message is enabled for the file transport. */
export function isLogSourceEnabled(
    enabledSourceIds: ReadonlySet<string> | undefined,
    scope?: string,
): boolean {
    if (!enabledSourceIds) return true;
    const resolvedScope = scope ?? APPLICATION_LOG_SOURCES.application.scope;
    const source = Object.values(APPLICATION_LOG_SOURCES).find(
        (definition) =>
            resolvedScope === definition.scope ||
            resolvedScope.startsWith(`${definition.scope}/`),
    );
    return source ? enabledSourceIds.has(source.id) : false;
}

/** Applies the environment override before the user-configured file logging threshold. */
export function configureLogTransport(level: LogLevelPreference): void {
    log.transports.file.level =
        resolveEnvironmentLogLevel() ?? resolvePreferenceLogLevel(level);
}
