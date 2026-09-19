import type {
  VideoMessages
} from '../../../Common/IPC';
import {
  PlaybackIcon,
  RestoreWindowIcon
} from '../../Component/VideoIcons';
import { type usePlaybackControls } from './Hooks/usePlaybackControls';
import { blurVideoControl } from './Presentation';

/** Inputs for the VideoPictureInPicture section. */
type VideoPictureInPictureProps = Pick<ReturnType<typeof usePlaybackControls>,
  | 'togglePlayback'
> & {
  /** The isPlaying value for this section. */
  readonly isPlaying: boolean;
  /** The labels value for this section. */
  readonly labels: VideoMessages;
};

/** Renders the VideoPictureInPicture section of this View. */
export function VideoPictureInPicture({
  isPlaying,
  labels,
  togglePlayback,
}: VideoPictureInPictureProps) {
  return (
    <div
      className="video-pip-overlay"
    >
      <div className="video-pip-drag-surface" aria-hidden="true" />
      <button
        className="video-icon-button video-pip-button video-pip-restore-button"
        type="button"
        tabIndex={-1}
        aria-label={labels.returnToApp}
        title={labels.returnToApp}
        onFocus={blurVideoControl}
        onPointerUp={(event) => event.currentTarget.blur()}
        onClick={() => {
          void window.kawaikaraVideo.application.togglePictureInPicture();
        }}
      >
        <RestoreWindowIcon />
      </button>
      <button
        className="video-icon-button video-pip-button video-pip-playback-button"
        type="button"
        tabIndex={-1}
        aria-label={isPlaying ? labels.pause : labels.play}
        title={isPlaying ? labels.pause : labels.play}
        onFocus={blurVideoControl}
        onPointerUp={(event) => event.currentTarget.blur()}
        onClick={togglePlayback}
      >
        <PlaybackIcon playing={isPlaying} />
      </button>
    </div>
  );
}
