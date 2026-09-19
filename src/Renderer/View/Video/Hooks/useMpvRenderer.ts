import {
  type MpvVideoState
} from 'electron-mpv-video/renderer';
import {
  useEffect
} from 'react';
import { disableWebGpuForMpvSoftwareRenderer, isMpvRuntimeError } from '../Playback/MpvSource';
import { MPV_INITIALIZATION_TIMEOUT_MS, PLAYER_UI_UPDATE_INTERVAL_MS } from '../Playback/PlayerDefaults';
import { getErrorText, getMpvErrorMessage } from '../Presentation';
import { type usePlaybackState } from './usePlaybackState';
import { type useVideoState } from './useVideoState';

/** Inputs used by useMpvRenderer. */
type MpvRendererOptions = Pick<ReturnType<typeof useVideoState>,
  | 'setHardwareAccelerationDisabled'
  | 'setElectronGpuAccelerationEnabled'
  | 'setMpvRenderMode'
  | 'setBackend'
  | 'setFallbackReason'
  | 'backend'
  | 'playerHostRef'
  | 'setLoading'
  | 'setError'
  | 'mpvRenderMode'
  | 'volume'
  | 'sourceOpeningRef'
  | 'playerStateRef'
  | 'sourceRef'
  | 'rendererLogSignatureRef'
  | 'pendingMpvStateRef'
  | 'mpvStateUiTimerRef'
  | 'revealControlsRef'
  | 'labelsRef'
  | 'playerRef'
  | 'openGenerationRef'
> & Pick<ReturnType<typeof usePlaybackState>,
  | 'clearMpvStateUiTimer'
  | 'updatePlayerState'
> & {
  /** The localizationReady value for this section. */
  readonly localizationReady: boolean;
};

