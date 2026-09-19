import type {
  ApplicationUpdatePanelState
} from '../../../Common/IPC';
import { UpdatePanelLabels } from './Types';

/** Returns the progress value. */
export function getProgressValue(state: ApplicationUpdatePanelState): number | null {
  if (state.phase === 'preparing' || state.phase === 'installing') return null;
  if (state.phase === 'checking') return null;
  if (state.phase === 'downloading') return state.progress?.percent ?? 0;
  if (state.phase === 'downloaded' || state.phase === 'up-to-date') return 100;
  return 0;
}

/** Returns the phase copy. */
export function getPhaseCopy(
  state: ApplicationUpdatePanelState,
  labels: UpdatePanelLabels,
) {
  switch (state.phase) {
    case 'preparing':
      return {
        /** The verification title. */
        title: labels.preparingTitle,
        /** The verification description. */
        description: labels.preparingDescription,
      };
    case 'installing':
      return {
        /** The handoff title. */
        title: labels.installingTitle,
        /** The handoff description. */
        description: labels.automaticRestartDescription,
      };
    case 'checking':
      return {
        /** The title value. */
        title: labels.checkingTitle,
        /** The description value. */
        description: labels.checkingDescription,
      };
    case 'available':
      return {
        /** The title value. */
        title: labels.availableTitle,
        /** The description value. */
        description: labels.availableDescription,
      };
    case 'downloading':
      return {
        /** The title value. */
        title: labels.downloadingTitle,
        /** The description value. */
        description: labels.downloadingDescription,
      };
    case 'downloaded':
      return {
        /** The title value. */
        title: labels.downloadedTitle,
        /** The description value. */
        description: state.origin === 'automatic'
          ? labels.automaticRestartDescription
          : labels.downloadedDescription,
      };
    case 'up-to-date':
      return {
        /** The title value. */
        title: labels.currentTitle,
        /** The description value. */
        description: labels.currentDescription,
      };
    case 'unsupported':
      return {
        /** The title value. */
        title: labels.unsupportedTitle,
        /** The description value. */
        description: labels.unsupportedDescription,
      };
    case 'error':
      if (state.errorStage === 'install') {
        return {
          /** The title value. */
          title: labels.installErrorTitle,
          /** The description value. */
          description: state.errorCode === 'ERR_UPDATER_INVALID_SIGNATURE'
            ? labels.signatureErrorDescription
            : labels.installErrorDescription,
        };
      }
      if (state.errorStage === 'download') {
        return {
          /** The title value. */
          title: labels.downloadErrorTitle,
          /** The description value. */
          description: state.errorCode === 'ERR_UPDATER_INVALID_SIGNATURE'
            ? labels.signatureErrorDescription
            : labels.downloadErrorDescription,
        };
      }
      return {
        /** The title value. */
        title: labels.errorTitle,
        /** The description value. */
        description: labels.errorDescription,
      };
  }
}

/** Performs the version summary operation. */
export function versionSummary(
  state: ApplicationUpdatePanelState,
  labels: UpdatePanelLabels,
): string {
  const current = `${labels.currentVersion} ${state.currentVersion}`;
  return state.latestVersion && state.latestVersion !== state.currentVersion
    ? `${current} → ${labels.nextVersion} ${state.latestVersion}`
    : current;
}

/** Formats the channel. */
export function formatChannel(
  channel: ApplicationUpdatePanelState['channel'],
  labels: UpdatePanelLabels,
): string {
  return labels[channel];
}

/** Formats the progress. */
export function formatProgress(value: number): string {
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

/** Formats the bytes. */
export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 3);
  const amount = value / 1024 ** index;
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}
