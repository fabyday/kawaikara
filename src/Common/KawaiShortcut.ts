/** Defines the default Kawai Shortcut selection window in seconds. */
export const DEFAULT_KAWAI_SHORTCUT_DELAY_SECONDS = 1;

/** Defines the minimum Kawai Shortcut selection window in seconds. */
export const MIN_KAWAI_SHORTCUT_DELAY_SECONDS = 0.1;

/** Defines the maximum Kawai Shortcut selection window in seconds. */
export const MAX_KAWAI_SHORTCUT_DELAY_SECONDS = 5;

/** Defines the number of sites addressable by one numeric key (1-9, then 0). */
export const MAX_KAWAI_SHORTCUT_SITES = 10;

/** Returns the one-key label assigned to a zero-based site position. */
export function getKawaiShortcutKey(index: number): string | undefined {
  if (index >= 0 && index < 9) return String(index + 1);
  if (index === 9) return '0';
  return undefined;
}

/** Returns the zero-based site position assigned to a numeric key. */
export function getKawaiShortcutIndex(key: string): number | undefined {
  if (/^[1-9]$/.test(key)) return Number(key) - 1;
  if (key === '0') return 9;
  return undefined;
}

/** Validates the Kawai Shortcut selection window. */
export function validateKawaiShortcutDelaySeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_KAWAI_SHORTCUT_DELAY_SECONDS;
  }
  return Math.min(
    MAX_KAWAI_SHORTCUT_DELAY_SECONDS,
    Math.max(MIN_KAWAI_SHORTCUT_DELAY_SECONDS, Math.round(value * 10) / 10),
  );
}
