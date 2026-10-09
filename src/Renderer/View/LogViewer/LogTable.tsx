import {
  Box,
  Button,
  ScrollArea,
  Stack,
  Text
} from '@kawaikara/kawai-ui';
import {
  type CSSProperties,
  memo,
  useLayoutEffect,
  useRef
} from 'react';
import { HighlightedText } from './HighlightedText';
import { type useLogColumnResize } from './Hooks/useLogColumnResize';
import { type useLogFilters } from './Hooks/useLogFilters';
import { type useLogViewerState } from './Hooks/useLogViewerState';
import { formatLogTimestamp } from './LogFormatting';
import { LogViewerProps } from './Types';

/** Inputs for the LogTable section. */
type LogTableProps = Pick<ReturnType<typeof useLogViewerState>,
  | 'document'
  | 'error'
  | 'loading'
  | 'scrollRef'
  | 'followLatestRef'
  | 'setTimestampMode'
  | 'logEntriesRef'
  | 'query'
  | 'timestampMode'
> & Pick<LogViewerProps,
  | 'messages'
  | 'locale'
> & Pick<ReturnType<typeof useLogColumnResize>,
  | 'startColumnResize'
> & Pick<ReturnType<typeof useLogFilters>,
  | 'visibleEntries'
> & {
  /** The tableStyle value for this section. */
  readonly tableStyle: CSSProperties;
};

/** Renders the LogTable section of this View. */
export function LogTable({
  document,
  messages,
  error,
  loading,
  scrollRef,
  followLatestRef,
  tableStyle,
  setTimestampMode,
  startColumnResize,
  visibleEntries,
  logEntriesRef,
  locale,
  query,
  timestampMode,
}: LogTableProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const table = tableRef.current;
    if (!scroll || !table) return;
    /** Uses the actual gutter, including macOS overlay-scrollbar layouts. */
    const measure = () => {
      table.style.setProperty('--log-scrollbar-width', `${scroll.offsetWidth - scroll.clientWidth}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    return () => observer.disconnect();
  }, [Boolean(document)]);
  return (
    <Box as="section" className="log-viewer-log-panel">
      {document?.truncated ? (
        <Text className="log-viewer-truncated" size="xs" tone="muted">
          {messages.truncated}
        </Text>
      ) : null}
      {error && !document ? (
        <Text className="log-viewer-status" size="sm" tone="danger">{error}</Text>
      ) : loading && !document ? (
        <Text className="log-viewer-status" size="sm" tone="muted">{messages.loading}</Text>
      ) : !document ? (
        <Text className="log-viewer-status" size="sm" tone="muted">{messages.noFiles}</Text>
      ) : (
        <Box className="log-viewer-table" ref={tableRef} role="table" style={tableStyle}>
          <Box className="log-viewer-header-viewport">
            <Box className="log-viewer-header-content">
              <Box ref={headerRef}>
                <LogTableHeader messages={messages} setTimestampMode={setTimestampMode}
                  startColumnResize={startColumnResize} />
              </Box>
            </Box>
          </Box>
          <ScrollArea
            className="log-viewer-log-scroll"
            label={document.file.fileName}
            ref={scrollRef}
            scrollbar="auto"
            onScroll={(event) => {
              const target = event.currentTarget;
              if (headerRef.current) headerRef.current.style.transform = `translateX(${-target.scrollLeft}px)`;
              followLatestRef.current =
                target.scrollHeight - target.scrollTop - target.clientHeight < 40;
            }}
          >
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
                  <LogEntryRow
                    key={entry.id}
                    locale={locale}
                    query={query}
                    timestampMode={timestampMode}
                    entry={entry}
                  />
                ))}
              </Stack>
            )}
          </ScrollArea>
        </Box>
      )}
    </Box>
  );
}

/** Column labels, timestamp format control, and resize handles. */
function LogTableHeader({
  messages,
  setTimestampMode,
  startColumnResize,
}: Pick<LogTableProps, 'messages' | 'setTimestampMode' | 'startColumnResize'>) {
  return (
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
  );
}

/** One highlighted log entry with separate time, level, source, and message cells. */
const LogEntryRow = memo(function LogEntryRow({
  locale,
  query,
  timestampMode,
  entry,
}: Pick<LogTableProps, 'locale' | 'query' | 'timestampMode'> & {
  /** entry supplied by the owning composition. */
  readonly entry: LogTableProps['visibleEntries'][number];
}) {
  return (
    <Box
      className="log-viewer-entry log-viewer-grid-row"
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
  );
});
