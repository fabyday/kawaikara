import {
  type MpvVideoState
} from 'electron-mpv-video/renderer';
import {
  useCallback,
  type SetStateAction
} from 'react';
import { isSamePlayerSource } from '../Presentation';
import { PlayerSource } from '../Types';
import { type useVideoState } from './useVideoState';

/** Inputs used by usePlaybackState. */
type PlaybackStateOptions = Pick<ReturnType<typeof useVideoState>,
  | 'setPlayerState'
  | 'playerStateRef'
  | 'mpvStateUiTimerRef'
  | 'pendingMpvStateRef'
  | 'sourceRef'
  | 'sourceOpeningRef'
  | 'setSource'
  | 'setHlsSeekRange'
  | 'setFollowingLive'
  | 'backendRef'
  | 'hlsRef'
  | 'fallbackVideoRef'
  | 'playerRef'
>;

/** Coordinates playback state behavior for this View. */
export function usePlaybackState({
  setPlayerState,
  playerStateRef,
  mpvStateUiTimerRef,
  pendingMpvStateRef,
  sourceRef,
  sourceOpeningRef,
  setSource,
  setHlsSeekRange,
  setFollowingLive,
  backendRef,
  hlsRef,
  fallbackVideoRef,
  playerRef,
}: PlaybackStateOptions) {
  const updatePlayerState = useCallback(
    (update: SetStateAction<MpvVideoState>) => {
      setPlayerState((current) => {
        const next = typeof update === 'function' ? update(current) : update;
        playerStateRef.current = next;
        return next;
      });
    },
    [],
  );

  const updatePlaybackStatus = useCallback((status: string) => {
    if (mpvStateUiTimerRef.current !== undefined) {
      window.clearTimeout(mpvStateUiTimerRef.current);
      mpvStateUiTimerRef.current = undefined;
    }
    pendingMpvStateRef.current = undefined;
    updatePlayerState((current) => current.status === status
      ? current
      : {
        ...current, status
      });
  }, [updatePlayerState]);

  const clearFailedSource = useCallback((failedSource: PlayerSource) => {
    if (!isSamePlayerSource(sourceRef.current, failedSource)) return;
    sourceOpeningRef.current = false;
    sourceRef.current = undefined;
    setSource(undefined);
    setHlsSeekRange(undefined);
    setFollowingLive(false);
    updatePlayerState((current) => ({
      ...current,
      status: 'Idle',
      time: 0,
      duration: 0,
      width: 0,
      height: 0,
      codec: '-',
      fps: 0,
    }));
    if (backendRef.current === 'chromium') {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      const video = fallbackVideoRef.current;
      video?.pause();
      video?.removeAttribute('src');
      video?.load();
      return;
    }
    void playerRef.current?.stop().catch((reason: unknown) => {
      console.warn('[video] Failed playback source could not be stopped.', reason);
    });
  }, [updatePlayerState]);

  const clearMpvStateUiTimer = useCallback(() => {
    if (mpvStateUiTimerRef.current !== undefined) {
      window.clearTimeout(mpvStateUiTimerRef.current);
    }
    mpvStateUiTimerRef.current = undefined;
    pendingMpvStateRef.current = undefined;
  }, []);

  return {
    /** The updatePlayerState value. */
    updatePlayerState,
    /** The updatePlaybackStatus value. */
    updatePlaybackStatus,
    /** The clearFailedSource value. */
    clearFailedSource,
    /** The clearMpvStateUiTimer value. */
    clearMpvStateUiTimer,
  };
}
