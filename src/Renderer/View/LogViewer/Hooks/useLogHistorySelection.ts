import type {
  ApplicationLogFileSummary,
  ApplicationLogRepository
} from '../../../../Common/IPC';
import { LOG_CONTEXT_MENU_HEIGHT, LOG_CONTEXT_MENU_WIDTH } from '../LogViewerDefaults';
import { type useLogViewerState } from './useLogViewerState';

/** Inputs used by useLogHistorySelection. */
type LogHistorySelectionOptions = Pick<ReturnType<typeof useLogViewerState>,
  | 'repository'
  | 'listSequenceRef'
  | 'readSequenceRef'
  | 'setRepository'
  | 'setSelectedGroupId'
  | 'setFiles'
  | 'setActiveFile'
  | 'setSelectedFileNames'
  | 'setDocument'
  | 'setContextMenu'
  | 'setError'
  | 'selectionAnchorRef'
  | 'files'
  | 'selectedFileNames'
>;

/** Coordinates log history selection behavior for this View. */
export function useLogHistorySelection({
  repository,
  listSequenceRef,
  readSequenceRef,
  setRepository,
  setSelectedGroupId,
  setFiles,
  setActiveFile,
  setSelectedFileNames,
  setDocument,
  setContextMenu,
  setError,
  selectionAnchorRef,
  files,
  selectedFileNames,
}: LogHistorySelectionOptions) {
  /** Switches repositories while invalidating all stale file reads. */
  const changeRepository = (next: ApplicationLogRepository) => {
    if (next === repository) return;
    listSequenceRef.current += 1;
    readSequenceRef.current += 1;
    setRepository(next);
    setSelectedGroupId(undefined);
    setFiles([]);
    setActiveFile(undefined);
    setSelectedFileNames(new Set());
    setDocument(undefined);
    setContextMenu(undefined);
    setError(undefined);
  };

  /** Selects one log with platform-standard Ctrl/Command and Shift behavior. */
  const selectFile = (
    file: ApplicationLogFileSummary,
    index: number,
    additive: boolean,
    range: boolean,
  ) => {
    if (range && selectionAnchorRef.current !== undefined) {
      const start = Math.min(selectionAnchorRef.current, index);
      const end = Math.max(selectionAnchorRef.current, index);
      const rangeNames = files.slice(start, end + 1).map((entry) => entry.fileName);
      setSelectedFileNames((current) => new Set([
        ...(additive ? current : []),
        ...rangeNames,
      ]));
    } else if (additive) {
      setSelectedFileNames((current) => {
        const next = new Set(current);
        if (next.has(file.fileName)) next.delete(file.fileName);
        else next.add(file.fileName);
        return next;
      });
      selectionAnchorRef.current = index;
    } else {
      setSelectedFileNames(new Set([file.fileName]));
      selectionAnchorRef.current = index;
    }
    setActiveFile(file);
  };

  /** Opens the history context menu while preserving an existing selection. */
  const openFileContextMenu = (
    event: React.MouseEvent,
    file: ApplicationLogFileSummary,
    index: number,
  ) => {
    event.preventDefault();
    if (!selectedFileNames.has(file.fileName)) {
      setSelectedFileNames(new Set([file.fileName]));
      setActiveFile(file);
      selectionAnchorRef.current = index;
    }
    setContextMenu({
      x: Math.max(8, Math.min(
        event.clientX,
        window.innerWidth - LOG_CONTEXT_MENU_WIDTH - 8,
      )),
      y: Math.max(8, Math.min(
        event.clientY,
        window.innerHeight - LOG_CONTEXT_MENU_HEIGHT - 8,
      )),
    });
  };

  return {
    /** The changeRepository value. */
    changeRepository,
    /** The selectFile value. */
    selectFile,
    /** The openFileContextMenu value. */
    openFileContextMenu,
  };
}
