import type {
    ApplicationLogEntry,
    ApplicationLogImportFailureReason,
    ApplicationLogLevel,
    ApplicationLogMetadata,
    ApplicationLogSourceDefinition,
} from '../../../Common/IPC';
import { APPLICATION_LOG_SOURCES } from '../../../Common/Logging';
import { KawaiLogArchiveError } from './LogArchive';

import {
    ANSI_ESCAPE_PATTERN,
    IMPORTED_LOG_MAX_LINE_COUNT,
    IMPORTED_LOG_MAX_LINE_LENGTH,
    IMPORTED_LOG_MAX_SIZE_BYTES,
    IMPORTED_LOG_OUTPUT_MAX_COUNT,
    IMPORTED_LOG_TOTAL_SIZE_BYTES,
    LOG_ENTRY_PATTERN,
    LOG_METADATA_PREFIX,
    LOG_VIEWER_ENTRY_LIMIT,
    LOG_VIEWER_MESSAGE_MAX_LENGTH,
    UNSAFE_CONTROL_CHARACTER_PATTERN,
} from './LogConstants';

/** Parses electron-log output and joins structured continuation lines. */
export function parseLogEntries(value: string): {
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
    const sourceDefinitions =
        metadataHeader.metadata?.sources ??
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
                message:
                    availableLength > 0
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
        const parsed: unknown = JSON.parse(
            value.slice(LOG_METADATA_PREFIX.length),
        );
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
            (parsed.deviceId !== undefined &&
                !isBoundedString(parsed.deviceId)) ||
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
        .find(
            (candidate) =>
                scope === candidate.scope ||
                scope.startsWith(`${candidate.scope}/`) ||
                scope.startsWith(`${candidate.scope}:`),
        );
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

/** Decodes and sanitizes one bounded imported log buffer. */
export function sanitizeImportedLogBuffer(buffer: Buffer): string {
    if (buffer.byteLength > IMPORTED_LOG_MAX_SIZE_BYTES) {
        throw new LogImportError('too-large');
    }
    let decoded: string;
    try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
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

/** Normalizes an optional source location into a bounded scope segment. */
export function normalizeLogLocation(value: string | undefined): string {
    return value
        ? value
              .trim()
              .replace(/[^a-zA-Z0-9._:-]+/g, '-')
              .slice(0, 120)
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
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Determines whether the value is a safe metadata string. */
function isBoundedString(value: unknown): value is string {
    return typeof value === 'string' && value.length <= 512;
}

/** Determines whether the value is a supported release channel. */
function isReleaseChannel(
    value: unknown,
): value is ApplicationLogMetadata['channel'] {
    return value === 'stable' || value === 'staging' || value === 'nightly';
}

/** Determines whether the value is a safe log source definition. */
function isLogSourceDefinition(
    value: unknown,
): value is ApplicationLogSourceDefinition {
    return (
        isRecord(value) &&
        isBoundedString(value.id) &&
        isBoundedString(value.scope) &&
        isBoundedString(value.label) &&
        value.id.length > 0 &&
        value.scope.length > 0 &&
        value.label.length > 0
    );
}

/** Represents a deliberate external log import rejection. */
export class LogImportError extends Error {
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

/** Requires one parsed imported log to use the bounded log schema. */
export function requireImportedLog(
    contents: string,
): ReturnType<typeof parseLogEntries> {
    const parsed = parseLogEntries(contents);
    if (parsed.invalidMetadata || parsed.entries.length === 0) {
        throw new LogImportError('invalid-format');
    }
    return parsed;
}

/** Requires one import batch to remain within its aggregate disk limits. */
export function requireImportCapacity(
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

/** Maps archive and raw-log validation failures to a public reason. */
export function resolveImportFailureReason(
    reason: unknown,
): ApplicationLogImportFailureReason {
    if (reason instanceof LogImportError) return reason.reason;
    if (reason instanceof KawaiLogArchiveError) return reason.code;
    return 'copy-failed';
}

/** Normalizes a user-assigned external group alias. */
export function normalizeGroupAlias(value: string): string {
    return value
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, 120);
}

/** Creates a portable archive file stem from a visible alias. */
export function createPortableArchiveStem(alias: string): string {
    return (
        alias
            .normalize('NFKC')
            .replace(/[^\p{L}\p{N}._-]+/gu, '-')
            .replace(/^[.-]+|[.-]+$/g, '')
            .slice(0, 80) || 'kawaikara-logs'
    );
}
