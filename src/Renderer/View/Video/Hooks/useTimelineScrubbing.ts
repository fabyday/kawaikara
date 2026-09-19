import {
  useCallback,
  useEffect
} from 'react';
import { type usePlaybackControls } from './usePlaybackControls';
import { type useVideoChrome } from './useVideoChrome';
import { type useVideoState } from './useVideoState';

/** Inputs used by useTimelineScrubbing. */
type TimelineScrubbingOptions = Pick<ReturnType<typeof useVideoState>,
  | 'scrubbingRef'
  | 'scrubPointerIdRef'
  | 'scrubTargetRef'
  | 'lastScrubPreviewAtRef'
  | 'setScrubTime'
  | 'timelineRef'
  | 'playerStateRef'
> & Pick<ReturnType<typeof usePlaybackControls>,
  | 'seekTo'
> & Pick<ReturnType<typeof useVideoChrome>,
  | 'revealControls'
>;

/** Coordinates timeline scrubbing behavior for this View. */
export function useTimelineScrubbing({
  scrubbingRef,
  scrubPointerIdRef,
  scrubTargetRef,
  lastScrubPreviewAtRef,
  setScrubTime,
  seekTo,
  timelineRef,
  revealControls,
  playerStateRef,
}: TimelineScrubbingOptions) {
  const finishTimelineScrub = useCallback((pointerId?: number) => {
    if (!scrubbingRef.current) return;
    if (
      pointerId !== undefined &&
      scrubPointerIdRef.current !== undefined &&
      pointerId !== scrubPointerIdRef.current
    ) {
      return;
    }
    scrubbingRef.current = false;
    scrubPointerIdRef.current = undefined;
    const target = scrubTargetRef.current;
    scrubTargetRef.current = target;
    lastScrubPreviewAtRef.current = Number.NEGATIVE_INFINITY;
    setScrubTime(undefined);
    seekTo(target);
    timelineRef.current?.blur();
    revealControls();
  }, [revealControls, seekTo]);

  const cancelTimelineScrub = useCallback((pointerId?: number) => {
    if (!scrubbingRef.current) return;
    if (
      pointerId !== undefined &&
      scrubPointerIdRef.current !== undefined &&
      pointerId !== scrubPointerIdRef.current
    ) {
      return;
    }
    scrubbingRef.current = false;
    scrubPointerIdRef.current = undefined;
    scrubTargetRef.current = playerStateRef.current.time;
    lastScrubPreviewAtRef.current = Number.NEGATIVE_INFINITY;
    setScrubTime(undefined);
    timelineRef.current?.blur();
  }, []);

  useEffect(() => {
    /** Performs the finish pointer scrub operation. */
    const finishPointerScrub = (event: PointerEvent) => {
      finishTimelineScrub(event.pointerId);
    };
    /** Determines whether the cel pointer scrub condition applies. */
    const cancelPointerScrub = (event: PointerEvent) => {
      cancelTimelineScrub(event.pointerId);
    };
    window.addEventListener('pointerup', finishPointerScrub);
    window.addEventListener('pointercancel', cancelPointerScrub);
    return () => {
      window.removeEventListener('pointerup', finishPointerScrub);
      window.removeEventListener('pointercancel', cancelPointerScrub);
    };
  }, [cancelTimelineScrub, finishTimelineScrub]);

  return {
    /** The finishTimelineScrub value. */
    finishTimelineScrub,
    /** The cancelTimelineScrub value. */
    cancelTimelineScrub,
  };
}
