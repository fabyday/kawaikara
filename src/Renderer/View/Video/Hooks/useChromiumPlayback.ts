import {
  useEffect
} from 'react';
import { readVideoSeekRange, sameSeekRange } from '../Playback/SeekRange';
import { getChromiumErrorMessage, getHlsPlaybackErrorMessage } from '../Presentation';
import { type usePlaybackState } from './usePlaybackState';
import { type useVideoState } from './useVideoState';

/** Inputs used by useChromiumPlayback. */
type ChromiumPlaybackOptions = Pick<ReturnType<typeof useVideoState>,
  | 'fallbackVideoRef'
  | 'backend'
  | 'sourceRef'
  | 'hlsRef'
  | 'setHlsSeekRange'
  | 'setLoading'
  | 'revealControlsRef'
  | 'setSourcePanelOpen'
  | 'labelsRef'
  | 'setError'
  | 'fallbackFrameSamplesRef'
  | 'source'
> & Pick<ReturnType<typeof usePlaybackState>,
  | 'updatePlayerState'
  | 'clearFailedSource'
>;

/** Coordinates chromium playback behavior for this View. */
export function useChromiumPlayback({
  fallbackVideoRef,
  backend,
  sourceRef,
  hlsRef,
  setHlsSeekRange,
  updatePlayerState,
  setLoading,
  revealControlsRef,
  setSourcePanelOpen,
  labelsRef,
  setError,
  clearFailedSource,
  fallbackFrameSamplesRef,
  source,
}: ChromiumPlaybackOptions) {
  useEffect(() => {
    const video = fallbackVideoRef.current;
    if (!video || backend !== 'chromium') return;

    /** Updates the hls seek range. */
    const updateHlsSeekRange = () => {
      const next = sourceRef.current?.kind === 'hls'
        ? readVideoSeekRange(video, hlsRef.current)
        : undefined;
      setHlsSeekRange((current) => sameSeekRange(current, next) ? current : next);
    };

    /** Updates the metadata. */
    const updateMetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      updatePlayerState((current) => ({
        ...current,
        playerId: 'chromium-fallback',
        status: video.paused ? 'Paused' : 'Playing',
        renderMode: 'webgl',
        rendererName: 'Chromium',
        duration,
        width: video.videoWidth,
        height: video.videoHeight,
      }));
      updateHlsSeekRange();
    };
    /** Updates the time. */
    const updateTime = () => {
      updatePlayerState((current) => ({
        ...current,
        time: video.currentTime || 0,
      }));
      updateHlsSeekRange();
    };
    /** Handles the play. */
    const handlePlay = () => {
      setLoading(false);
      updatePlayerState((current) => ({
        ...current, status: 'Playing'
      }));
      revealControlsRef.current();
    };
    /** Handles the pause. */
    const handlePause = () => {
      if (video.ended) return;
      updatePlayerState((current) => ({
        ...current, status: 'Paused'
      }));
      revealControlsRef.current();
    };
    /** Handles the ended. */
    const handleEnded = () => {
      updatePlayerState((current) => ({
        ...current,
        status: 'Ended',
        time: Number.isFinite(video.duration) ? video.duration : current.time,
      }));
      revealControlsRef.current();
    };
    /** Handles the error. */
    const handleError = () => {
      const failedSource = sourceRef.current;
      if (!video.currentSrc || !failedSource) return;
      console.error('[video] Chromium media element error.', video.error);
      setLoading(false);
      setSourcePanelOpen(true);
      const currentLabels = labelsRef.current;
      const reason = video.error?.message || `Media error ${video.error?.code ?? ''}`;
      setError(
        currentLabels
          ? failedSource.kind === 'hls'
            ? getHlsPlaybackErrorMessage(reason, currentLabels)
            : getChromiumErrorMessage(reason, currentLabels)
          : reason,
      );
      clearFailedSource(failedSource);
    };

    video.addEventListener('loadedmetadata', updateMetadata);
    video.addEventListener('durationchange', updateMetadata);
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('progress', updateHlsSeekRange);
    video.addEventListener('seeked', updateTime);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    return () => {
      video.removeEventListener('loadedmetadata', updateMetadata);
      video.removeEventListener('durationchange', updateMetadata);
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('progress', updateHlsSeekRange);
      video.removeEventListener('seeked', updateTime);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [backend, clearFailedSource, updatePlayerState]);

  useEffect(() => {
    const video = fallbackVideoRef.current;
    if (
      !video ||
      backend !== 'chromium' ||
      typeof video.requestVideoFrameCallback !== 'function'
    ) {
      fallbackFrameSamplesRef.current = [];
      return;
    }

    let active = true;
    let callbackId = 0;
    let previousMediaTime: number | undefined;
    /** Performs the observe frame operation. */
    const observeFrame: VideoFrameRequestCallback = (_now, metadata) => {
      if (!active) return;
      if (previousMediaTime !== undefined) {
        const delta = metadata.mediaTime - previousMediaTime;
        if (delta > 0 && delta < 1) {
          const samples = fallbackFrameSamplesRef.current;
          samples.push(1 / delta);
          if (samples.length >= 12) {
            const fps = samples.reduce((sum, value) => sum + value, 0) / samples.length;
            samples.length = 0;
            updatePlayerState((current) => ({
              ...current, fps
            }));
          }
        }
      }
      previousMediaTime = metadata.mediaTime;
      callbackId = video.requestVideoFrameCallback(observeFrame);
    };
    callbackId = video.requestVideoFrameCallback(observeFrame);
    return () => {
      active = false;
      video.cancelVideoFrameCallback(callbackId);
      fallbackFrameSamplesRef.current = [];
    };
  }, [backend, source, updatePlayerState]);
}
