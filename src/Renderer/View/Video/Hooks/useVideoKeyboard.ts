import {
  useEffect
} from 'react';
import type {
  VideoMessages
} from '../../../../Common/IPC';
import {
  VIDEO_SHORTCUTS
} from '../../../../Common/VideoControls';
import { VIDEO_VOLUME_STEP } from '../Playback/PlayerDefaults';
import { isEditableTarget, matchVideoAccelerator, normalizeKey, runVideoShortcut } from '../Playback/VideoShortcuts';
import { getMpvErrorMessage } from '../Presentation';
import { type usePlaybackControls } from './usePlaybackControls';
import { type useVideoChrome } from './useVideoChrome';
import { type useVideoState } from './useVideoState';
import { type useVideoVolume } from './useVideoVolume';

/** Inputs used by useVideoKeyboard. */
type VideoKeyboardOptions = Pick<ReturnType<typeof useVideoState>,
  | 'pictureInPicture'
  | 'hlsPanelOpen'
  | 'downloaderOpen'
  | 'setDownloaderOpen'
  | 'sourcePanelOpen'
  | 'source'
  | 'setSourcePanelOpen'
  | 'lastBrowseDirectory'
  | 'setRequestedDirectory'
  | 'volumeRef'
  | 'preferences'
  | 'playerRef'
  | 'fallbackVideoRef'
  | 'backendRef'
  | 'playerStateRef'
  | 'setError'
> & Pick<ReturnType<typeof useVideoChrome>,
  | 'closeHlsPanel'
  | 'revealControls'
> & Pick<ReturnType<typeof usePlaybackControls>,
  | 'togglePlayback'
  | 'seekTo'
> & Pick<ReturnType<typeof useVideoVolume>,
  | 'updateVolume'
> & {
  /** The labels value for this section. */
  readonly labels: VideoMessages;
};

/** Coordinates video keyboard behavior for this View. */
export function useVideoKeyboard({
  pictureInPicture,
  hlsPanelOpen,
  closeHlsPanel,
  downloaderOpen,
  setDownloaderOpen,
  sourcePanelOpen,
  source,
  setSourcePanelOpen,
  lastBrowseDirectory,
  setRequestedDirectory,
  revealControls,
  togglePlayback,
  updateVolume,
  volumeRef,
  preferences,
  playerRef,
  fallbackVideoRef,
  backendRef,
  playerStateRef,
  seekTo,
  setError,
  labels,
}: VideoKeyboardOptions) {
  useEffect(() => {
    /** Handles the shortcut. */
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) {
          void (async () => {
            if (await window.kawaikaraVideo.application.isFullScreen()) {
              await window.kawaikaraVideo.application.exitFullScreen();
              return;
            }
            if (pictureInPicture) {
              await window.kawaikaraVideo.application.togglePictureInPicture();
              return;
            }
            if (hlsPanelOpen) {
              closeHlsPanel();
              return;
            }
            if (downloaderOpen) {
              setDownloaderOpen(false);
              return;
            }
            if (sourcePanelOpen && source) {
              setSourcePanelOpen(false);
              return;
            }
            if (source && lastBrowseDirectory) {
              setRequestedDirectory(lastBrowseDirectory);
              setSourcePanelOpen(true);
            }
          })();
        }
        return;
      }
      if (isEditableTarget(event.target)) return;
      if (event.isComposing && event.code !== 'Comma' && event.code !== 'Period') {
        return;
      }

      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        normalizeKey(event.key) === ' '
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) {
          revealControls();
          togglePlayback();
        }
        return;
      }

      const normalizedKey = normalizeKey(event.key);
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        (normalizedKey === 'up' || normalizedKey === 'down')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        revealControls();
        updateVolume(
          volumeRef.current +
          (normalizedKey === 'up' ? VIDEO_VOLUME_STEP : -VIDEO_VOLUME_STEP),
        );
        return;
      }

      for (const shortcut of VIDEO_SHORTCUTS) {
        const accelerator = preferences.shortcuts[shortcut.id] ?? shortcut.defaultKey;
        const match = matchVideoAccelerator(
          event,
          accelerator,
          shortcut.id === 'video.seek-backward' || shortcut.id === 'video.seek-forward',
        );
        if (!match.matched) continue;

        event.preventDefault();
        event.stopImmediatePropagation();
        revealControls();
        void runVideoShortcut(
          playerRef.current,
          fallbackVideoRef.current,
          backendRef.current,
          playerStateRef.current,
          shortcut.id,
          preferences.videoSeekSeconds * match.precision,
          seekTo,
        ).catch((reason: unknown) => setError(getMpvErrorMessage(reason, labels)));
        return;
      }
    };

    window.addEventListener('keydown', handleShortcut, true);
    return () => window.removeEventListener('keydown', handleShortcut, true);
  }, [
    closeHlsPanel,
    downloaderOpen,
    hlsPanelOpen,
    labels,
    lastBrowseDirectory,
    pictureInPicture,
    preferences,
    revealControls,
    seekTo,
    source,
    sourcePanelOpen,
    togglePlayback,
    updateVolume,
  ]);
}
