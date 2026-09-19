import {
  useCallback,
  useEffect
} from 'react';
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
> & Pick<LogViewerProps,
  | 'onClose'
>;

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
}: LogViewerKeyboardOptions) {
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

  useEffect(() => {
    /** Handles viewer-level keyboard commands. */
    const handleKeyDown = (event: KeyboardEvent) => {
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
        setSelectedFileNames(new Set(files.map((file) => file.fileName)));
        return;
      }
      const entries = logEntriesRef.current;
      if (!entries) return;
      const range = window.document.createRange();
      range.selectNodeContents(entries);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [files, requestClose]);

  return {
    /** The requestClose value. */
    requestClose,
  };
}
