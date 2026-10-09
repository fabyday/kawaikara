import {
  Badge,
  Button,
  Flex,
  Panel,
  Stack,
} from '@kawaikara/kawai-ui';
import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import kawaikaraImage from '../../../../imgs/kawaikara_banner2.png';
import { selectLocalizedReleaseNotes } from '../../../Common/ReleaseNotes';
import { UpdatePanelProps } from './Types';
import { UpdateActions } from './UpdateActions';
import { formatChannel } from './UpdatePresentation';
import { UpdateReleaseNotesView } from './UpdateReleaseNotesView';
import { UpdateStatusContent } from './UpdateStatusContent';

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
    <main className={`update-shell is-${state.origin}`} onDragStart={event => event.preventDefault()}>
      <Panel className="update-panel update-status-panel" padding="none" radius="lg">
        <img
          alt=""
          className="update-kawaikara-image"
          draggable={false}
          src={kawaikaraImage}
        />
        <Stack className="update-status-body" align="center" gap="sm">
          <Badge dot tone={state.phase === 'error' ? 'neutral' : 'primary'}>
            {labels.channel}: {formatChannel(state.channel, labels)}
          </Badge>
          <Stack className="update-phase-slot" gap="none">
            <AnimatePresence initial={false}>
              <UpdateStatusContent key={state.phase} state={state} labels={labels} />
            </AnimatePresence>
          </Stack>
        </Stack>
        <Flex key={state.phase} className="update-status-footer" align="center" justify="end" gap="sm">
          <Flex className="update-release-notes-slot" align="center">
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
          </Flex>
          <Flex className="update-actions-slot" align="center" justify="end">
            <UpdateActions
              labels={labels}
              state={state}
              onDismiss={onDismiss}
              onDownload={onDownload}
              onInstall={onInstall}
              onRetry={onRetry}
            />
          </Flex>
        </Flex>
      </Panel>
    </main>
  );
}
