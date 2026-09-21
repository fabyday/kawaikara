import {
  Button,
  Flex
} from '@kawaikara/kawai-ui';
import type {
  ApplicationUpdatePanelState
} from '../../../Common/IPC';
import { UpdatePanelLabels } from './Types';

/** Updates the actions. */
export function UpdateActions({
  labels,
  state,
  onDismiss,
  onDownload,
  onInstall,
  onRetry,
}: {
  /** The labels value. */
  readonly labels: UpdatePanelLabels;
  /** The state value. */
  readonly state: ApplicationUpdatePanelState;
  /** Callback used to handle on dismiss. */
  readonly onDismiss: () => void;
  /** Callback used to handle on download. */
  readonly onDownload: () => void | Promise<void>;
  /** Callback used to handle on install. */
  readonly onInstall: () => void | Promise<void>;
  /** Callback used to handle on retry. */
  readonly onRetry: () => void | Promise<void>;
}
) {
  const { phase } = state;
  if (phase === 'preparing' || phase === 'installing') return null;
  if (phase === 'available') {
    return (
      <Flex className="update-actions" align="center" justify="end" gap="sm">
        <Button onClick={() => void onDownload()}>{labels.download}</Button>
      </Flex>
    );
  }
  if (phase === 'downloaded') {
    if (state.origin === 'automatic') return null;
    return (
      <Flex className="update-actions" align="center" justify="end" gap="sm">
        <Button onClick={() => void onInstall()}>{labels.restart}</Button>
      </Flex>
    );
  }
  if (phase === 'error') {
    const canRetry = state.errorStage !== 'install'
      && state.errorCode !== 'ERR_UPDATER_INVALID_SIGNATURE';
    return (
      <Flex className="update-actions" align="center" justify="end" gap="sm">
        <Button variant="ghost" onClick={onDismiss}>{labels.close}</Button>
        {canRetry ? (
          <Button variant="secondary" onClick={() => void onRetry()}>
            {labels.retry}
          </Button>
        ) : null}
        {state.canRetryInstall ? (
          <Button onClick={() => void onInstall()}>{labels.restart}</Button>
        ) : null}
      </Flex>
    );
  }
  if (phase === 'downloading') return null;
  return (
    <Flex className="update-actions" align="center" justify="end">
      <Button
        disabled={phase === 'checking'}
        variant="secondary"
        onClick={onDismiss}
      >
        {labels.close}
      </Button>
    </Flex>
  );
}
