import {
  Badge,
  Box,
  Button,
  Flex,
  Input,
  Pressable,
  ScrollArea,
  Stack,
  Text
} from '@kawaikara/kawai-ui';
import type {
  ApplicationLogFileSummary
} from '../../../Common/IPC';
import { type useLogFileActions } from './Hooks/useLogFileActions';
import { type useLogFilters } from './Hooks/useLogFilters';
import { type useLogHistorySelection } from './Hooks/useLogHistorySelection';
import { type useLogViewerState } from './Hooks/useLogViewerState';
import { formatBytes, formatDate } from './LogFormatting';
import { LogViewerProps } from './Types';

/** Inputs for the LogHistory section. */
type LogHistoryProps = Pick<ReturnType<typeof useLogViewerState>,
  | 'selectedFileNames'
  | 'activeFile'
  | 'fileListRef'
  | 'repository'
  | 'groupQuery'
  | 'setGroupQuery'
  | 'notice'
  | 'files'
  | 'loading'
  | 'selectedGroupId'
  | 'setSelectedGroupId'
> & Pick<ReturnType<typeof useLogHistorySelection>,
  | 'selectFile'
  | 'openFileContextMenu'
  | 'changeRepository'
> & Pick<LogViewerProps,
  | 'messages'
  | 'locale'
> & Pick<ReturnType<typeof useLogFileActions>,
  | 'beginImport'
> & Pick<ReturnType<typeof useLogFilters>,
  | 'visibleGroups'
>;

/** Renders the LogHistory section of this View. */
export function LogHistory({
  selectedFileNames,
  activeFile,
  selectFile,
  openFileContextMenu,
  messages,
  locale,
  fileListRef,
  repository,
  changeRepository,
  groupQuery,
  setGroupQuery,
  beginImport,
  notice,
  files,
  loading,
  visibleGroups,
  selectedGroupId,
  setSelectedGroupId,
}: LogHistoryProps) {
  /** Renders one selectable history item. */
  const renderFile = (file: ApplicationLogFileSummary, index: number) => (
    <LogFileItem
      key={`${file.repository}:${file.groupId ?? ''}:${file.fileName}`}
      selectedFileNames={selectedFileNames}
      activeFile={activeFile}
      selectFile={selectFile}
      openFileContextMenu={openFileContextMenu}
      messages={messages}
      locale={locale}
      file={file}
      index={index}
    />
  );
  return (
    <Box as="aside" className="log-viewer-files" ref={fileListRef}>
      <LogRepositorySelector
        messages={messages}
        repository={repository}
        changeRepository={changeRepository}
      />
      {repository === 'external' ? (
        <ExternalLogTools
          messages={messages}
          groupQuery={groupQuery}
          setGroupQuery={setGroupQuery}
          beginImport={beginImport}
        />
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
          <LogGroupList
            messages={messages}
            files={files}
            loading={loading}
            visibleGroups={visibleGroups}
            selectedGroupId={selectedGroupId}
            setSelectedGroupId={setSelectedGroupId}
            renderFile={renderFile}
          />
        )}
      </ScrollArea>
    </Box>
  );
}

/** One selectable log file, including its current-session badge and metadata. */
function LogFileItem({
  selectedFileNames,
  activeFile,
  selectFile,
  openFileContextMenu,
  messages,
  locale,
  file,
  index,
}: Pick<LogHistoryProps, 'selectedFileNames' | 'activeFile' | 'selectFile' | 'openFileContextMenu' | 'messages' | 'locale'> & {
  /** file supplied by the owning composition. */
  readonly file: ApplicationLogFileSummary;
  /** index supplied by the owning composition. */
  readonly index: number;
}) {
  return (
    <Pressable
      className={`log-viewer-file${selectedFileNames.has(file.fileName) ? ' is-selected' : ''
        }${activeFile?.fileName === file.fileName ? ' is-active' : ''}`}

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
}

/** Switches between application logs and imported repositories. */
function LogRepositorySelector({
  messages,
  repository,
  changeRepository,
}: Pick<LogHistoryProps, 'messages' | 'repository' | 'changeRepository'>) {
  return (
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
  );
}

/** Search and import controls for external log groups. */
function ExternalLogTools({
  messages,
  groupQuery,
  setGroupQuery,
  beginImport,
}: Pick<LogHistoryProps, 'messages' | 'groupQuery' | 'setGroupQuery' | 'beginImport'>) {
  return (
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
  );
}

/** Identifies an imported group by alias, ID, and originating devices. */
function LogGroupIdentity({
  messages,
  group,
}: Pick<LogHistoryProps, 'messages'> & {
  /** group supplied by the owning composition. */
  readonly group: LogHistoryProps['visibleGroups'][number];
}) {
  return (
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
  );
}

/** An expandable group header and its selected file list. */
function LogGroupItem({
  messages,
  files,
  setSelectedGroupId,
  group,
  selected,
  renderFile,
}: Pick<LogHistoryProps, 'messages' | 'files' | 'setSelectedGroupId'> & {
  /** group supplied by the owning composition. */
  readonly group: LogHistoryProps['visibleGroups'][number];
  /** selected supplied by the owning composition. */
  readonly selected: boolean;
  /** renderFile supplied by the owning composition. */
  readonly renderFile: (file: ApplicationLogFileSummary, index: number) => React.ReactNode;
}) {
  return (
    <Box className="log-viewer-group">
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
          <LogGroupIdentity
            messages={messages}
            group={group}
          />
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
}

/** Composes imported groups without embedding their row implementation. */
function LogGroupList({
  messages,
  files,
  loading,
  visibleGroups,
  selectedGroupId,
  setSelectedGroupId,
  renderFile,
}: Pick<LogHistoryProps, 'messages' | 'files' | 'loading' | 'visibleGroups' | 'selectedGroupId' | 'setSelectedGroupId'> & {
  /** renderFile supplied by the owning composition. */
  readonly renderFile: (file: ApplicationLogFileSummary, index: number) => React.ReactNode;
}) {
  return (
    <Stack className="log-viewer-group-list" gap="xs">
      {visibleGroups.map((group) => {
        const selected = group.id === selectedGroupId;
        return (
          <LogGroupItem
            key={group.id}
            messages={messages}
            files={files}
            setSelectedGroupId={setSelectedGroupId}
            group={group}
            selected={selected}
            renderFile={renderFile}
          />
        );
      })}
      {!loading && visibleGroups.length === 0 ? (
        <Text className="log-viewer-empty" size="sm" tone="muted">
          {messages.noGroups}
        </Text>
      ) : null}
    </Stack>
  );
}
