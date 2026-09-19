import type {
  ApplicationLogImportSelection,
  LogViewerMessages
} from '../../../Common/IPC';

/** Defines a ready staged log import selection. */
export type ReadyLogImportSelection = Extract<
  ApplicationLogImportSelection,
  {
    /** The ready status value. */
    readonly status: 'ready';
  }
>;

/** Defines a timestamp display mode. */
export type LogTimestampMode = 'full' | 'compact';

/** Defines a resizable log column. */
export type ResizableLogColumn = 'time' | 'level' | 'location';

/** Describes the visible custom context menu state. */
export interface LogContextMenuState {
  /** The viewport x coordinate value. */
  readonly x: number;
  /** The viewport y coordinate value. */
  readonly y: number;
}

/** Describes the resizable column width state. */
export interface LogColumnWidths {
  /** The time column width value. */
  readonly time: number;
  /** The level column width value. */
  readonly level: number;
  /** The location column width value. */
  readonly location: number;
}

/** Describes the log viewer props contract. */
export interface LogViewerProps {
  /** The localized messages value. */
  readonly messages: LogViewerMessages;
  /** The resolved application locale value. */
  readonly locale: string;
  /** Callback used to close the viewer. */
  readonly onClose: () => void;
}
