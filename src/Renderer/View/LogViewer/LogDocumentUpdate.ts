import type { ApplicationLogDocument, ApplicationLogEntry } from '../../../Common/IPC';

/** Preserves unchanged row identities so polling does not repaint the entire table. */
export function mergeLogDocument(previous: ApplicationLogDocument | undefined, next: ApplicationLogDocument): ApplicationLogDocument {
  if (!previous || previous.file.fileName !== next.file.fileName ||
    previous.file.repository !== next.file.repository || previous.file.groupId !== next.file.groupId) return next;
  const prior = new Map(previous.entries.map((entry) => [entry.id, entry]));
  const entries = next.entries.map((entry) => {
    const retained = prior.get(entry.id);
    return retained && sameLogEntry(retained, entry) ? retained : entry;
  });
  const sameEntries = entries.length === previous.entries.length && entries.every((entry, i) => entry === previous.entries[i]);
  if (sameEntries && previous.truncated === next.truncated &&
    JSON.stringify(previous.metadata) === JSON.stringify(next.metadata) &&
    JSON.stringify(previous.file) === JSON.stringify(next.file)) return previous;
  return { ...next,
    /** Reuses both the array and unchanged entries where possible. */
    entries: sameEntries ? previous.entries : entries,
  };
}

/** Compares visible fields, including a multiline entry that is still being appended. */
function sameLogEntry(left: ApplicationLogEntry, right: ApplicationLogEntry): boolean {
  return left.timestamp === right.timestamp && left.level === right.level &&
    left.source === right.source && left.location === right.location && left.message === right.message;
}
