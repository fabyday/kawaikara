import { app } from 'electron';

/** Defines the shared log levels constant. */
const LOG_LEVELS = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'] as const;
/** Defines the log level type. */
type LogLevel = (typeof LOG_LEVELS)[number];
/** Defines the shared sensitive key constant. */
const SENSITIVE_KEY =
  /^(?:authorization|cookie|set-cookie|password|passwd|secret|api[-_]?key|token|access[-_]?token|refresh[-_]?token|id[-_]?token|session[-_]?token|credential)$/i;

/** Formats the console source. */
export function formatConsoleSource(sourceId: string, lineNumber: number): string {
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

/** Performs the sanitize log value operation. */
export function sanitizeLogValue(
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
      /** The name value. */
      name: value.name,
      /** The message value. */
      message: sanitizeString(value.message),
      /** The stack value. */
      stack: value.stack ? sanitizeString(value.stack) : undefined,
      /** The cause value. */
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

/** Resolves the log level. */
export function resolveLogLevel(): LogLevel {
  const configured = resolveEnvironmentLogLevel();
  return configured
    ? configured
    : app.isPackaged
      ? 'info'
      : 'debug';
}

/** Resolves the environment log level. */
export function resolveEnvironmentLogLevel(): LogLevel | undefined {
  const configured = process.env.KAWAIKARA_LOG_LEVEL?.toLowerCase();
  return LOG_LEVELS.includes(configured as LogLevel)
    ? configured as LogLevel
    : undefined;
}

/** Performs the sanitize string operation. */
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

/** Performs the sanitize URL text operation. */
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
