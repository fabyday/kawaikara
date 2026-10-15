import type { AppLocale, AppTheme } from './IPC';

/** Native presentation of the single retained log renderer. */
export interface LogViewerHostState {
  /** False while a retained shell is closed; suspend data polling and release document state. */
  readonly visible?: boolean;
  /** Whether its host is a separate frameless window. */
  readonly detached: boolean;
  /** Theme resolved by Main, including an unsaved preference preview. */
  readonly theme: AppTheme;
  /** Locale preference; Main resolves the actual catalog. */
  readonly locale: AppLocale;
}

/** Commands available only to the app-owned overlay and log renderer. */
export type LogViewerCommand = 'open' | 'toggle' | 'close' | 'state';
