import type {
  ApplicationLogLevel
} from '../../../Common/IPC';

/** Defines the visible log levels in severity order. */
export const LOG_LEVELS: readonly ApplicationLogLevel[] = [
  'error',
  'warn',
  'info',
  'verbose',
  'debug',
  'silly',
  'unknown',
];

/** Defines the interval used to update the open active log. */
export const ACTIVE_LOG_REFRESH_INTERVAL_MS = 1_200;

/** Defines the interval used to update log histories. */
export const LOG_HISTORY_REFRESH_INTERVAL_MS = 4_000;

/** Defines the approximate custom context menu width. */
export const LOG_CONTEXT_MENU_WIDTH = 250;

/** Defines the approximate custom context menu height. */
export const LOG_CONTEXT_MENU_HEIGHT = 142;
