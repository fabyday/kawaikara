import {
  Box,
  Button,
  Flex,
  Head,
  Input,
  Panel,
  Stack,
  Text
} from '@kawaikara/kawai-ui';
import {
  type CSSProperties,
  useEffect,
  useLayoutEffect
} from 'react';
import {
  MultiSelectFilter,
  type MultiSelectFilterOption,
} from '../../Component/MultiSelectFilter';
import { useLogColumnResize } from './Hooks/useLogColumnResize';
import { useLogFileActions } from './Hooks/useLogFileActions';
import { useLogFilters } from './Hooks/useLogFilters';
import { useLogHistorySelection } from './Hooks/useLogHistorySelection';
import { useLogRepository } from './Hooks/useLogRepository';
import { useLogViewerKeyboard } from './Hooks/useLogViewerKeyboard';
import { useLogViewerState } from './Hooks/useLogViewerState';
import { LogDeleteDialog } from './LogDeleteDialog';
import { LogFileContextMenu } from './LogFileContextMenu';
import { LogHistory } from './LogHistory';
import { LogImportDialog } from './LogImportDialog';
import { LogMetadataControl } from './LogMetadataControl';
import { LogTable } from './LogTable';
import { LogViewerProps } from './Types';

export type { LogViewerProps } from './Types';
/** Renders the layered application log viewer. */
export function LogViewer({ messages, locale, onClose }: LogViewerProps) {

  const logViewerState = useLogViewerState();
  const {
    repository,
    selectedGroupId,
    activeFile,
    document,
    query,
    setQuery,
    setExcludedLevels,
    setExcludedSources,
    columnWidths,
    contextMenu,
    setContextMenu,
    importSelection,
    importing,
    deleteReferences,
    setDeleteReferences,
    deleting,
    scrollRef,
    followLatestRef,
    resizeCleanupRef,
    importSelectionRef,
  } = logViewerState;

  const logViewerKeyboard = useLogViewerKeyboard({
    ...logViewerState,
    onClose,
  });
  const {
    requestClose,
  } = logViewerKeyboard;

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

  const logRepository = useLogRepository({
    ...logViewerState,
  });
  const {
    refreshGroups,
    refreshFiles,
    refreshDocument,
  } = logRepository;

  const logFilters = useLogFilters({
    ...logViewerState,
    locale,
  });
  const {
    sourceOptions,
    levelOptions,
    selectedLevels,
    selectedSources,
    visibleEntries,
    selectedFiles,
    selectedReferences,
  } = logFilters;
  const tableStyle = {
    '--log-time-width': `${String(columnWidths.time)}px`,
    '--log-level-width': `${String(columnWidths.level)}px`,
    '--log-location-width': `${String(columnWidths.location)}px`,
  } as CSSProperties;

  useLayoutEffect(() => {
    if (!followLatestRef.current) return;
    const scrollArea = scrollRef.current;
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
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

  const logHistorySelection = useLogHistorySelection({
    ...logViewerState,
  });

  const logFileActions = useLogFileActions({
    ...logViewerState,
    ...logRepository,
    ...logFilters,
    messages,
  });
  const {
    completeImport,
    cancelImport,
    exportSelectedLogs,
    confirmDelete,
  } = logFileActions;

  const logColumnResize = useLogColumnResize({
    ...logViewerState,
  });

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
          <LogHistory
            {...logViewerState}
            {...logHistorySelection}
            {...logFileActions}
            {...logFilters}
            messages={messages}
            locale={locale}
          />

          <LogTable
            {...logViewerState}
            {...logColumnResize}
            {...logFilters}
            messages={messages}
            tableStyle={tableStyle}
            locale={locale}
          />
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