/** Coordinates mpv renderer behavior for this View. */
export function useMpvRenderer({
  setHardwareAccelerationDisabled,
  setElectronGpuAccelerationEnabled,
  setMpvRenderMode,
  setBackend,
  setFallbackReason,
  backend,
  playerHostRef,
  localizationReady,
  setLoading,
  setError,
  mpvRenderMode,
  volume,
  sourceOpeningRef,
  playerStateRef,
  sourceRef,
  rendererLogSignatureRef,
  pendingMpvStateRef,
  clearMpvStateUiTimer,
  updatePlayerState,
  mpvStateUiTimerRef,
  revealControlsRef,
  labelsRef,
  playerRef,
  openGenerationRef,
}: MpvRendererOptions) {
  useEffect(() => {
    let active = true;
    void window.kawaikaraVideo.source
      .getPlaybackCapabilities()
      .then((capabilities) => {
        if (!active) return;
        console.info(
          `[video] Backend selection: ${capabilities.nativeBackendAvailable ? 'libmpv' : 'chromium'} ` +
          `(${capabilities.platform}-${capabilities.arch}); ` +
          `electronGpu=${String(capabilities.electronGpuAccelerationEnabled)}; ` +
          `libmpvSoftwareDecode=${String(capabilities.hardwareAccelerationDisabled)}; ` +
          `nativeRenderMode=${capabilities.nativeRenderMode}.`,
        );
        setHardwareAccelerationDisabled(capabilities.hardwareAccelerationDisabled);
        setElectronGpuAccelerationEnabled(
          capabilities.electronGpuAccelerationEnabled,
        );
        if (capabilities.nativeRenderMode === 'software') {
          disableWebGpuForMpvSoftwareRenderer();
        }
        setMpvRenderMode(
          capabilities.electronGpuAccelerationEnabled &&
            capabilities.nativeRenderMode === 'shared-texture'
            ? 'shared-texture'
            : 'webgl',
        );
        if (capabilities.nativeBackendAvailable) {
          setBackend('libmpv');
          setFallbackReason(undefined);
          return;
        }
        setBackend('chromium');
        setFallbackReason(
          capabilities.platform === 'darwin' && capabilities.arch === 'x64'
            ? 'intel-mac'
            : 'unavailable',
        );
      })
      .catch((reason: unknown) => {
        if (!active) return;
        console.warn('[video] Playback capability detection failed; using Chromium.', reason);
        setBackend('chromium');
        setFallbackReason('unavailable');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (backend !== 'chromium') return;
    window.kawaikaraVideo.application.notifyPlaybackRendererReady();
  }, [backend]);

  useEffect(() => {
    const host = playerHostRef.current;
    if (!localizationReady || !host || backend !== 'libmpv') return;

    let active = true;
    const initializationTimer = window.setTimeout(() => {
      if (!active) return;
      console.warn(
        `[video] libmpv renderer did not become ready within ${String(MPV_INITIALIZATION_TIMEOUT_MS)}ms; requesting the software libmpv renderer.`,
      );
      void window.kawaikaraVideo.application
        .recoverPlaybackRenderer()
        .then((recovered) => {
          if (!active || recovered) return;
          setLoading(false);
          setFallbackReason('native-error');
          setError(undefined);
          setBackend('chromium');
        })
        .catch((reason: unknown) => {
          if (!active) return;
          console.warn(
            '[video] Software libmpv renderer recovery failed; using Chromium.',
            reason,
          );
          setLoading(false);
          setFallbackReason('native-error');
          setError(undefined);
          setBackend('chromium');
        });
    }, MPV_INITIALIZATION_TIMEOUT_MS);
    const player = document.createElement('mpv-video');
    player.className = 'video-player';
    player.setAttribute('render-mode', mpvRenderMode);
    player.setAttribute('volume', String(volume));
    /** Handles the state. */
    const handleState = (event: Event) => {
      const received = (event as CustomEvent<MpvVideoState>).detail;
      const normalizedReceived =
        received.status === 'Loaded' &&
          !sourceOpeningRef.current &&
          (playerStateRef.current.status === 'Playing' ||
            playerStateRef.current.status === 'Paused')
          ? {
            ...received, status: playerStateRef.current.status
          }
          : received;
      // libmpv reports eof-reached separately from time-pos, so its final
      // position commonly remains just short of duration. Chromium's ended
      // event already normalizes this value. Keep both backends consistent.
      const completedState =
        normalizedReceived.status === 'Ended' &&
          Number.isFinite(normalizedReceived.duration) &&
          normalizedReceived.duration > 0
          ? {
            ...normalizedReceived, time: normalizedReceived.duration
          }
          : normalizedReceived;
      // A failed source can still flush delayed pause/eof events after it has
      // been cleared. Those events must not revive controls for a dead source.
      const next = !sourceRef.current && completedState.status !== 'Ready'
        ? {
          ...completedState,
          status: 'Idle',
          time: 0,
          duration: 0,
          width: 0,
          height: 0,
          codec: '-',
          fps: 0,
        }
        : completedState;
      const previous = playerStateRef.current;
      const statusChanged = next.status !== previous.status;
      const presentationChanged =
        next.width !== previous.width ||
        next.height !== previous.height ||
        next.duration !== previous.duration ||
        next.codec !== previous.codec ||
        next.renderMode !== previous.renderMode ||
        next.rendererName !== previous.rendererName;
      const rendererSignature = `${next.renderMode}:${next.rendererName}`;
      if (next.status === 'Ready') {
        window.clearTimeout(initializationTimer);
        window.kawaikaraVideo.application.notifyPlaybackRendererReady();
        setError(undefined);
      }
      if (
        next.status === 'Ready' &&
        next.renderMode === 'canvas2d' &&
        mpvRenderMode !== 'canvas2d'
      ) {
        console.warn(
          '[video] Canvas 2D is too slow for libmpv playback; using Chromium instead.',
        );
        setLoading(false);
        setFallbackReason('native-error');
        setBackend('chromium');
        return;
      }
      if (
        next.status === 'Ready' &&
        rendererLogSignatureRef.current !== rendererSignature
      ) {
        rendererLogSignatureRef.current = rendererSignature;
        console.info(
          `[video] libmpv renderer ready: ${next.renderMode} (${next.rendererName}).`,
        );
      }
      playerStateRef.current = next;
      pendingMpvStateRef.current = next;
      if (statusChanged || presentationChanged) {
        clearMpvStateUiTimer();
        updatePlayerState(next);
      } else if (mpvStateUiTimerRef.current === undefined) {
        mpvStateUiTimerRef.current = window.setTimeout(() => {
          mpvStateUiTimerRef.current = undefined;
          const pending = pendingMpvStateRef.current;
          pendingMpvStateRef.current = undefined;
          if (pending) updatePlayerState(pending);
        }, PLAYER_UI_UPDATE_INTERVAL_MS);
      }
      if (statusChanged && next.status === 'Playing') revealControlsRef.current();
      else if (
        statusChanged &&
        (next.status === 'Paused' || next.status === 'Ended')
      ) {
        revealControlsRef.current();
      }
    };
    /** Handles the error. */
    const handleError = (event: Event) => {
      setLoading(false);
      const reason = (event as CustomEvent<unknown>).detail;
      if (
        /WebGL2 is not available|WebGPU is not available|No WebGPU adapter available|Failed to create WebGPU Context Provider/i.test(
          String(reason),
        )
      ) {
        console.warn('[video] libmpv renderer candidate is unavailable.', reason);
        return;
      }
      if (isMpvRuntimeError(reason)) {
        console.warn('[video] libmpv initialization failed; using Chromium.', reason);
        setFallbackReason('native-error');
        setBackend('chromium');
        setError(undefined);
        return;
      }
      console.error('[video] libmpv playback error.', reason);
      const currentLabels = labelsRef.current;
      setError(
        currentLabels
          ? getMpvErrorMessage(reason, currentLabels)
          : getErrorText(reason),
      );
    };
    player.addEventListener('mpv-state', handleState);
    player.addEventListener('mpv-error', handleError);
    host.replaceChildren(player);
    playerRef.current = player;

    return () => {
      active = false;
      window.clearTimeout(initializationTimer);
      clearMpvStateUiTimer();
      ++openGenerationRef.current;
      player.removeEventListener('mpv-state', handleState);
      player.removeEventListener('mpv-error', handleError);
      playerRef.current = null;
      host.replaceChildren();
      void player.destroy().catch(() => undefined);
    };
  }, [
    backend,
    clearMpvStateUiTimer,
    localizationReady,
    mpvRenderMode,
    updatePlayerState,
  ]);
}
