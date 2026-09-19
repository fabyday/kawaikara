import {
  useEffect
} from 'react';
import { type useVideoState } from './useVideoState';

/** Inputs used by useVideoPresentation. */
type VideoPresentationOptions = Pick<ReturnType<typeof useVideoState>,
  | 'source'
  | 'playerState'
>;

/** Coordinates video presentation behavior for this View. */
export function useVideoPresentation({
  source,
  playerState,
}: VideoPresentationOptions) {
  useEffect(() => {
    window.kawaikaraVideo.presentation.update({
      ready: Boolean(
        source &&
        playerState.width > 0 &&
        playerState.height > 0 &&
        !['Idle', 'Opening'].includes(playerState.status),
      ),
      width: playerState.width,
      height: playerState.height,
    });
  }, [playerState.height, playerState.status, playerState.width, source]);
}
