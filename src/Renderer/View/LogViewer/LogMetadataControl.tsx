import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  Head,
  Panel,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';
import type {
  ApplicationLogMetadata,
  LogViewerMessages,
} from '../../../Common/IPC';

/** Describes the log metadata control props contract. */
export interface LogMetadataControlProps {
  /** The validated metadata value. */
  readonly metadata?: ApplicationLogMetadata;
  /** The localized messages value. */
  readonly messages: LogViewerMessages;
  /** The resolved locale value. */
  readonly locale: string;
}

/** Renders the metadata trigger and its dismissible context panel. */
export function LogMetadataControl({
  metadata,
  messages,
  locale,
}: LogMetadataControlProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const copyTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    /** Closes the panel when the pointer leaves its owning control. */
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', closeOnOutsidePointer, true);
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer, true);
  }, [open]);

  useEffect(
    () => () => {
      if (copyTimerRef.current !== undefined) {
        window.clearTimeout(copyTimerRef.current);
      }
    },
    [],
  );

  /** Copies a readable metadata table to the system clipboard. */
  const copyMetadata = async () => {
    if (!metadata) return;
    await window.kawaikara.application.copyText(
      createMetadataText(metadata),
    );
    setCopied(true);
    if (copyTimerRef.current !== undefined) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      copyTimerRef.current = undefined;
      setCopied(false);
    }, 1_500);
  };

  const rows = metadata ? createMetadataRows(metadata, messages, locale) : [];
  return (
    <Box className="log-metadata-control" position="relative" ref={rootRef}>
      <Button
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={!metadata}
        size="sm"
        title={metadata ? messages.metadata : messages.metadataUnavailable}
        variant="secondary"
        onClick={() => setOpen((value) => !value)}
      >
        {messages.metadata}
      </Button>
      {open && metadata ? (
        <Panel
          aria-label={messages.metadata}
          className="log-metadata-panel"
          padding="md"
          radius="md"
          role="dialog"
        >
          <Flex align="center" justify="between" gap="md">
            <Head level={2} size="sm">{messages.metadata}</Head>
            <Button
              aria-label={messages.close}
              className="log-metadata-close"
              size="icon"
              title={messages.close}
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              <Text as="span" aria-hidden="true">×</Text>
            </Button>
          </Flex>
          <Flex className="log-metadata-copy-row" justify="end">
            <Button size="sm" variant="secondary" onClick={() => void copyMetadata()}>
              {copied ? messages.copied : messages.copy}
            </Button>
          </Flex>
          <Stack className="log-metadata-table" gap="none">
            {rows.map(([label, value]) => (
              <Box className="log-metadata-row" key={label}>
                <Text as="span" size="xs" tone="muted">{label}</Text>
                <Text as="span" className="log-metadata-value" size="xs">
                  {value}
                </Text>
              </Box>
            ))}
          </Stack>
        </Panel>
      ) : null}
    </Box>
  );
}

/** Creates the visible metadata table rows. */
function createMetadataRows(
  metadata: ApplicationLogMetadata,
  messages: LogViewerMessages,
  locale: string,
): readonly (readonly [string, string])[] {
  return [
    [messages.metadataApplication, metadata.applicationName],
    [messages.metadataVersion, metadata.version],
    [messages.metadataChannel, metadata.channel],
    [messages.metadataPlatform, `${metadata.platform} · ${metadata.arch}`],
    [messages.metadataSiteApi, `v${String(metadata.siteApiVersion)}`],
    [
      messages.metadataRuntime,
      `Electron ${metadata.runtime.electron} · Chrome ${metadata.runtime.chrome} · Node ${metadata.runtime.node} · V8 ${metadata.runtime.v8}`,
    ],
    [messages.metadataSession, metadata.sessionId],
    ...(metadata.deviceId
      ? [[messages.metadataDeviceId, metadata.deviceId] as const]
      : []),
    [
      messages.metadataCreatedAt,
      new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium'
      }).format(new Date(metadata.createdAt)),
    ],
  ];
}

/** Creates the localized clipboard representation of log metadata. */
function createMetadataText(
  metadata: ApplicationLogMetadata,
): string {
  return [
    metadata.applicationName,
    metadata.version,
    metadata.channel,
    `${metadata.platform} · ${metadata.arch}`,
    `v${String(metadata.siteApiVersion)}`,
    `Electron ${metadata.runtime.electron} · Chrome ${metadata.runtime.chrome} · Node ${metadata.runtime.node} · V8 ${metadata.runtime.v8}`,
    metadata.sessionId,
  ].join('\n');
}
