import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  Head,
  Input,
  Panel,
  Pressable,
  ScrollArea,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';
import type {
  ApplicationLogDocument,
  ApplicationLogFileReference,
  ApplicationLogFileSummary,
  ApplicationLogGroupSummary,
  ApplicationLogImportSelection,
  ApplicationLogLevel,
  ApplicationLogRepository,
  LogViewerMessages,
} from '../../../Common/IPC';
import {
  MultiSelectFilter,
  type MultiSelectFilterOption,
} from '../../Component/MultiSelectFilter';
import { HighlightedText } from './HighlightedText';
import { LogDeleteDialog } from './LogDeleteDialog';
import { LogFileContextMenu } from './LogFileContextMenu';
import { LogImportDialog } from './LogImportDialog';
import { LogMetadataControl } from './LogMetadataControl';

/** Defines a ready staged log import selection. */
type ReadyLogImportSelection = Extract<
  ApplicationLogImportSelection,
  {
    /** The ready status value. */
    readonly status: 'ready';
  }
>;
/** Defines a timestamp display mode. */
type LogTimestampMode = 'full' | 'compact';
/** Defines a resizable log column. */
type ResizableLogColumn = 'time' | 'level' | 'location';

/** Defines the visible log levels in severity order. */
const LOG_LEVELS: readonly ApplicationLogLevel[] = [
  'error',
  'warn',
  'info',
  'verbose',
  'debug',
  'silly',
  'unknown',
];
/** Defines the interval used to update the open active log. */
const ACTIVE_LOG_REFRESH_INTERVAL_MS = 1_200;
/** Defines the interval used to update log histories. */
const LOG_HISTORY_REFRESH_INTERVAL_MS = 4_000;
/** Defines the approximate custom context menu width. */
const LOG_CONTEXT_MENU_WIDTH = 250;
/** Defines the approximate custom context menu height. */
const LOG_CONTEXT_MENU_HEIGHT = 142;

/** Describes the visible custom context menu state. */
interface LogContextMenuState {
  /** The viewport x coordinate value. */
  readonly x: number;
  /** The viewport y coordinate value. */
  readonly y: number;
}

