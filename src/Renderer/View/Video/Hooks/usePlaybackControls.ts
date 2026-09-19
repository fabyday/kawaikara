import {
  useCallback,
  useEffect
} from 'react';
import type {
  VideoMessages
} from '../../../../Common/IPC';
import { clampSeekableVideoTime, resolveVideoSeekRange } from '../Playback/SeekRange';
import { getChromiumErrorMessage, getMpvErrorMessage } from '../Presentation';
import { PendingMpvSeek } from '../Types';
import { type usePlaybackState } from './usePlaybackState';
import { type useVideoChrome } from './useVideoChrome';
import { type useVideoState } from './useVideoState';

/** Inputs used by usePlaybackControls. */
type PlaybackControlsOptions = Pick<ReturnType<typeof useVideoState>,
  | 'pendingMpvSeekRef'
  | 'mpvSeekInFlightRef'
  | 'playerRef'
  | 'setError'
  | 'playerStateRef'
  | 'sourceRef'
  | 'sourceOpeningRef'
  | 'backendRef'
  | 'fallbackVideoRef'
  | 'replayInFlightRef'
  | 'setLoading'
  | 'hlsRef'
  | 'setFollowingLive'
  | 'setSourceRevision'
> & Pick<ReturnType<typeof usePlaybackState>,
  | 'updatePlaybackStatus'
  | 'updatePlayerState'
> & Pick<ReturnType<typeof useVideoChrome>,
  | 'revealControls'
> & {
  /** The labels value for this section. */
  readonly labels: VideoMessages;
};

/** Coordinates playback controls behavior for this View. */
export function usePlaybackControls({
  pendingMpvSeekRef,
  mpvSeekInFlightRef,
  playerRef,
  setError,
  labels,
  playerStateRef,
  sourceRef,
  sourceOpeningRef,
  backendRef,
  fallbackVideoRef,
  updatePlaybackStatus,
  replayInFlightRef,
  setLoading,
  revealControls,
  hlsRef,
  setFollowingLive,
  updatePlayerState,
  setSourceRevision,
}: PlaybackControlsOptions) {
  const queueMpvSeek = useCallback((request: PendingMpvSeek) => {
    pendingMpvSeekRef.current = request;
    if (mpvSeekInFlightRef.current) return;
    mpvSeekInFlightRef.current = true;

    /** Performs the drain operation. */
    const drain = async () => {
      try {
        while (pendingMpvSeekRef.current) {
          const next = pendingMpvSeekRef.current;
          pendingMpvSeekRef.current = undefined;
          const player = playerRef.current;
          if (!player) return;
          try {
            await player.seek(next.seconds);
          } catch (reason) {
            if (pendingMpvSeekRef.current) continue;
            if (next.reportError) {
              setError(getMpvErrorMessage(reason, labels));
            } else {
              console.debug(
                '[video] Ignored an intermediate libmpv seek failure.',
                reason,
              );
            }
          }
        }
      } finally {
        mpvSeekInFlightRef.current = false;
      }
    };

    void drain();
  }, [labels]);

  const togglePlayback = useCallback(() => {
    const state = playerStateRef.current;
    const currentSource = sourceRef.current;
    if (!currentSource || sourceOpeningRef.current) return;
    if (backendRef.current === 'chromium') {
      const video = fallbackVideoRef.current;
      if (!video) return;
      if (!video.paused && !video.ended) {
        video.pause();
        updatePlaybackStatus('Paused');
        return;
      }
      if (
        video.ended ||
        (Number.isFinite(video.duration) &&
          video.duration > 0 &&
          video.currentTime >= video.duration - 0.05)
      ) {
        video.currentTime = 0;
      }
      void video.play()
        .then(() => updatePlaybackStatus('Playing'))
        .catch((reason: unknown) =>
          setError(getChromiumErrorMessage(reason, labels)),
        );
      return;
    }

    const player = playerRef.current;
    if (!player) return;
    if (state.status === 'Playing') {
      void player.pause()
        .then(() => updatePlaybackStatus('Paused'))
        .catch((reason: unknown) =>
          setError(getMpvErrorMessage(reason, labels)),
        );
      return;
    }
    const ended = state.status === 'Ended' || (
      state.status !== 'Playing' &&
      Number.isFinite(state.duration) &&
      state.duration > 0 &&
      state.time >= state.duration - 0.05
    );
    if (!ended) {
      void player.play()
        .then(() => updatePlaybackStatus('Playing'))
        .catch((reason: unknown) =>
          setError(getMpvErrorMessage(reason, labels)),
        );
      return;
    }
    if (replayInFlightRef.current) return;
    replayInFlightRef.current = true;
    setLoading(true);
    setError(undefined);
    // libmpv unloads the completed file by default, so a seek issued after
    // eof-reached can fail with MPV_ERROR_COMMAND (-12). Reopen the same
    // source to create a fresh playback timeline, then start it from zero.
    void player
      .open(currentSource.nativeValue)
      .then(() => player.play())
      .then(() => updatePlaybackStatus('Playing'))
      .then(() => setLoading(false))
      .catch((reason: unknown) => {
        setLoading(false);
        setError(getMpvErrorMessage(reason, labels));
      })
      .finally(() => {
        replayInFlightRef.current = false;
      });
  }, [labels, updatePlaybackStatus]);

  useEffect(() =>
    window.kawaikaraVideo.application.onPlaybackToggleRequested(() => {
      revealControls();
      togglePlayback();
    }), [revealControls, togglePlayback]);

  const seekTo = useCallback((
    seconds: number,
    reportError = true,
    followLive = false,
  ) => {
    if (!Number.isFinite(seconds)) return;
    const state = playerStateRef.current;
    const range = resolveVideoSeekRange(
      state.duration,
      sourceRef.current,
      backendRef.current,
      fallbackVideoRef.current,
      hlsRef.current,
    );
    if (
      !sourceRef.current ||
      !range ||
      state.status === 'Idle' ||
      state.status === 'Opening'
    ) {
      return;
    }
    const target = clampSeekableVideoTime(seconds, range);
    setFollowingLive(sourceRef.current.kind === 'hls' && followLive);
    playerStateRef.current = {
      ...state, time: target
    };
    updatePlayerState((current) => ({
      ...current, time: target
    }));
    if (backendRef.current === 'chromium') {
      const video = fallbackVideoRef.current;
      if (video) video.currentTime = target;
      return;
    }
    const player = playerRef.current;
    if (!player) return;
    queueMpvSeek({
      reportError, seconds: target
    });
  }, [queueMpvSeek, updatePlayerState]);

  const goToLiveEdge = useCallback(() => {
    if (sourceRef.current?.kind !== 'hls') return;
    setFollowingLive(true);
    if (backendRef.current === 'libmpv') {
      // electron-mpv-video exposes only absolute second seeking. For live HLS,
      // mpv's duration can be an accumulating timeline rather than its current
      // live edge, so reopening is the reliable way to join the latest segment.
      setLoading(true);
      setSourceRevision((current) => current + 1);
      revealControls();
      return;
    }
    const state = playerStateRef.current;
    const range = resolveVideoSeekRange(
      state.duration,
      sourceRef.current,
      backendRef.current,
      fallbackVideoRef.current,
      hlsRef.current,
    );
    if (!range) return;
    seekTo(range.end, true, true);
    revealControls();
  }, [revealControls, seekTo]);

  return {
    /** The togglePlayback value. */
    togglePlayback,
    /** The seekTo value. */
    seekTo,
    /** The goToLiveEdge value. */
    goToLiveEdge,
  };
}
