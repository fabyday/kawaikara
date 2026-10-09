import {
  useCallback,
  useEffect,
  useRef
} from 'react';
import { mergeLogDocument } from '../LogDocumentUpdate';
import { formatError } from '../LogFormatting';
import { ACTIVE_LOG_REFRESH_INTERVAL_MS, LOG_HISTORY_REFRESH_INTERVAL_MS } from '../LogViewerDefaults';
import { type useLogViewerState } from './useLogViewerState';

/** Inputs used by useLogRepository. */
type LogRepositoryOptions = Pick<ReturnType<typeof useLogViewerState>,
  | 'groupSequenceRef'
  | 'setGroups'
  | 'setSelectedGroupId'
  | 'setError'
  | 'repository'
  | 'selectedGroupId'
  | 'setFiles'
  | 'setActiveFile'
  | 'setSelectedFileNames'
  | 'setLoading'
  | 'listSequenceRef'
  | 'activeFile'
  | 'readSequenceRef'
  | 'setDocument'
  | 'selectionAnchorRef'
  | 'followLatestRef'
  | 'activeFileIsCurrent'
>;

/** Coordinates log repository behavior for this View. */
export function useLogRepository({
  groupSequenceRef,
  setGroups,
  setSelectedGroupId,
  setError,
  repository,
  selectedGroupId,
  setFiles,
  setActiveFile,
  setSelectedFileNames,
  setLoading,
  listSequenceRef,
  activeFile,
  readSequenceRef,
  setDocument,
  selectionAnchorRef,
  followLatestRef,
  activeFileIsCurrent,
}: LogRepositoryOptions) {
  const activeRef = useRef(activeFile);
  activeRef.current = activeFile;
  const readInFlight = useRef<Promise<void> | undefined>(undefined);
  const fileName = activeFile?.fileName;
  /** Refreshes the external group history. */
  const refreshGroups = useCallback(async () => {
    const sequence = groupSequenceRef.current + 1;
    groupSequenceRef.current = sequence;
    try {
      const next = await window.kawaikara.application.listLogGroups();
      if (sequence !== groupSequenceRef.current) return;
      setGroups(next);
      setSelectedGroupId((current) => {
        if (current && next.some((group) => group.id === current)) return current;
        return next[0]?.id;
      });
      setError(undefined);
    } catch (reason) {
      if (sequence === groupSequenceRef.current) {
        setError(formatError(reason));
      }
    }
  }, []);

  /** Refreshes the selected repository or group file history. */
  const refreshFiles = useCallback(async () => {
    if (repository === 'external' && !selectedGroupId) {
      setFiles([]);
      setActiveFile(undefined);
      setSelectedFileNames(new Set());
      setLoading(false);
      return;
    }
    const sequence = listSequenceRef.current + 1;
    listSequenceRef.current = sequence;
    try {
      const next = await window.kawaikara.application.listLogFiles(
        repository,
        selectedGroupId,
      );
      if (sequence !== listSequenceRef.current) return;
      setFiles(next);
      const prior = activeRef.current;
      const retained = prior?.repository === repository && prior.groupId === selectedGroupId
        ? next.find((file) => file.fileName === prior.fileName) : undefined;
      const automatic = retained ? undefined : next.find((file) => file.active) ?? next[0];
      setSelectedFileNames((current) => {
        if (automatic) {
          selectionAnchorRef.current = next.indexOf(automatic);
          return new Set([automatic.fileName]);
        }
        const retainedNames = [...current].filter((name) => next.some((file) => file.fileName === name));
        return retainedNames.length === current.size ? current : new Set(retainedNames);
      });
      setActiveFile((current) => {
        if (
          current?.repository === repository &&
          current.groupId === selectedGroupId
        ) {
          const retained = next.find((file) => file.fileName === current.fileName);
          if (retained) {
            return retained.active === current.active ? current : retained;
          }
        }
        return next.find((file) => file.active) ?? next[0];
      });
      setError(undefined);
    } catch (reason) {
      if (sequence === listSequenceRef.current) setError(formatError(reason));
    } finally {
      if (sequence === listSequenceRef.current) setLoading(false);
    }
  }, [repository, selectedGroupId]);

  /** Refreshes the active log document when it still belongs to this view. */
  const readDocument = useCallback(async () => {
    if (
      !activeFile ||
      activeFile.repository !== repository ||
      activeFile.groupId !== selectedGroupId
    ) {
      return;
    }
    const sequence = readSequenceRef.current + 1;
    readSequenceRef.current = sequence;
    try {
      const next = await window.kawaikara.application.readLogFile(
        activeFile.repository,
        activeFile.fileName,
        activeFile.groupId,
      );
      if (sequence !== readSequenceRef.current) return;
      setDocument((current) => mergeLogDocument(current, next));
      setError(undefined);
    } catch (reason) {
      if (sequence === readSequenceRef.current) setError(formatError(reason));
    } finally {
      if (sequence === readSequenceRef.current) setLoading(false);
    }
  }, [fileName, repository, selectedGroupId]);

  const refreshDocument = useCallback(() => {
    if (readInFlight.current) return readInFlight.current;
    const pending = readDocument().finally(() => {
      if (readInFlight.current === pending) readInFlight.current = undefined;
    });
    readInFlight.current = pending;
    return pending;
  }, [readDocument]);

  useEffect(() => {
    readInFlight.current = undefined;
    if (repository !== 'external') return;
    void refreshGroups();
    const timer = window.setInterval(
      () => void refreshGroups(),
      LOG_HISTORY_REFRESH_INTERVAL_MS,
    );
    return () => {
      groupSequenceRef.current += 1;
      window.clearInterval(timer);
    };
  }, [refreshGroups, repository]);

  useEffect(() => {
    listSequenceRef.current += 1;
    readSequenceRef.current += 1;
    setFiles([]);
    setActiveFile(undefined);
    setSelectedFileNames(new Set());
    setDocument(undefined);
    setLoading(true);
    setError(undefined);
    selectionAnchorRef.current = undefined;
    void refreshFiles();
    const timer = window.setInterval(
      () => void refreshFiles(),
      LOG_HISTORY_REFRESH_INTERVAL_MS,
    );
    return () => {
      listSequenceRef.current += 1;
      window.clearInterval(timer);
    };
  }, [refreshFiles]);

  useEffect(() => {
    if (!activeFile) {
      readSequenceRef.current += 1;
      setDocument(undefined);
      return;
    }
    setLoading(true);
    setDocument(undefined);
    readInFlight.current = undefined;
    followLatestRef.current = true;
    void refreshDocument();
    if (!activeFileIsCurrent) {
      return () => {
        readSequenceRef.current += 1;
      };
    }
    const timer = window.setInterval(
      () => void refreshDocument(),
      ACTIVE_LOG_REFRESH_INTERVAL_MS,
    );
    return () => {
      readSequenceRef.current += 1;
      window.clearInterval(timer);
    };
  }, [fileName, repository, selectedGroupId, activeFileIsCurrent, refreshDocument]);

  return {
    /** The refreshGroups value. */
    refreshGroups,
    /** The refreshFiles value. */
    refreshFiles,
    /** The refreshDocument value. */
    refreshDocument,
  };
}
