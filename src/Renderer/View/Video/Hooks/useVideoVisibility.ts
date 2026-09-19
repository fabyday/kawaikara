import {
  useEffect
} from 'react';
import { type useVideoChrome } from './useVideoChrome';
import { type useVideoState } from './useVideoState';

/** Inputs used by useVideoVisibility. */
type VideoVisibilityOptions = Pick<ReturnType<typeof useVideoState>,
  | 'viewVisibleRef'
  | 'playerStateRef'
  | 'sourceRef'
  | 'setControlsVisible'
  | 'setTitleVisible'
  | 'backendRef'
  | 'fallbackVideoRef'
  | 'playerRef'
> & Pick<ReturnType<typeof useVideoChrome>,
  | 'clearControlsHideTimer'
  | 'clearTitleHideTimer'
>;

/** Coordinates video visibility behavior for this View. */
export function useVideoVisibility({
  viewVisibleRef,
  playerStateRef,
  sourceRef,
  clearControlsHideTimer,
  clearTitleHideTimer,
  setControlsVisible,
  setTitleVisible,
  backendRef,
  fallbackVideoRef,
  playerRef,
}: VideoVisibilityOptions) {
  useEffect(() =>
    window.kawaikaraVideo.application.onVisibilityChanged((visible) => {
      viewVisibleRef.current = visible;
      if (visible) {
        const state = playerStateRef.current;
        window.kawaikaraVideo.presentation.update({
          ready: Boolean(
            sourceRef.current &&
            state.width > 0 &&
            state.height > 0 &&
            !['Idle', 'Opening'].includes(state.status),
          ),
          width: state.width,
          height: state.height,
        });
        return;
      }
      clearControlsHideTimer();
      clearTitleHideTimer();
      setControlsVisible(false);
      setTitleVisible(false);
      if (backendRef.current === 'chromium') {
        fallbackVideoRef.current?.pause();
        return;
      }
      void playerRef.current?.pause().catch((reason: unknown) => {
        console.warn('[video] Playback could not be paused while hidden.', reason);
      });
    }), [clearControlsHideTimer, clearTitleHideTimer]);
}
