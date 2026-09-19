import {
  useRef,
  useState
} from 'react';
import type {
  ApplicationLogDocument,
  ApplicationLogFileReference,
  ApplicationLogFileSummary,
  ApplicationLogGroupSummary,
  ApplicationLogRepository
} from '../../../../Common/IPC';
import { LogColumnWidths, LogContextMenuState, LogTimestampMode, ReadyLogImportSelection } from '../Types';

/** Coordinates log viewer state behavior for this View. */
export function useLogViewerState() {
  const [repository, setRepository] =
    useState<ApplicationLogRepository>('application');

  const [groups, setGroups] = useState<ApplicationLogGroupSummary[]>([]);

  const [selectedGroupId, setSelectedGroupId] = useState<string>();

  const [groupQuery, setGroupQuery] = useState('');

  const [files, setFiles] = useState<ApplicationLogFileSummary[]>([]);

  const [activeFile, setActiveFile] = useState<ApplicationLogFileSummary>();

  const [selectedFileNames, setSelectedFileNames] = useState<Set<string>>(
    () => new Set(),
  );

  const [document, setDocument] = useState<ApplicationLogDocument>();

  const [query, setQuery] = useState('');

  const [excludedLevels, setExcludedLevels] = useState<Set<string>>(
    () => new Set(),
  );

  const [excludedSources, setExcludedSources] = useState<Set<string>>(
    () => new Set(),
  );

  const [timestampMode, setTimestampMode] =
    useState<LogTimestampMode>('full');

  const [columnWidths, setColumnWidths] = useState<LogColumnWidths>({
    time: 180,
    level: 92,
    location: 230,
  });

  const [contextMenu, setContextMenu] = useState<LogContextMenuState>();

  const [importSelection, setImportSelection] =
    useState<ReadyLogImportSelection>();

  const [importing, setImporting] = useState(false);

  const [deleteReferences, setDeleteReferences] =
    useState<readonly ApplicationLogFileReference[]>();

  const [deleting, setDeleting] = useState(false);

  const [notice, setNotice] = useState<string>();

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string>();

  const scrollRef = useRef<HTMLDivElement>(null);

  const fileListRef = useRef<HTMLDivElement>(null);

  const logEntriesRef = useRef<HTMLDivElement>(null);

  const selectionAnchorRef = useRef<number | undefined>(undefined);

  const followLatestRef = useRef(true);

  const readSequenceRef = useRef(0);

  const listSequenceRef = useRef(0);

  const groupSequenceRef = useRef(0);

  const resizeCleanupRef = useRef<(() => void) | undefined>(undefined);

  const importSelectionRef = useRef<ReadyLogImportSelection | undefined>(
    undefined,
  );

  const activeFileIsCurrent = Boolean(
    activeFile?.repository === 'application' && activeFile.active,
  );

  return {
    /** The repository value. */
    repository,
    /** The setRepository value. */
    setRepository,
    /** The groups value. */
    groups,
    /** The setGroups value. */
    setGroups,
    /** The selectedGroupId value. */
    selectedGroupId,
    /** The setSelectedGroupId value. */
    setSelectedGroupId,
    /** The groupQuery value. */
    groupQuery,
    /** The setGroupQuery value. */
    setGroupQuery,
    /** The files value. */
    files,
    /** The setFiles value. */
    setFiles,
    /** The activeFile value. */
    activeFile,
    /** The setActiveFile value. */
    setActiveFile,
    /** The selectedFileNames value. */
    selectedFileNames,
    /** The setSelectedFileNames value. */
    setSelectedFileNames,
    /** The document value. */
    document,
    /** The setDocument value. */
    setDocument,
    /** The query value. */
    query,
    /** The setQuery value. */
    setQuery,
    /** The excludedLevels value. */
    excludedLevels,
    /** The setExcludedLevels value. */
    setExcludedLevels,
    /** The excludedSources value. */
    excludedSources,
    /** The setExcludedSources value. */
    setExcludedSources,
    /** The timestampMode value. */
    timestampMode,
    /** The setTimestampMode value. */
    setTimestampMode,
    /** The columnWidths value. */
    columnWidths,
    /** The setColumnWidths value. */
    setColumnWidths,
    /** The contextMenu value. */
    contextMenu,
    /** The setContextMenu value. */
    setContextMenu,
    /** The importSelection value. */
    importSelection,
    /** The setImportSelection value. */
    setImportSelection,
    /** The importing value. */
    importing,
    /** The setImporting value. */
    setImporting,
    /** The deleteReferences value. */
    deleteReferences,
    /** The setDeleteReferences value. */
    setDeleteReferences,
    /** The deleting value. */
    deleting,
    /** The setDeleting value. */
    setDeleting,
    /** The notice value. */
    notice,
    /** The setNotice value. */
    setNotice,
    /** The loading value. */
    loading,
    /** The setLoading value. */
    setLoading,
    /** The error value. */
    error,
    /** The setError value. */
    setError,
    /** The scrollRef value. */
    scrollRef,
    /** The fileListRef value. */
    fileListRef,
    /** The logEntriesRef value. */
    logEntriesRef,
    /** The selectionAnchorRef value. */
    selectionAnchorRef,
    /** The followLatestRef value. */
    followLatestRef,
    /** The readSequenceRef value. */
    readSequenceRef,
    /** The listSequenceRef value. */
    listSequenceRef,
    /** The groupSequenceRef value. */
    groupSequenceRef,
    /** The resizeCleanupRef value. */
    resizeCleanupRef,
    /** The importSelectionRef value. */
    importSelectionRef,
    /** The activeFileIsCurrent value. */
    activeFileIsCurrent,
  };
}
