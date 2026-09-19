import {
  useEffect
} from 'react';
import { openChromiumSource } from '../Playback/ChromiumSource';
import { isMpvRuntimeError, monitorMpvSourceValidation } from '../Playback/MpvSource';
import { getChromiumErrorMessage, getErrorText, getHlsPlaybackErrorMessage, getMpvErrorMessage, isSamePlayerSource } from '../Presentation';
import { type usePlaybackState } from './usePlaybackState';
import { type useVideoState } from './useVideoState';

/** Inputs used by usePlaybackSource. */
type PlaybackSourceOptions = Pick<ReturnType<typeof useVideoState>,
  | 'backend'
  | 'source'
  | 'openGenerationRef'
  | 'sourceOpeningRef'
  | 'pendingMpvSeekRef'
  | 'scrubbingRef'
  | 'scrubPointerIdRef'
  | 'setScrubTime'
  | 'setHlsSeekRange'
  | 'setFollowingLive'
  | 'setError'
  | 'setLoading'
  | 'playerRef'
  | 'viewVisibleRef'
  | 'fallbackVideoRef'
  | 'hlsRef'
  | 'volume'
  | 'sourceRef'
  | 'labelsRef'
  | 'setSourcePanelOpen'
  | 'revealControlsRef'
  | 'setFallbackReason'
  | 'setBackend'
  | 'sourceRevision'
> & Pick<ReturnType<typeof usePlaybackState>,
  | 'clearMpvStateUiTimer'
  | 'updatePlayerState'
  | 'updatePlaybackStatus'
  | 'clearFailedSource'
> & {
  /** The localizationReady value for this section. */
  readonly localizationReady: boolean;
};

/** Coordinates playback source behavior for this View. */
export function usePlaybackSource({
  localizationReady,
  backend,
  source,
  openGenerationRef,
  sourceOpeningRef,
  pendingMpvSeekRef,
  scrubbingRef,
  scrubPointerIdRef,
  setScrubTime,
  setHlsSeekRange,
  setFollowingLive,
  setError,
  setLoading,
  clearMpvStateUiTimer,
  updatePlayerState,
  playerRef,
  viewVisibleRef,
  updatePlaybackStatus,
  fallbackVideoRef,
  hlsRef,
  volume,
  sourceRef,
  labelsRef,
  clearFailedSource,
  setSourcePanelOpen,
  revealControlsRef,
  setFallbackReason,
  setBackend,
  sourceRevision,
}: PlaybackSourceOptions) {
  useEffect(() => {
    const labels = labelsRef.current;
    if (!localizationReady || !labels || backend === 'detecting' || !source) return;
    const generation = ++openGenerationRef.current;
    /** Cancels validation when this source-opening effect is superseded. */
    let cancelSourceValidation: () => void = () => undefined;
    sourceOpeningRef.current = true;
    pendingMpvSeekRef.current = undefined;
    scrubbingRef.current = false;
    scrubPointerIdRef.current = undefined;
    setScrubTime(undefined);
    setHlsSeekRange(undefined);
    setFollowingLive(source.kind === 'hls');
    setError(undefined);
    setLoading(true);
    clearMpvStateUiTimer();
    updatePlayerState((current) => ({
      ...current,
      status: 'Opening',
      time: 0,
      duration: 0,
      width: 0,
      height: 0,
      codec: '-',
      fps: 0,
    }));

    /** Opens the operation. */
    const open = async () => {
      if (backend === 'libmpv') {
        const player = playerRef.current;
        if (!player) throw new Error(labels.mpvNotReady);
        // Force a real pause transition before replacing the source. libmpv
        // otherwise may retain pause=false and omit the Playing event for the
        // next file, leaving the button icon stuck on Play.
        await player.pause();
        const validation = monitorMpvSourceValidation(player, labels);
        cancelSourceValidation = validation.cancel;
        try {
          await player.open(source.nativeValue);
          await validation.ready;
        } finally {
          validation.cancel();
          cancelSourceValidation = () => undefined;
        }
        if (viewVisibleRef.current) {
          await player.play();
          updatePlaybackStatus('Playing');
          if (!viewVisibleRef.current) {
            await player.pause();
            updatePlaybackStatus('Paused');
          }
        } else {
          await player.pause();
          updatePlaybackStatus('Paused');
        }
      } else {
        const video = fallbackVideoRef.current;
        if (!video) throw new Error(labels.chromiumNotReady);
        hlsRef.current?.destroy();
        hlsRef.current = null;
        const chromiumSource = openChromiumSource(
          video,
          source,
          volume,
          (reason) => {
            if (
              openGenerationRef.current !== generation ||
              !isSamePlayerSource(sourceRef.current, source)
            ) {
              return;
            }
            console.error('[video] Fatal HLS fallback error.', reason);
            setLoading(false);
            const currentLabels = labelsRef.current;
            setError(
              currentLabels
                ? getHlsPlaybackErrorMessage(reason, currentLabels)
                : getErrorText(reason),
            );
            clearFailedSource(source);
            setSourcePanelOpen(true);
          },
          labels,
        );
        cancelSourceValidation = chromiumSource.cancel;
        hlsRef.current = chromiumSource.hls;
        await chromiumSource.ready;
        cancelSourceValidation = () => undefined;
        if (viewVisibleRef.current) {
          await video.play();
          updatePlaybackStatus('Playing');
          if (!viewVisibleRef.current) {
            video.pause();
            updatePlaybackStatus('Paused');
          }
        } else {
          video.pause();
          updatePlaybackStatus('Paused');
        }
      }
      if (openGenerationRef.current !== generation) return;
      sourceOpeningRef.current = false;
      setLoading(false);
      setSourcePanelOpen(false);
      revealControlsRef.current();
    };

    void open().catch((reason: unknown) => {
      if (openGenerationRef.current !== generation) return;
      sourceOpeningRef.current = false;
      if (backend === 'libmpv' && isMpvRuntimeError(reason)) {
        console.warn('[video] libmpv source open failed; using Chromium.', reason);
        setFallbackReason('native-error');
        setBackend('chromium');
        setError(undefined);
        return;
      }
      console.error(`[video] ${backend} source open failed.`, reason);
      setLoading(false);
      const currentLabels = labelsRef.current;
      setError(
        currentLabels
          ? source.kind === 'hls'
            ? getHlsPlaybackErrorMessage(reason, currentLabels)
            : backend === 'chromium'
              ? getChromiumErrorMessage(reason, currentLabels)
              : getMpvErrorMessage(reason, currentLabels)
          : getErrorText(reason),
      );
      clearFailedSource(source);
      setSourcePanelOpen(true);
    });

    return () => {
      ++openGenerationRef.current;
      sourceOpeningRef.current = false;
      cancelSourceValidation();
      if (backend === 'chromium') {
        hlsRef.current?.destroy();
        hlsRef.current = null;
      }
    };
  }, [
    backend,
    clearFailedSource,
    clearMpvStateUiTimer,
    localizationReady,
    source,
    sourceRevision,
    updatePlaybackStatus,
    updatePlayerState,
  ]);
}
