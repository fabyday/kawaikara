import {
  useCallback,
  useEffect,
  useRef
} from 'react';
import type { ApplicationLogEntry } from '../../../../Common/IPC';
import { formatLogTimestamp } from '../LogFormatting';
import { LogViewerProps } from '../Types';
import { type useLogViewerState } from './useLogViewerState';

/** Inputs used by useLogViewerKeyboard. */
type LogViewerKeyboardOptions = Pick<ReturnType<typeof useLogViewerState>,
  | 'contextMenu'
  | 'setContextMenu'
  | 'deleteReferences'
  | 'deleting'
  | 'setDeleteReferences'
  | 'importSelection'
  | 'fileListRef'
  | 'setSelectedFileNames'
  | 'files'
  | 'logEntriesRef'
  | 'timestampMode'
> & Pick<LogViewerProps,
  | 'onClose'
> & {
  /** All filtered rows, including those not mounted by the virtualizer. */
  readonly visibleEntries: readonly ApplicationLogEntry[];
};

/** Coordinates log viewer keyboard behavior for this View. */
export function useLogViewerKeyboard({
  contextMenu,
  setContextMenu,
  deleteReferences,
  deleting,
  setDeleteReferences,
  importSelection,
  onClose,
  fileListRef,
  setSelectedFileNames,
  files,
  logEntriesRef,
  visibleEntries,
  timestampMode,
}: LogViewerKeyboardOptions) {
  const allLogsSelected = useRef(false);
  useEffect(() => {
    allLogsSelected.current = false;
    if (logEntriesRef.current) delete logEntriesRef.current.dataset.allSelected;
  }, [visibleEntries, timestampMode]);
  /** Closes the topmost transient layer before leaving the viewer. */
  const requestClose = useCallback(() => {
    if (contextMenu) {
      setContextMenu(undefined);
      return;
    }
    if (deleteReferences) {
      if (!deleting) setDeleteReferences(undefined);
      return;
    }
    if (importSelection) return;
    onClose();
  }, [contextMenu, deleteReferences, deleting, importSelection, onClose]);

  useEffect(() => window.kawaikara.logViewer?.onRequestClose(requestClose), [requestClose]);

  useEffect(() => {
    /** Return to native text selection after pointer interaction. */
    const clearLogSelection = () => {
      allLogsSelected.current = false;
      if (logEntriesRef.current) delete logEntriesRef.current.dataset.allSelected;
    };
    /** Copy the full filtered result for Select All, including unmounted rows. */
    const copyLogs = (event: ClipboardEvent) => {
      if (!allLogsSelected.current || !event.clipboardData) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable)) return;
      event.clipboardData.setData('text/plain', visibleEntries.map((entry) => [
        formatLogTimestamp(entry.timestamp, timestampMode), entry.level.toUpperCase(),
        entry.location, entry.message,
      ].join('\t')).join('\n'));
      event.preventDefault();
    };
    /** Handles viewer-level keyboard commands. */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!((event.ctrlKey || event.metaKey) && ['a', 'c'].includes(event.key.toLowerCase())) &&
          !['Control', 'Meta', 'Shift'].includes(event.key)) clearLogSelection();
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        requestClose();
        return;
      }
      if (
        event.key.toLocaleLowerCase('en-US') !== 'a' ||
        (!event.ctrlKey && !event.metaKey)
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      if (target instanceof Node && fileListRef.current?.contains(target)) {
        clearLogSelection();
        setSelectedFileNames(new Set(files.map((file) => file.fileName)));
        return;
      }
      const entries = logEntriesRef.current;
      if (!entries) return;
      allLogsSelected.current = true;
      entries.dataset.allSelected = 'true';
      const range = window.document.createRange();
      range.selectNodeContents(entries);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('copy', copyLogs);
    window.addEventListener('pointerdown', clearLogSelection, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('copy', copyLogs);
      window.removeEventListener('pointerdown', clearLogSelection, true);
    };
  }, [files, requestClose, visibleEntries, timestampMode]);

  return {
    /** The requestClose value. */
    requestClose,
  };
}
