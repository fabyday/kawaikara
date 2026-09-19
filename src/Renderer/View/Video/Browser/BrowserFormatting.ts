

/** Formats the file size. */
export function formatFileSize(value: number | undefined): string {
  if (!Number.isFinite(value) || !value) return 'Video';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

/** Returns the error message. */
export function getErrorMessage(reason: unknown, fallback: string): string {
  const message = reason instanceof Error ? reason.message.trim() : String(reason ?? '').trim();
  return message || fallback;
}
