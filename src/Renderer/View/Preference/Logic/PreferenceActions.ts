import { PreferenceActionPolicy } from '../Types';

/** Defines the shared preference action policies constant. */
export const PREFERENCE_ACTION_POLICIES = {
  /** The application link value. */
  applicationLink: {
    /** The save value. */
    save: 'none',
    /** The completion value. */
    completion: 'keep-open',
  },
  /** The check for updates value. */
  checkForUpdates: {
    /** The save value. */
    save: 'none',
    /** The completion value. */
    completion: 'keep-open',
  },
  /** The open log directory value. */
  openLogDirectory: {
    /** The save value. */
    save: 'none',
    /** The completion value. */
    completion: 'keep-open',
  },
  /** The open dev tools value. */
  openDevTools: {
    /** The save value. */
    save: 'before',
    /** The completion value. */
    completion: 'keep-open',
  },
} as const satisfies Record<string, PreferenceActionPolicy>;
