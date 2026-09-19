import type {
  AppMessages,
  AppTheme,
  LogViewerMessages,
  PreferenceState,
  SiteMenuItem
} from '../../../Common/IPC';

/** Describes the preference view props contract. */
export interface PreferenceViewProps {
  /** The initial resolved locale value. */
  readonly initialLocale: string;
  /** The initial messages value. */
  readonly initialMessages: AppMessages;
  /** The initial log viewer messages value. */
  readonly initialLogViewerMessages: LogViewerMessages;
  /** The sites value. */
  readonly sites: readonly SiteMenuItem[];
  /** Callback used to handle on back. */
  readonly onBack: () => void;
  /** Callback used to handle on back handler change. */
  readonly onBackHandlerChange?: (handler: (() => void) | undefined) => void;
  /** Callback used to handle on messages change. */
  readonly onMessagesChange?: (messages: AppMessages) => void;
  /** Callback used to handle on preferences change. */
  readonly onPreferencesChange?: (preferences: PreferenceState) => void;
  /** Callback used to handle on theme preview. */
  readonly onThemePreview?: (theme: AppTheme) => void;
}

/** Describes the shortcut item contract. */
export interface ShortcutItem {
  /** The ID value. */
  readonly id: string;
  /** The title value. */
  readonly title: string;
  /** The description value. */
  readonly description?: string;
  /** The default key value. */
  readonly defaultKey: string;
}

/** Describes the shortcut conflict contract. */
export interface ShortcutConflict {
  /** The target ID value. */
  readonly targetId: string;
  /** The conflicting IDs value. */
  readonly conflictingIds: readonly string[];
  /** The previous shortcuts value. */
  readonly previousShortcuts: Readonly<Record<string, string>>;
}

/** Defines the preference action save policy type. */
export type PreferenceActionSavePolicy = 'none' | 'before';

/** Defines the preference action completion type. */
export type PreferenceActionCompletion = 'keep-open' | 'close-preferences';

/** Describes the preference action policy contract. */
export interface PreferenceActionPolicy {
  /** The save value. */
  readonly save: PreferenceActionSavePolicy;
  /** The completion value. */
  readonly completion: PreferenceActionCompletion;
}
