import type { ApplicationUpdateProgress } from '../../Common/IPC';

/** Describes the application update signal contract. */
export interface ApplicationUpdateSignal {
  /** Whether the available option is enabled. */
  readonly available: boolean;
  /** The version value. */
  readonly version: string;
  /** The release notes value. */
  readonly releaseNotes?: string;
}

/** Normalizes the release notes. */
export function normalizeReleaseNotes(value: unknown): string | undefined {
  if (typeof value === 'string') return stripReleaseNoteMarkup(value);
  if (!Array.isArray(value)) return undefined;
  const notes = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as { version?: unknown; note?: unknown
    };
    if (typeof candidate.note !== 'string') return [];
    const prefix = typeof candidate.version === 'string'
      ? `${candidate.version}\n`
      : '';
    return [`${prefix}${stripReleaseNoteMarkup(candidate.note)}`];
  });
  return notes.length > 0 ? notes.join('\n\n') : undefined;
}

/** Normalizes the update progress. */
export function normalizeUpdateProgress(
  progress: ApplicationUpdateProgress,
): ApplicationUpdateProgress {
  return {
    /** The percent value. */
    percent: Math.max(0, Math.min(100, progress.percent)),
    /** The bytes per second value. */
    bytesPerSecond: Math.max(0, progress.bytesPerSecond),
    /** The transferred value. */
    transferred: Math.max(0, progress.transferred),
    /** The total value. */
    total: Math.max(0, progress.total),
  };
}

/** Performs the strip release note markup operation. */
function stripReleaseNoteMarkup(value: string): string {
  return value
    // Public GitHub release feeds contain HTML, not the original Markdown.
    // Retain language headings before removing tags so renderer selection works.
    .replace(/<h([1-6])\b[^>]*>/gi, (_tag, level: string) =>
      `\n\n${'#'.repeat(Number(level))} `)
    .replace(/<\/h[1-6]\s*>/gi, '\n\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(?:li|ul|ol|div)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,
      (_entity, code: string) => decodeReleaseNoteEntity(code))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Decodes common feed entities as inert text, never as executable markup. */
function decodeReleaseNoteEntity(code: string): string {
  if (code.startsWith('#')) {
    const point = code.toLowerCase().startsWith('#x')
      ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\uFFFD';
  }
  return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[
    code.toLowerCase() as 'amp' | 'quot' | 'apos' | 'lt' | 'gt' | 'nbsp'
  ];
}
