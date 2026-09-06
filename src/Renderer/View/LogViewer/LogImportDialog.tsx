import { useState } from 'react';
import {
  Box,
  Button,
  Flex,
  Head,
  Input,
  Panel,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';
import type {
  ApplicationLogImportSelection,
  LogViewerMessages,
} from '../../../Common/IPC';

/** Defines a ready log import selection. */
type ReadyLogImportSelection = Extract<
  ApplicationLogImportSelection,
  {
    /** The ready status value. */
    readonly status: 'ready';
  }
>;

/** Describes the staged log import dialog props contract. */
export interface LogImportDialogProps {
  /** The staged native file selection value. */
  readonly selection: ReadyLogImportSelection;
  /** The localized messages value. */
  readonly messages: LogViewerMessages;
  /** Whether the import operation is running. */
  readonly busy: boolean;
  /** Callback used to confirm the import alias. */
  readonly onConfirm: (alias: string) => void;
  /** Callback used to cancel the staged import. */
  readonly onCancel: () => void;
}

/** Renders the non-dismissible import naming flow. */
export function LogImportDialog({
  selection,
  messages,
  busy,
  onConfirm,
  onCancel,
}: LogImportDialogProps) {
  const [alias, setAlias] = useState(selection.suggestedAlias ?? '');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  return (
    <Box className="log-viewer-dialog-backdrop" role="presentation">
      <Panel
        aria-label={messages.importAliasTitle}
        className="log-import-dialog"
        padding="lg"
        radius="lg"
        role="dialog"
      >
        <Flex align="center" justify="between" gap="md">
          <Head level={2} size="sm">{messages.importAliasTitle}</Head>
          <Button
            aria-label={messages.close}
            className="log-metadata-close"
            disabled={busy}
            size="icon"
            title={messages.close}
            variant="ghost"
            onClick={() => setConfirmingCancel(true)}
          >
            <Text as="span" aria-hidden="true">×</Text>
          </Button>
        </Flex>
        <Stack gap="md">
          <Text size="sm" tone="muted">{messages.importAliasDescription}</Text>
          <Text size="xs" tone="muted">
            {messages.importInputCount.replace(
              '{count}',
              String(selection.inputCount),
            )}
          </Text>
          <Input
            aria-label={messages.importAliasLabel}
            autoFocus
            controlSize="md"
            maxLength={120}
            placeholder={messages.importAliasPlaceholder}
            value={alias}
            onChange={(event) => setAlias(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || busy) return;
              event.preventDefault();
              onConfirm(alias);
            }}
          />
          <Flex justify="end" gap="sm">
            <Button
              disabled={busy}
              size="sm"
              variant="secondary"
              onClick={() => setConfirmingCancel(true)}
            >
              {messages.cancel}
            </Button>
            <Button
              isLoading={busy}
              size="sm"
              onClick={() => onConfirm(alias)}
            >
              {messages.confirmImport}
            </Button>
          </Flex>
        </Stack>
        {confirmingCancel ? (
          <Box className="log-import-cancel-backdrop" role="presentation">
            <Panel
              aria-label={messages.stopImportTitle}
              className="log-import-cancel-dialog"
              padding="lg"
              radius="md"
              role="alertdialog"
            >
              <Stack gap="md">
                <Head level={3} size="sm">{messages.stopImportTitle}</Head>
                <Text size="sm" tone="muted">
                  {messages.stopImportDescription}
                </Text>
                <Flex justify="end" gap="sm">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setConfirmingCancel(false)}
                  >
                    {messages.continueImport}
                  </Button>
                  <Button
                    className="log-viewer-danger-button"
                    size="sm"
                    onClick={onCancel}
                  >
                    {messages.stopImport}
                  </Button>
                </Flex>
              </Stack>
            </Panel>
          </Box>
        ) : null}
      </Panel>
    </Box>
  );
}
