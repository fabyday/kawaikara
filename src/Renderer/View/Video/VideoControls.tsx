import {
  type CSSProperties
} from 'react';
import type {
  VideoMessages
} from '../../../Common/IPC';
import {
  PlaybackIcon
} from './VideoIcons';
import { type usePlaybackControls } from './Hooks/usePlaybackControls';
import { type useTimelineScrubbing } from './Hooks/useTimelineScrubbing';
import { type useVideoChrome } from './Hooks/useVideoChrome';
import { type useVideoState } from './Hooks/useVideoState';
import { type useVideoVolume } from './Hooks/useVideoVolume';
import { blurVideoControl, formatDuration } from './Presentation';
import { VideoSeekRange } from './Types';

/** Inputs for the VideoControls section. */
type VideoControlsProps = Pick<ReturnType<typeof useVideoChrome>,
  | 'hideTitle'
  | 'revealControls'
> & Pick<ReturnType<typeof usePlaybackControls>,
  | 'togglePlayback'
  | 'goToLiveEdge'
> & Pick<ReturnType<typeof useVideoState>,
  | 'timelineRef'
  | 'followingLive'
  | 'setFollowingLive'
  | 'scrubbingRef'
  | 'scrubPointerIdRef'
  | 'scrubTargetRef'
  | 'lastScrubPreviewAtRef'
  | 'setScrubTime'
  | 'playerState'
  | 'volume'
> & Pick<ReturnType<typeof useTimelineScrubbing>,
  | 'finishTimelineScrub'
  | 'cancelTimelineScrub'
> & Pick<ReturnType<typeof useVideoVolume>,
  | 'flushVolumePersistence'
  | 'updateVolume'
> & {
  /** The labels value for this section. */
  readonly labels: VideoMessages;
  /** The isPlaying value for this section. */
  readonly isPlaying: boolean;
  /** The displayedTime value for this section. */
  readonly displayedTime: number;
  /** The isHls value for this section. */
  readonly isHls: boolean;
  /** The timelineRange value for this section. */
  readonly timelineRange: VideoSeekRange | undefined;
  /** The timelineProgress value for this section. */
  readonly timelineProgress: number;
  /** The hasTimeline value for this section. */
  readonly hasTimeline: boolean;
  /** The previewTimelineScrub value for this section. */
  readonly previewTimelineScrub: (seconds: number) => void;
  /** The behindLiveEdge value for this section. */
  readonly behindLiveEdge: boolean;
};

/** Renders the VideoControls section of this View. */
export function VideoControls({
  labels,
  hideTitle,
  revealControls,
  isPlaying,
  togglePlayback,
  displayedTime,
  timelineRef,
  isHls,
  timelineRange,
  followingLive,
  timelineProgress,
  hasTimeline,
  setFollowingLive,
  scrubbingRef,
  scrubPointerIdRef,
  scrubTargetRef,
  lastScrubPreviewAtRef,
  setScrubTime,
  finishTimelineScrub,
  cancelTimelineScrub,
  previewTimelineScrub,
  behindLiveEdge,
  goToLiveEdge,
  playerState,
  volume,
  flushVolumePersistence,
  updateVolume,
}: VideoControlsProps) {
  return (
    <div
      className="video-controls"
      aria-label={labels.controls}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
      onPointerEnter={() => {
        hideTitle();
        revealControls();
      }}
      onPointerMove={() => {
        hideTitle();
        revealControls();
      }}
      onPointerLeave={revealControls}
    >
      <button
        className="video-icon-button video-playback-button"
        type="button"
        tabIndex={-1}
        aria-label={isPlaying ? labels.pause : labels.play}
        onFocus={blurVideoControl}
        onPointerUp={(event) => event.currentTarget.blur()}
        onClick={togglePlayback}
      >
        <PlaybackIcon playing={isPlaying} />
      </button>
      <span className="video-time">{formatDuration(displayedTime)}</span>
      <input
        ref={timelineRef}
        className={`video-progress${isHls ? ' is-hls' : ''}`}
        type="range"
        tabIndex={-1}
        aria-label={labels.timeline}
        min={timelineRange?.start ?? 0}
        max={timelineRange?.end ?? 1}
        step="any"
        value={timelineRange
          ? isHls && followingLive
            ? timelineRange.end
            : Math.min(
              timelineRange.end,
              Math.max(timelineRange.start, displayedTime),
            )
          : isHls
            ? 1
            : 0}
        style={{
          '--video-range-progress': `${String(timelineProgress)}%`,
        } as CSSProperties}
        disabled={!hasTimeline}
        onFocus={blurVideoControl}
        onPointerDown={(event) => {
          if (isHls) setFollowingLive(false);
          scrubbingRef.current = true;
          scrubPointerIdRef.current = event.pointerId;
          scrubTargetRef.current = displayedTime;
          lastScrubPreviewAtRef.current = Number.NEGATIVE_INFINITY;
          setScrubTime(displayedTime);
          revealControls();
        }}
        onPointerUp={(event) => finishTimelineScrub(event.pointerId)}
        onPointerCancel={(event) => cancelTimelineScrub(event.pointerId)}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          scrubTargetRef.current = next;
          setScrubTime(next);
          previewTimelineScrub(next);
        }}
      />
      {isHls ? (
        <button
          aria-label={labels.goLive}
          className={`video-live-button${behindLiveEdge ? ' is-behind' : ''}`}
          disabled={!behindLiveEdge}
          tabIndex={-1}
          type="button"
          onFocus={blurVideoControl}
          onPointerUp={(event) => event.currentTarget.blur()}
          onClick={goToLiveEdge}
        >
          <span aria-hidden="true" className="video-live-dot" />
          {labels.live}
        </button>
      ) : (
        <span className="video-time video-duration-value">
          {hasTimeline ? formatDuration(playerState.duration) : labels.live}
        </span>
      )}
      <label className="video-volume-control">
        <span>{labels.volume}</span>
        <input
          type="range"
          tabIndex={-1}
          min={0}
          max={100}
          value={volume}
          style={{
            '--video-range-progress': `${String(volume)}%`,
          } as CSSProperties}
          onFocus={blurVideoControl}
          onPointerUp={(event) => {
            event.currentTarget.blur();
            flushVolumePersistence();
            revealControls();
          }}
          onPointerCancel={flushVolumePersistence}
          onChange={(event) => updateVolume(Number(event.target.value))}
        />
      </label>
    </div>
  );
}
