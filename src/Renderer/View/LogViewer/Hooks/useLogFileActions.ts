import { formatError } from '../LogFormatting';
import { LogViewerProps } from '../Types';
import { type useLogFilters } from './useLogFilters';
import { type useLogRepository } from './useLogRepository';
import { type useLogViewerState } from './useLogViewerState';

/** Inputs used by useLogFileActions. */
type LogFileActionsOptions = Pick<ReturnType<typeof useLogViewerState>,
  | 'setError'
  | 'importSelectionRef'
  | 'setImportSelection'
  | 'importSelection'
  | 'setImporting'
  | 'setNotice'
  | 'setRepository'
  | 'setSelectedGroupId'
  | 'deleteReferences'
  | 'setDeleting'
  | 'setDeleteReferences'
> & Pick<LogViewerProps,
  | 'messages'
> & Pick<ReturnType<typeof useLogRepository>,
  | 'refreshGroups'
  | 'refreshFiles'
> & Pick<ReturnType<typeof useLogFilters>,
  | 'selectedReferences'
>;

/** Coordinates log file actions behavior for this View. */
export function useLogFileActions({
  setError,
  importSelectionRef,
  setImportSelection,
  importSelection,
  setImporting,
  setNotice,
  messages,
  setRepository,
  setSelectedGroupId,
  refreshGroups,
  selectedReferences,
  deleteReferences,
  setDeleting,
  setDeleteReferences,
  refreshFiles,
}: LogFileActionsOptions) {
  /** Opens the native picker before showing the in-app naming dialog. */
  const beginImport = async () => {
    setError(undefined);
    try {
      const selection = await window.kawaikara.application.selectLogImportFiles();
      if (selection.status === 'ready') {
        importSelectionRef.current = selection;
        setImportSelection(selection);
      }
    } catch (reason) {
      setError(formatError(reason));
    }
  };

  /** Completes the staged import into its own external group. */
  const completeImport = async (alias: string) => {
    if (!importSelection) return;
    const selection = importSelection;
    setImporting(true);
    try {
      const result = await window.kawaikara.application.importLogFiles(
        selection.token,
        alias,
      );
      if (result.status === 'cancelled') {
        importSelectionRef.current = undefined;
        setImportSelection(undefined);
        return;
      }
      importSelectionRef.current = undefined;
      setImportSelection(undefined);
      setNotice(messages.importResult
        .replace('{imported}', String(result.imported.length))
        .replace('{rejected}', String(result.rejected.length)));
      if (result.group) {
        setRepository('external');
        setSelectedGroupId(result.group.id);
        await refreshGroups();
      }
    } catch (reason) {
      setError(formatError(reason));
    } finally {
      setImporting(false);
    }
  };

  /** Cancels a staged import after explicit confirmation. */
  const cancelImport = async () => {
    if (!importSelection) return;
    const selection = importSelection;
    importSelectionRef.current = undefined;
    setImportSelection(undefined);
    await window.kawaikara.application.cancelLogImport(selection.token);
  };

  /** Exports the frozen file selection as one Kawai log archive. */
  const exportSelectedLogs = async () => {
    if (selectedReferences.length === 0) return;
    try {
      const result = await window.kawaikara.application.exportLogFiles(
        selectedReferences,
      );
      if (result.status === 'exported') setNotice(messages.exportCompleted);
    } catch (reason) {
      setError(formatError(reason));
    }
  };

  /** Deletes the frozen selection after confirmation. */
  const confirmDelete = async () => {
    if (!deleteReferences) return;
    setDeleting(true);
    try {
      const result = await window.kawaikara.application.deleteLogFiles(
        deleteReferences,
      );
      setNotice(messages.deleteResult
        .replace('{deleted}', String(result.deleted))
        .replace('{skipped}', String(result.skipped.length)));
      setDeleteReferences(undefined);
      await Promise.all([refreshFiles(), refreshGroups()]);
    } catch (reason) {
      setError(formatError(reason));
    } finally {
      setDeleting(false);
    }
  };

  return {
    /** The beginImport value. */
    beginImport,
    /** The completeImport value. */
    completeImport,
    /** The cancelImport value. */
    cancelImport,
    /** The exportSelectedLogs value. */
    exportSelectedLogs,
    /** The confirmDelete value. */
    confirmDelete,
  };
}
