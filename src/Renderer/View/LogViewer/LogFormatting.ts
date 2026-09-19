import type {
  ApplicationLogFileReference,
  ApplicationLogFileSummary
} from '../../../Common/IPC';
import { LogTimestampMode } from './Types';

/** Converts a file summary to the bounded Main-process reference shape. */
export function toLogFileReference(
  file: ApplicationLogFileSummary,
): ApplicationLogFileReference {
  return {
    /** The repository value. */
    repository: file.repository,
    /** The file name value. */
    fileName: file.fileName,
    /** The owning external group ID value. */
    groupId: file.groupId,
  };
}

/** Formats an IPC or renderer error for the visible status region. */
export function formatError(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** Formats a full or compact log timestamp without timezone conversion. */
export function formatLogTimestamp(
  value: string | undefined,
  mode: LogTimestampMode,
): string {
  if (!value) return '—';
  if (mode === 'full') return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?/.exec(value);
  return match ? `${match[2]}-${match[3]} ${match[4]}` : value;
}

/** Formats a log modification time in the active locale. */
export function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/** Formats a compact byte count. */
export function formatBytes(value: number, locale: string): string {
  if (value < 1_024) return `${value.toLocaleString(locale)} B`;
  if (value < 1_048_576) {
    return `${(value / 1_024).toLocaleString(locale, {
      maximumFractionDigits: 1,
    })} KB`;
  }
  return `${(value / 1_048_576).toLocaleString(locale, {
    maximumFractionDigits: 1,
  })} MB`;
}
