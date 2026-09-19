import {
  Badge,
  Button,
  Flex,
  Head,
  Panel,
  Progress,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';
import { useEffect, useState } from 'react';
import kawaikaraImage from '../../../../imgs/kawaikara_banner2.png';
import { selectLocalizedReleaseNotes } from '../../../Common/ReleaseNotes';
import { UpdatePanelProps } from './Types';
import { UpdateActions } from './UpdateActions';
import { formatBytes, formatChannel, formatProgress, getPhaseCopy, getProgressValue, versionSummary } from './UpdatePresentation';
import { UpdateReleaseNotesView } from './UpdateReleaseNotesView';

export type { UpdatePanelProps } from './Types';
/** Updates the panel. */
export function UpdatePanel({
  state,
  locale = 'en-US',
  labels,
  onDismiss,
  onDownload,
  onInstall,
  onRetry,
  initialView = 'status',
  view: controlledView,
  onViewChange,
}: UpdatePanelProps) {
  const [internalView, setInternalView] = useState(initialView);
  const view = controlledView ?? internalView;
  const copy = getPhaseCopy(state, labels);
  const progress = getProgressValue(state);
  const notes = selectLocalizedReleaseNotes(state.releaseNotes, locale)
    || labels.noReleaseNotes;
  const releaseIdentity = `${state.channel}:${state.latestVersion ?? state.currentVersion}`;
  const canShowReleaseNotes = Boolean(state.releaseNotes?.trim()) && [
    'available',
    'downloading',
    'downloaded',
  ].includes(state.phase);

  useEffect(() => {
    if (controlledView === undefined) setInternalView(initialView);
  }, [controlledView, initialView, releaseIdentity]);

  /** Sets the view. */
  const setView = (nextView: 'status' | 'release-notes') => {
    if (controlledView === undefined) setInternalView(nextView);
    onViewChange?.(nextView);
  };

  if (view === 'release-notes' && canShowReleaseNotes) {
    return (
      <UpdateReleaseNotesView
        labels={labels}
        notes={notes}
        state={state}
        onBack={() => setView('status')}
      />
    );
  }

  return (
    <main className={`update-shell is-${state.origin}`}>
      <Panel className="update-panel" padding="lg" radius="lg">
        <Stack align="center" gap="md">
          <img
            alt=""
            className="update-kawaikara-image"
            src={kawaikaraImage}
          />

          <Stack className="update-heading" align="center" gap="xs">
            <Badge dot tone={state.phase === 'error' ? 'neutral' : 'primary'}>
              {labels.channel}: {formatChannel(state.channel, labels)}
            </Badge>
            <Head level={1} size="lg">{copy.title}</Head>
            <Text size="sm" tone="muted">{copy.description}</Text>
          </Stack>

          <Stack className="update-progress-block" gap="sm">
            <Progress aria-label={copy.title} value={progress} />
            <Flex className="update-progress-meta" align="start" justify="between" gap="sm">
              <Text className="update-version-summary" size="xs" tone="muted">
                {versionSummary(state, labels)}
              </Text>
              {state.phase === 'downloading' && state.progress ? (
                <Text className="update-progress-summary" size="xs" tone="muted">
                  {formatProgress(state.progress.percent)}
                  {state.progress.total > 0
                    ? ` · ${formatBytes(state.progress.transferred)} / ${formatBytes(state.progress.total)}`
                    : ''}
                </Text>
              ) : null}
            </Flex>
          </Stack>

          {state.error ? (
            <Text className="update-error-message" size="sm">
              {state.error}
            </Text>
          ) : null}

          {canShowReleaseNotes ? (
            <Button
              className="update-release-notes-button"
              variant="secondary"
              onClick={() => setView('release-notes')}
            >
              <span>{labels.releaseNotes}</span>
              <span aria-hidden="true">→</span>
            </Button>
          ) : null}

          <UpdateActions
            labels={labels}
            state={state}
            onDismiss={onDismiss}
            onDownload={onDownload}
            onInstall={onInstall}
            onRetry={onRetry}
          />
        </Stack>
      </Panel>
    </main>
  );
}
