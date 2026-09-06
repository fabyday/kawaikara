import {
  Box,
  Button,
  Flex,
  Head,
  Panel,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';
import type { LogViewerMessages } from '../../../Common/IPC';

/** Describes the log deletion confirmation props contract. */
export interface LogDeleteDialogProps {
  /** The selected log count value. */
  readonly count: number;
  /** Whether deletion is running. */
  readonly busy: boolean;
  /** The localized messages value. */
  readonly messages: LogViewerMessages;
  /** Callback used to cancel deletion. */
  readonly onCancel: () => void;
  /** Callback used to confirm deletion. */
  readonly onConfirm: () => void;
}

/** Renders the destructive log deletion confirmation. */
export function LogDeleteDialog({
  count,
  busy,
  messages,
  onCancel,
  onConfirm,
}: LogDeleteDialogProps) {
  return (
    <Box className="log-viewer-dialog-backdrop" role="presentation">
      <Panel
        aria-label={messages.deleteConfirmTitle}
        className="log-delete-dialog"
        padding="lg"
        radius="lg"
        role="alertdialog"
      >
        <Stack gap="md">
          <Head level={2} size="sm">{messages.deleteConfirmTitle}</Head>
          <Text size="sm" tone="muted">
            {messages.deleteConfirmDescription.replace('{count}', String(count))}
          </Text>
          <Flex justify="end" gap="sm">
            <Button
              disabled={busy}
              size="sm"
              variant="secondary"
              onClick={onCancel}
            >
              {messages.cancel}
            </Button>
            <Button
              className="log-viewer-danger-button"
              isLoading={busy}
              size="sm"
              onClick={onConfirm}
            >
              {messages.deleteConfirm}
            </Button>
          </Flex>
        </Stack>
      </Panel>
    </Box>
  );
}
