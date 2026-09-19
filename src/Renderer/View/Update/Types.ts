import type {
  ApplicationUpdatePanelState,
  AppLocale,
  UpdateMessages,
} from '../../../Common/IPC';

/** Describes the update panel props contract. */
export interface UpdatePanelProps {
  /** The state value. */
  readonly state: ApplicationUpdatePanelState;
  /** Copy resolved by Main, never a renderer-side language table. */
  readonly labels: UpdateMessages;
  /** The locale value. */
  readonly locale?: AppLocale | string;
  /** Callback used to handle on dismiss. */
  readonly onDismiss: () => void;
  /** Callback used to handle on download. */
  readonly onDownload: () => void | Promise<void>;
  /** Callback used to handle on install. */
  readonly onInstall: () => void | Promise<void>;
  /** Callback used to handle on retry. */
  readonly onRetry: () => void | Promise<void>;
  /** The initial view value. */
  readonly initialView?: 'status' | 'release-notes';
  /** The view value. */
  readonly view?: 'status' | 'release-notes';
  /** Callback used to handle on view change. */
  readonly onViewChange?: (view: 'status' | 'release-notes') => void;
}

/** Local alias for the Main-resolved update copy contract. */
export type UpdatePanelLabels = UpdateMessages;