/** Describes the resizable column width state. */
interface LogColumnWidths {
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

/** Renders the layered application log viewer. */
export function LogViewer({ messages, locale, onClose }: LogViewerProps) {
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

  useEffect(
    () => () => resizeCleanupRef.current?.(),
    [],
  );

  useEffect(() => {
    importSelectionRef.current = importSelection;
  }, [importSelection]);

  useEffect(() => () => {
    const selection = importSelectionRef.current;
    if (selection) {
      void window.kawaikara.application.cancelLogImport(selection.token);
    }
  }, []);

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
      setSelectedFileNames((current) => new Set(
        [...current].filter((fileName) =>
          next.some((file) => file.fileName === fileName)),
      ));
      setActiveFile((current) => {
        if (
          current?.repository === repository &&
          current.groupId === selectedGroupId
        ) {
          const retained = next.find((file) => file.fileName === current.fileName);
          if (retained) return retained;
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
  const refreshDocument = useCallback(async () => {
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
      setDocument(next);
      setError(undefined);
    } catch (reason) {
      if (sequence === readSequenceRef.current) setError(formatError(reason));
    } finally {
      if (sequence === readSequenceRef.current) setLoading(false);
    }
  }, [activeFile, repository, selectedGroupId]);

  useEffect(() => {
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
  }, [activeFile, activeFileIsCurrent, refreshDocument]);

  const sourceLabels = useMemo(
    () => new Map(document?.metadata?.sources.map((source) => [
      source.id,
      source.label,
    ]) ?? []),
    [document?.metadata?.sources],
  );
  const sourceOptions = useMemo<MultiSelectFilterOption[]>(
    () => [...new Set(document?.entries.map((entry) => entry.source) ?? [])]
      .sort((left, right) => {
        const leftLabel = sourceLabels.get(left) ?? left;
        const rightLabel = sourceLabels.get(right) ?? right;
        return leftLabel.localeCompare(rightLabel, locale);
      })
      .map((source) => ({
        value: source,
        label: sourceLabels.get(source) ?? source,
      })),
    [document?.entries, locale, sourceLabels],
  );
  const levelOptions = useMemo<MultiSelectFilterOption[]>(
    () => LOG_LEVELS.map((level) => ({
      value: level,
      label: level.toUpperCase(),
      className: `log-viewer-level is-${level}`,
    })),
    [],
  );
  const selectedLevels = useMemo(
    () => new Set(levelOptions.map((option) => option.value)
      .filter((value) => !excludedLevels.has(value))),
    [excludedLevels, levelOptions],
  );
  const selectedSources = useMemo(
    () => new Set(sourceOptions.map((option) => option.value)
      .filter((value) => !excludedSources.has(value))),
    [excludedSources, sourceOptions],
  );
  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return (document?.entries ?? []).filter((entry) => {
      if (excludedLevels.has(entry.level) || excludedSources.has(entry.source)) {
        return false;
      }
      if (!normalizedQuery) return true;
      return `${entry.timestamp ?? ''} ${entry.level} ${entry.location} ${entry.message}`
        .toLocaleLowerCase(locale)
        .includes(normalizedQuery);
    });
  }, [document?.entries, excludedLevels, excludedSources, locale, query]);
  const visibleGroups = useMemo(() => {
    const normalizedQuery = groupQuery.trim().toLocaleLowerCase(locale);
    if (!normalizedQuery) return groups;
    return groups.filter((group) =>
      `${group.alias} ${group.id} ${group.sourceDeviceIds.join(' ')}`
        .toLocaleLowerCase(locale)
        .includes(normalizedQuery));
  }, [groupQuery, groups, locale]);
  const selectedFiles = useMemo(
    () => files.filter((file) => selectedFileNames.has(file.fileName)),
    [files, selectedFileNames],
  );
  const selectedReferences = useMemo(
    () => selectedFiles.map(toLogFileReference),
    [selectedFiles],
  );
  const tableStyle = {
    '--log-time-width': `${String(columnWidths.time)}px`,
    '--log-level-width': `${String(columnWidths.level)}px`,
    '--log-location-width': `${String(columnWidths.location)}px`,
  } as CSSProperties;

  useEffect(() => {
    if (!followLatestRef.current) return;
    window.requestAnimationFrame(() => {
      const scrollArea = scrollRef.current;
      if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    });
  }, [visibleEntries.length, activeFile?.fileName]);

  /** Replaces excluded values from a selected-value result. */
  const applySelection = (
    options: readonly MultiSelectFilterOption[],
    selected: ReadonlySet<string>,
    update: (value: Set<string>) => void,
  ) => {
    update(new Set(options.map((option) => option.value)
      .filter((value) => !selected.has(value))));
  };

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

  /** Starts pointer-driven resizing for one table column. */
  const startColumnResize = (
    column: ResizableLogColumn,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    resizeCleanupRef.current?.();
    const startX = event.clientX;
    const startWidth = columnWidths[column];
    const limits = {
      time: [130, 280],
      level: [72, 180],
      location: [140, 480],
    } as const;
    /** Updates the selected width while the pointer moves. */
    const handleMove = (moveEvent: PointerEvent) => {
      const [minimum, maximum] = limits[column];
      const width = Math.max(
        minimum,
        Math.min(maximum, startWidth + moveEvent.clientX - startX),
      );
      setColumnWidths((current) => ({ ...current, [column]: width
      }));
    };
    /** Releases global resize listeners. */
    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', cleanup);
      resizeCleanupRef.current = undefined;
    };
    resizeCleanupRef.current = cleanup;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', cleanup, { once: true
    });
  };

  /** Renders one selectable history item. */
  const renderFile = (file: ApplicationLogFileSummary, index: number) => (
    <Pressable
      className={`log-viewer-file${
        selectedFileNames.has(file.fileName) ? ' is-selected' : ''
      }${activeFile?.fileName === file.fileName ? ' is-active' : ''}`}
      key={`${file.repository}:${file.groupId ?? ''}:${file.fileName}`}
      pressed={selectedFileNames.has(file.fileName)}
      title={file.fileName}
      type="button"
      onClick={(event) => selectFile(
        file,
        index,
        event.ctrlKey || event.metaKey,
        event.shiftKey,
      )}
      onContextMenu={(event) => openFileContextMenu(event, file, index)}
    >
      <Flex align="center" justify="between" gap="xs">
        <Text as="span" className="log-viewer-file-name" size="xs">
          {file.fileName}
        </Text>
        {file.active ? <Badge size="sm" tone="success">{messages.current}</Badge> : null}
      </Flex>
      <Text as="span" className="log-viewer-file-meta" size="xs" tone="muted">
        {formatDate(file.modifiedAt, locale)} · {formatBytes(file.size, locale)}
      </Text>
    </Pressable>
  );

  return (
    <Box as="main" className="log-viewer-shell">
      <Panel className="log-viewer-surface" padding="none" radius="lg">
        <Flex className="log-viewer-header" align="center" justify="between" gap="lg">
          <Stack gap="xs">
            <Head level={1} size="md">{messages.title}</Head>
            <Text size="xs" tone="muted">{messages.description}</Text>
          </Stack>
          <Flex gap="xs">
            <Button
              aria-label={messages.refresh}
              size="icon"
              title={messages.refresh}
              variant="ghost"
              onClick={() => {
                void refreshGroups();
                void refreshFiles();
                void refreshDocument();
              }}
            >
              <Text as="span" aria-hidden="true" className="log-viewer-header-glyph">↻</Text>
            </Button>
            <Button
              aria-label={messages.close}
              size="icon"
              title={messages.close}
              variant="ghost"
              onClick={requestClose}
            >
              <Text as="span" aria-hidden="true" className="log-viewer-header-glyph">×</Text>
            </Button>
          </Flex>
        </Flex>

        <Flex className="log-viewer-toolbar" align="end" gap="sm" wrap>
          <Input
            aria-label={messages.search}
            containerClassName="log-viewer-search"
            controlSize="sm"
            placeholder={messages.searchPlaceholder}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <MultiSelectFilter
            clearAllLabel={messages.clearAll}
            label={messages.levels}
            options={levelOptions}
            selectAllLabel={messages.selectAll}
            selected={selectedLevels}
            onChange={(selected) =>
              applySelection(levelOptions, selected, setExcludedLevels)
            }
          />
          <MultiSelectFilter
            clearAllLabel={messages.clearAll}
            label={messages.sources}
            options={sourceOptions}
            selectAllLabel={messages.selectAll}
            selected={selectedSources}
            onChange={(selected) =>
              applySelection(sourceOptions, selected, setExcludedSources)
            }
          />
          <LogMetadataControl
            locale={locale}
            messages={messages}
            metadata={document?.metadata}
          />
        </Flex>

        <Box className="log-viewer-body">
          <Box as="aside" className="log-viewer-files" ref={fileListRef}>
            <Flex className="log-viewer-repository-selector" gap="xs">
              <Button
                aria-pressed={repository === 'application'}
                className={repository === 'application' ? 'is-selected' : undefined}
                size="sm"
                variant="secondary"
                onClick={() => changeRepository('application')}
              >
                {messages.applicationRepository}
              </Button>
              <Button
                aria-pressed={repository === 'external'}
                className={repository === 'external' ? 'is-selected' : undefined}
                size="sm"
                variant="secondary"
                onClick={() => changeRepository('external')}
              >
                {messages.externalRepository}
              </Button>
            </Flex>
            {repository === 'external' ? (
              <Box className="log-viewer-external-tools">
                <Input
                  aria-label={messages.groupSearch}
                  controlSize="sm"
                  placeholder={messages.groupSearchPlaceholder}
                  type="search"
                  value={groupQuery}
                  onChange={(event) => setGroupQuery(event.currentTarget.value)}
                />
                <Button
                  className="log-viewer-import-button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void beginImport()}
                >
                  {messages.importLogs}
                </Button>
              </Box>
            ) : null}
            {notice ? (
              <Text className="log-viewer-notice" size="xs" tone="muted">
                {notice}
              </Text>
            ) : null}
            <ScrollArea className="log-viewer-file-scroll" label={messages.title} scrollbar="auto">
              {repository === 'application' ? (
                <Stack gap="xs">
                  {files.map(renderFile)}
                  {!loading && files.length === 0 ? (
                    <Text className="log-viewer-empty" size="sm" tone="muted">
                      {messages.noFiles}
                    </Text>
                  ) : null}
                </Stack>
              ) : (
                <Stack className="log-viewer-group-list" gap="xs">
                  {visibleGroups.map((group) => {
                    const selected = group.id === selectedGroupId;
                    return (
                      <Box className="log-viewer-group" key={group.id}>
                        <Pressable
                          className={`log-viewer-group-button${selected ? ' is-selected' : ''}`}
                          pressed={selected}
                          title={`${group.alias || messages.unnamedGroup} · ${group.id}`}
                          type="button"
                          onClick={() => setSelectedGroupId(group.id)}
                        >
                          <Flex align="center" gap="xs">
                            <Text as="span" aria-hidden="true" className="log-viewer-folder-glyph">
                              {selected ? '▾' : '▸'}
                            </Text>
                            <Stack className="log-viewer-group-text" gap="none">
                              <Text as="span" className="log-viewer-group-alias" size="xs" weight="semibold">
                                {group.alias || messages.unnamedGroup}
                              </Text>
                              <Text as="span" size="xs" tone="muted">{group.id}</Text>
                              {group.sourceDeviceIds.map((deviceId) => (
                                <Text as="span" key={deviceId} size="xs" tone="muted">
                                  {deviceId}
                                </Text>
                              ))}
                            </Stack>
                            <Badge className="log-viewer-group-count" size="sm">
                              {messages.groupLogCount.replace('{count}', String(group.fileCount))}
                            </Badge>
                          </Flex>
                        </Pressable>
                        {selected ? (
                          <Stack className="log-viewer-group-files" gap="xs">
                            {files.map(renderFile)}
                          </Stack>
                        ) : null}
                      </Box>
                    );
                  })}
                  {!loading && visibleGroups.length === 0 ? (
                    <Text className="log-viewer-empty" size="sm" tone="muted">
                      {messages.noGroups}
                    </Text>
                  ) : null}
                </Stack>
              )}
            </ScrollArea>
          </Box>

          <Box as="section" className="log-viewer-log-panel">
            {document?.truncated ? (
              <Text className="log-viewer-truncated" size="xs" tone="muted">
                {messages.truncated}
              </Text>
            ) : null}
            {error ? (
              <Text className="log-viewer-status" size="sm" tone="danger">{error}</Text>
            ) : loading ? (
              <Text className="log-viewer-status" size="sm" tone="muted">{messages.loading}</Text>
            ) : !document ? (
              <Text className="log-viewer-status" size="sm" tone="muted">{messages.noFiles}</Text>
            ) : (
              <ScrollArea
                className="log-viewer-log-scroll"
                label={document.file.fileName}
                ref={scrollRef}
                scrollbar="auto"
                onScroll={(event) => {
                  const target = event.currentTarget;
                  followLatestRef.current =
                    target.scrollHeight - target.scrollTop - target.clientHeight < 40;
                }}
              >
                <Box className="log-viewer-table" role="table" style={tableStyle}>
                  <Box className="log-viewer-column-header log-viewer-grid-row" role="row">
                    <Box className="log-viewer-header-cell" role="columnheader">
                      <Button
                        className="log-viewer-time-format-button"
                        size="sm"
                        title={messages.changeTimeFormat}
                        variant="ghost"
                        onClick={() => setTimestampMode((current) =>
                          current === 'full' ? 'compact' : 'full')}
                      >
                        {messages.timeColumn}
                      </Button>
                      <Box
                        aria-hidden="true"
                        className="log-viewer-column-resizer"
                        onPointerDown={(event) => startColumnResize('time', event)}
                      />
                    </Box>
                    <Box className="log-viewer-header-cell" role="columnheader">
                      <Text as="span" size="xs">{messages.typeColumn}</Text>
                      <Box
                        aria-hidden="true"
                        className="log-viewer-column-resizer"
                        onPointerDown={(event) => startColumnResize('level', event)}
                      />
                    </Box>
                    <Box className="log-viewer-header-cell" role="columnheader">
                      <Text as="span" size="xs">{messages.locationColumn}</Text>
                      <Box
                        aria-hidden="true"
                        className="log-viewer-column-resizer"
                        onPointerDown={(event) => startColumnResize('location', event)}
                      />
                    </Box>
                    <Box className="log-viewer-header-cell" role="columnheader">
                      <Text as="span" size="xs">{messages.messageColumn}</Text>
                    </Box>
                  </Box>
                  {visibleEntries.length === 0 ? (
                    <Text className="log-viewer-table-empty" size="sm" tone="muted">
                      {messages.noEntries}
                    </Text>
                  ) : (
                    <Stack
                      className="log-viewer-entries"
                      gap="none"
                      ref={logEntriesRef}
                      role="rowgroup"
                    >
                      {visibleEntries.map((entry) => (
                        <Box
                          className="log-viewer-entry log-viewer-grid-row"
                          key={entry.id}
                          role="row"
                        >
                          <HighlightedText
                            as="span"
                            className="log-viewer-timestamp"
                            locale={locale}
                            query={query}
                            role="cell"
                            size="xs"
                            value={formatLogTimestamp(
                              entry.timestamp,
                              timestampMode,
                            )}
                          />
                          <HighlightedText
                            as="span"
                            className={`log-viewer-level is-${entry.level}`}
                            locale={locale}
                            query={query}
                            role="cell"
                            size="xs"
                            value={entry.level.toUpperCase()}
                            weight="semibold"
                          />
                          <HighlightedText
                            as="span"
                            className="log-viewer-location"
                            locale={locale}
                            query={query}
                            role="cell"
                            size="xs"
                            title={entry.location}
                            value={entry.location}
                          />
                          <HighlightedText
                            as="span"
                            className="log-viewer-message"
                            locale={locale}
                            query={query}
                            role="cell"
                            size="xs"
                            value={entry.message}
                          />
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>
              </ScrollArea>
            )}
          </Box>
        </Box>
      </Panel>

      {contextMenu && selectedFiles.length > 0 ? (
        <LogFileContextMenu
          deleteDisabled={selectedFiles.some((file) => file.active)}
          messages={messages}
          selectionCount={selectedFiles.length}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(undefined)}
          onDelete={() => setDeleteReferences(selectedReferences)}
          onExport={() => void exportSelectedLogs()}
          onOpenFolder={() => void window.kawaikara.application
            .openLogRepositoryDirectory(repository, selectedGroupId)}
        />
      ) : null}
      {importSelection ? (
        <LogImportDialog
          busy={importing}
          key={importSelection.token}
          messages={messages}
          selection={importSelection}
          onCancel={() => void cancelImport()}
          onConfirm={(alias) => void completeImport(alias)}
        />
      ) : null}
      {deleteReferences ? (
        <LogDeleteDialog
          busy={deleting}
          count={deleteReferences.length}
          messages={messages}
          onCancel={() => setDeleteReferences(undefined)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </Box>
  );
}

/** Converts a file summary to the bounded Main-process reference shape. */
function toLogFileReference(
  file: ApplicationLogFileSummary,
): ApplicationLogFileReference {
  return {
    /** The repository value. */
    repository: file.repository,
    /** The file name value. */
    fileName: file.fileName,
    /** The owning external group ID value. */
    groupId: file.groupId,
  };
}

/** Formats an IPC or renderer error for the visible status region. */
function formatError(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** Formats a full or compact log timestamp without timezone conversion. */
function formatLogTimestamp(
  value: string | undefined,
  mode: LogTimestampMode,
): string {
  if (!value) return '—';
  if (mode === 'full') return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?/.exec(value);
  return match ? `${match[2]}-${match[3]} ${match[4]}` : value;
}

/** Formats a log modification time in the active locale. */
function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/** Formats a compact byte count. */
function formatBytes(value: number, locale: string): string {
  if (value < 1_024) return `${value.toLocaleString(locale)} B`;
  if (value < 1_048_576) {
    return `${(value / 1_024).toLocaleString(locale, {
      maximumFractionDigits: 1,
    })} KB`;
  }
  return `${(value / 1_048_576).toLocaleString(locale, {
    maximumFractionDigits: 1,
  })} MB`;
}
