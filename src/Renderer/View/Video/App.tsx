import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type FormEvent,
} from 'react';
import Hls from 'hls.js';
import {
  defineMpvVideoElement,
  type MpvVideoElement,
  type MpvVideoState,
} from 'electron-mpv-video/renderer';
import { Button, Input, KawaiProvider } from '@kawaikara/kawai-ui';
import type {
  PreferenceState,
  RendererMessages,
  VideoMessages,
  VideoOpenRequest,
} from '../../../Common/IPC';
import {
  DEFAULT_VIDEO_SEEK_SECONDS,
  VIDEO_SHORTCUTS,
  type VideoShortcutId,
} from '../../../Common/VideoControls';
import { YouTubeDownloaderPanel } from './YouTubeDownloaderPanel';
import { VideoBrowser } from './VideoBrowser';

const DEFAULT_FRAME_RATE = 30;
const VIDEO_VOLUME_STEP = 5;
const VIDEO_SCRUB_PREVIEW_INTERVAL_MS = 100;
const VIDEO_LONG_SCRUB_PREVIEW_INTERVAL_MS = 180;
const VIDEO_LONG_DURATION_SECONDS = 2 * 60 * 60;

interface PlayerSource {
  readonly nativeValue: string;
  readonly chromiumValue: string;
  readonly label: string;
  readonly kind: 'local' | 'hls';
}

interface ChromiumSourceHandle {
  readonly hls: Hls | null;
  readonly ready: Promise<void>;
}

interface PendingMpvSeek {
  readonly reportError: boolean;
  readonly seconds: number;
}

type PlaybackBackend = 'detecting' | 'libmpv' | 'chromium';
type FallbackReason = 'intel-mac' | 'unavailable' | 'native-error';

const MPV_INITIALIZATION_TIMEOUT_MS = 8_000;
type VideoPreferences = Pick<
  PreferenceState,
  | 'appTheme'
  | 'shortcuts'
  | 'videoControlsLayout'
  | 'videoOverlayHideSeconds'
  | 'videoSeekSeconds'
  | 'videoVolume'
>;

const INITIAL_PLAYER_STATE: MpvVideoState = {
  playerId: '',
  status: 'Idle',
  renderMode: 'webgl',
  rendererName: '-',
  time: 0,
  duration: 0,
  width: 0,
  height: 0,
  codec: '-',
  fps: 0,
};

defineMpvVideoElement();

export function VideoView() {
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<MpvVideoElement | null>(null);
  const fallbackVideoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const fallbackFrameSamplesRef = useRef<number[]>([]);
  const rendererLogSignatureRef = useRef('');
  const playerStateRef = useRef<MpvVideoState>(INITIAL_PLAYER_STATE);
  const backendRef = useRef<PlaybackBackend>('detecting');
  const sourceRef = useRef<PlayerSource | undefined>(undefined);
  const viewVisibleRef = useRef(true);
  const controlsHideTimerRef = useRef<number | undefined>(undefined);
  const titleHideTimerRef = useRef<number | undefined>(undefined);
  const timelineRef = useRef<HTMLInputElement>(null);
  const scrubbingRef = useRef(false);
  const scrubPointerIdRef = useRef<number | undefined>(undefined);
  const scrubTargetRef = useRef(0);
  const lastScrubPreviewAtRef = useRef(Number.NEGATIVE_INFINITY);
  const volumeRef = useRef(100);
  const pendingVolumePersistRef = useRef<number | undefined>(undefined);
  const volumePersistTimerRef = useRef<number | undefined>(undefined);
  const openGenerationRef = useRef(0);
  const mpvSeekInFlightRef = useRef(false);
  const pendingMpvSeekRef = useRef<PendingMpvSeek | undefined>(undefined);
  const labelsRef = useRef<VideoMessages | undefined>(undefined);
  const revealControlsRef = useRef<() => void>(() => undefined);
  const [backend, setBackend] = useState<PlaybackBackend>('detecting');
  const [fallbackReason, setFallbackReason] = useState<FallbackReason>();
  const [hardwareAccelerationDisabled, setHardwareAccelerationDisabled] =
    useState(false);
  const [playerState, setPlayerState] = useState(INITIAL_PLAYER_STATE);
  const [source, setSource] = useState<PlayerSource>();
  const [sourceRevision, setSourceRevision] = useState(0);
  const [hlsUrl, setHlsUrl] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [sourcePanelOpen, setSourcePanelOpen] = useState(true);
  const [initialRequestResolved, setInitialRequestResolved] = useState(false);
  const [requestedDirectory, setRequestedDirectory] = useState<string>();
  const [lastBrowseDirectory, setLastBrowseDirectory] = useState<string>();
  const [fullScreen, setFullScreen] = useState(false);
  const [pictureInPicture, setPictureInPicture] = useState(false);
  const [hlsPanelOpen, setHlsPanelOpen] = useState(false);
  const [downloaderOpen, setDownloaderOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [titleVisible, setTitleVisible] = useState(false);
  const [scrubTime, setScrubTime] = useState<number>();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [volume, setVolume] = useState(100);
  const [localization, setLocalization] = useState<RendererMessages>();
  const [preferences, setPreferences] = useState<VideoPreferences>({
    appTheme: 'dark',
    shortcuts: {},
    videoControlsLayout: 'inline',
    videoOverlayHideSeconds: 1.8,
    videoSeekSeconds: DEFAULT_VIDEO_SEEK_SECONDS,
    videoVolume: 100,
  });

  const labels = localization?.video as VideoMessages;
  if (labels) labelsRef.current = labels;
  const isPlaying = playerState.status === 'Playing';
  const hasTimeline = Number.isFinite(playerState.duration) && playerState.duration > 0;
  const displayedTime = scrubTime ?? playerState.time;
  const timelineProgress = hasTimeline
    ? Math.min(100, Math.max(0, (displayedTime / playerState.duration) * 100))
    : 0;

  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  useEffect(() => {
    if (localization) document.documentElement.lang = localization.locale;
  }, [localization]);

  useEffect(() => {
    backendRef.current = backend;
  }, [backend]);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  const clearControlsHideTimer = useCallback(() => {
    if (controlsHideTimerRef.current === undefined) return;
    window.clearTimeout(controlsHideTimerRef.current);
    controlsHideTimerRef.current = undefined;
  }, []);

  const revealControls = useCallback(() => {
    clearControlsHideTimer();
    setControlsVisible(true);
    if (!sourceRef.current) return;
    controlsHideTimerRef.current = window.setTimeout(() => {
      controlsHideTimerRef.current = undefined;
      if (scrubbingRef.current) return;
      setControlsVisible(false);
    }, preferences.videoOverlayHideSeconds * 1_000);
  }, [clearControlsHideTimer, preferences.videoOverlayHideSeconds]);
  revealControlsRef.current = revealControls;

  const clearTitleHideTimer = useCallback(() => {
    if (titleHideTimerRef.current === undefined) return;
    window.clearTimeout(titleHideTimerRef.current);
    titleHideTimerRef.current = undefined;
  }, []);

  const revealTitle = useCallback(() => {
    clearTitleHideTimer();
    setTitleVisible(true);
    if (!sourceRef.current) return;
    titleHideTimerRef.current = window.setTimeout(() => {
      titleHideTimerRef.current = undefined;
      setTitleVisible(false);
    }, preferences.videoOverlayHideSeconds * 1_000);
  }, [clearTitleHideTimer, preferences.videoOverlayHideSeconds]);

  const hideTitle = useCallback(() => {
    clearTitleHideTimer();
    setTitleVisible(false);
  }, [clearTitleHideTimer]);

  const revealVideoChrome = useCallback(() => {
    revealTitle();
    revealControls();
  }, [revealControls, revealTitle]);

  useEffect(() => clearControlsHideTimer, [clearControlsHideTimer]);
  useEffect(() => clearTitleHideTimer, [clearTitleHideTimer]);

  useEffect(() => {
    if (!localization) return;
    let active = true;
    const removeListener = window.kawaikaraVideo.application.onFullScreenChanged(
      (next) => setFullScreen(next),
    );
    void window.kawaikaraVideo.application.isFullScreen().then((next) => {
      if (active) setFullScreen(next);
    });
    return () => {
      active = false;
      removeListener();
    };
  }, []);

  useEffect(() =>
    window.kawaikaraVideo.application.onPictureInPictureChanged(
      setPictureInPicture,
    ), []);

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

  useEffect(() => {
    let active = true;
    void window.kawaikaraVideo.source
      .getPlaybackCapabilities()
      .then((capabilities) => {
        if (!active) return;
        console.info(
          `[video] Backend selection: ${capabilities.nativeBackendAvailable ? 'libmpv' : 'chromium'} ` +
            `(${capabilities.platform}-${capabilities.arch}); forcedSoftware=${String(capabilities.hardwareAccelerationDisabled)}.`,
        );
        setHardwareAccelerationDisabled(capabilities.hardwareAccelerationDisabled);
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
    const host = playerHostRef.current;
    if (!host || backend !== 'libmpv') return;

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
    player.setAttribute('render-mode', 'shared-texture');
    player.setAttribute('volume', String(volume));
    const handleState = (event: Event) => {
      const next = (event as CustomEvent<MpvVideoState>).detail;
      const statusChanged = next.status !== playerStateRef.current.status;
      const rendererSignature = `${next.renderMode}:${next.rendererName}`;
      if (next.status === 'Ready') {
        window.clearTimeout(initializationTimer);
        setError(undefined);
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
      setPlayerState(next);
      if (statusChanged && next.status === 'Playing') revealControlsRef.current();
      else if (
        statusChanged &&
        (next.status === 'Paused' || next.status === 'Ended')
      ) {
        revealControlsRef.current();
      }
    };
    const handleError = (event: Event) => {
      setLoading(false);
      const reason = (event as CustomEvent<unknown>).detail;
      if (/WebGPU is not available/i.test(String(reason))) {
        console.warn('[video] WebGPU is unavailable; libmpv is using WebGL.', reason);
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
      ++openGenerationRef.current;
      player.removeEventListener('mpv-state', handleState);
      player.removeEventListener('mpv-error', handleError);
      playerRef.current = null;
      host.replaceChildren();
      void player.destroy().catch(() => undefined);
    };
  }, [backend]);

  useEffect(() => {
    if (backend === 'detecting' || !source) return;
    const generation = ++openGenerationRef.current;
    pendingMpvSeekRef.current = undefined;
    scrubbingRef.current = false;
    scrubPointerIdRef.current = undefined;
    setScrubTime(undefined);
    setError(undefined);
    setLoading(true);
    setPlayerState((current) => ({
      ...current,
      status: 'Opening',
      time: 0,
      duration: 0,
      width: 0,
      height: 0,
      codec: '-',
      fps: 0,
    }));

    const open = async () => {
      if (backend === 'libmpv') {
        const player = playerRef.current;
        if (!player) return;
        await player.open(source.nativeValue);
        if (viewVisibleRef.current) {
          await player.play();
          if (!viewVisibleRef.current) await player.pause();
        } else {
          await player.pause();
        }
      } else {
        const video = fallbackVideoRef.current;
        if (!video) return;
        hlsRef.current?.destroy();
        hlsRef.current = null;
        const chromiumSource = openChromiumSource(
          video,
          source,
          volume,
          (reason) => {
            console.error('[video] Fatal HLS fallback error.', reason);
            setLoading(false);
            const currentLabels = labelsRef.current;
            setError(
              currentLabels
                ? getChromiumErrorMessage(reason, currentLabels)
                : getErrorText(reason),
            );
            setSourcePanelOpen(true);
          },
        );
        hlsRef.current = chromiumSource.hls;
        await chromiumSource.ready;
        if (viewVisibleRef.current) {
          await video.play();
          if (!viewVisibleRef.current) video.pause();
        } else {
          video.pause();
        }
      }
      if (openGenerationRef.current !== generation) return;
      setLoading(false);
      setSourcePanelOpen(false);
      revealControlsRef.current();
    };

    void open().catch((reason: unknown) => {
      if (openGenerationRef.current !== generation) return;
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
          ? backend === 'chromium'
            ? getChromiumErrorMessage(reason, currentLabels)
            : getMpvErrorMessage(reason, currentLabels)
          : getErrorText(reason),
      );
      setSourcePanelOpen(true);
    });

    return () => {
      ++openGenerationRef.current;
      if (backend === 'chromium') {
        hlsRef.current?.destroy();
        hlsRef.current = null;
      }
    };
  }, [backend, source, sourceRevision]);

  useEffect(() => {
    const video = fallbackVideoRef.current;
    if (!video || backend !== 'chromium') return;

    const updateMetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      setPlayerState((current) => ({
        ...current,
        playerId: 'chromium-fallback',
        status: video.paused ? 'Paused' : 'Playing',
        renderMode: 'webgl',
        rendererName: 'Chromium',
        duration,
        width: video.videoWidth,
        height: video.videoHeight,
      }));
    };
    const updateTime = () => {
      setPlayerState((current) => ({ ...current, time: video.currentTime || 0 }));
    };
    const handlePlay = () => {
      setLoading(false);
      setPlayerState((current) => ({ ...current, status: 'Playing' }));
      revealControlsRef.current();
    };
    const handlePause = () => {
      if (video.ended) return;
      setPlayerState((current) => ({ ...current, status: 'Paused' }));
      revealControlsRef.current();
    };
    const handleEnded = () => {
      setPlayerState((current) => ({
        ...current,
        status: 'Ended',
        time: Number.isFinite(video.duration) ? video.duration : current.time,
      }));
      revealControlsRef.current();
    };
    const handleError = () => {
      if (!video.currentSrc || !sourceRef.current) return;
      console.error('[video] Chromium media element error.', video.error);
      setLoading(false);
      setSourcePanelOpen(true);
      const currentLabels = labelsRef.current;
      const reason = video.error?.message || `Media error ${video.error?.code ?? ''}`;
      setError(
        currentLabels ? getChromiumErrorMessage(reason, currentLabels) : reason,
      );
    };

    video.addEventListener('loadedmetadata', updateMetadata);
    video.addEventListener('durationchange', updateMetadata);
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('seeked', updateTime);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    return () => {
      video.removeEventListener('loadedmetadata', updateMetadata);
      video.removeEventListener('durationchange', updateMetadata);
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('seeked', updateTime);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [backend]);

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
            setPlayerState((current) => ({ ...current, fps }));
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
  }, [backend, source]);

  const applyOpenRequest = useCallback((
    request: VideoOpenRequest,
    forcePlaybackReload = false,
  ) => {
    if (request.kind === 'youtube') {
      setYoutubeUrl(request.url);
      setDownloaderOpen(true);
      setSourcePanelOpen(false);
      return;
    }
    if (request.kind === 'folder') {
      setDownloaderOpen(false);
      setRequestedDirectory(request.path);
      setLastBrowseDirectory(request.path);
      setSourcePanelOpen(true);
      return;
    }
    setDownloaderOpen(false);
    setHlsPanelOpen(false);
    setSourcePanelOpen(false);
    setError(undefined);
    setLastBrowseDirectory(request.directory);
    const nextSource: PlayerSource = {
      kind: 'local',
      label: request.displayName,
      nativeValue: request.path,
      chromiumValue: request.url,
    };
    setSource((current) =>
      isSamePlayerSource(current, nextSource) ? current : nextSource,
    );
    if (forcePlaybackReload) {
      setSourceRevision((current) => current + 1);
    }
  }, []);

  const openLocalRequest = useCallback(async (
    request: Extract<VideoOpenRequest, { readonly kind: 'local' }>,
    directory: string,
  ) => {
    try {
      const activated = await window.kawaikaraVideo.source.activateLocalFile(
        request.path,
      );
      setLastBrowseDirectory(directory || activated.directory);
      applyOpenRequest(activated, true);
    } catch (reason) {
      console.error('[video] Failed to activate the selected local video.', reason);
      setLoading(false);
      setSourcePanelOpen(true);
      const currentLabels = labelsRef.current;
      setError(
        currentLabels
          ? getMpvErrorMessage(reason, currentLabels)
          : getErrorText(reason),
      );
    }
  }, [applyOpenRequest]);

  const localizationReady = Boolean(localization);
  useEffect(() => {
    if (!localizationReady) return;
    let active = true;
    const unsubscribe = window.kawaikaraVideo.source.onOpenRequest((request) => {
      if (active) {
        // Main only emits this event for a new explicit open action. Reload an
        // identical path as well; source equality is used only to deduplicate
        // the initial getOpenRequest fallback.
        applyOpenRequest(request, true);
        setInitialRequestResolved(true);
      }
    });
    void window.kawaikaraVideo.source
      .getOpenRequest()
      .then((request) => {
        if (!active) return;
        if (request) applyOpenRequest(request);
        setInitialRequestResolved(true);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        console.error('[video] Failed to read the queued open request.', reason);
        const currentLabels = labelsRef.current;
        setError(
          currentLabels
            ? getMpvErrorMessage(reason, currentLabels)
            : getErrorText(reason),
        );
        setInitialRequestResolved(true);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyOpenRequest, localizationReady]);

  useEffect(() => {
    let active = true;
    const refreshPreferences = () => {
      void Promise.all([
        window.kawaikaraVideo.preferences.get(),
        window.kawaikaraVideo.application.getMessages(),
      ])
        .then(([next, nextLocalization]) => {
          if (!active) return;
          const nextPreferences = {
            appTheme: next.appTheme,
            shortcuts: next.shortcuts,
            videoControlsLayout: next.videoControlsLayout,
            videoOverlayHideSeconds: next.videoOverlayHideSeconds,
            videoSeekSeconds: next.videoSeekSeconds,
            videoVolume:
              pendingVolumePersistRef.current === undefined
                ? next.videoVolume
                : volumeRef.current,
          };
          setPreferences((current) =>
            areVideoPreferencesEqual(current, nextPreferences)
              ? current
              : nextPreferences,
          );
          setLocalization((current) =>
            current?.locale === nextLocalization.locale ? current : nextLocalization,
          );
        })
        .catch(() => undefined);
    };
    refreshPreferences();
    window.addEventListener('focus', refreshPreferences);
    document.addEventListener('visibilitychange', refreshPreferences);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshPreferences);
      document.removeEventListener('visibilitychange', refreshPreferences);
    };
  }, []);

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

  const queueMpvSeek = useCallback((request: PendingMpvSeek) => {
    pendingMpvSeekRef.current = request;
    if (mpvSeekInFlightRef.current) return;
    mpvSeekInFlightRef.current = true;

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
    if (!sourceRef.current) return;
    if (backendRef.current === 'chromium') {
      const video = fallbackVideoRef.current;
      if (!video) return;
      if (!video.paused && !video.ended) {
        video.pause();
        return;
      }
      if (video.ended) video.currentTime = 0;
      void video.play().catch((reason: unknown) =>
        setError(getChromiumErrorMessage(reason, labels)),
      );
      return;
    }

    const player = playerRef.current;
    if (!player) return;
    if (state.status === 'Playing') {
      void player.pause().catch((reason: unknown) =>
        setError(getMpvErrorMessage(reason, labels)),
      );
      return;
    }
    const resume = state.status === 'Ended' ? player.seek(0) : Promise.resolve();
    void resume
      .then(() => player.play())
      .catch((reason: unknown) => setError(getMpvErrorMessage(reason, labels)));
  }, [labels]);

  const seekTo = useCallback((seconds: number, reportError = true) => {
    if (!Number.isFinite(seconds)) return;
    const state = playerStateRef.current;
    if (
      !sourceRef.current ||
      !Number.isFinite(state.duration) ||
      state.duration <= 0 ||
      state.status === 'Idle' ||
      state.status === 'Opening'
    ) {
      return;
    }
    const target = clampSeekableVideoTime(seconds, state.duration);
    playerStateRef.current = { ...state, time: target };
    setPlayerState((current) => ({ ...current, time: target }));
    if (backendRef.current === 'chromium') {
      const video = fallbackVideoRef.current;
      if (video) video.currentTime = target;
      return;
    }
    const player = playerRef.current;
    if (!player) return;
    queueMpvSeek({ reportError, seconds: target });
  }, [queueMpvSeek]);

  const previewTimelineScrub = useCallback((seconds: number) => {
    const now = performance.now();
    const interval = playerStateRef.current.duration >= VIDEO_LONG_DURATION_SECONDS
      ? VIDEO_LONG_SCRUB_PREVIEW_INTERVAL_MS
      : VIDEO_SCRUB_PREVIEW_INTERVAL_MS;
    if (now - lastScrubPreviewAtRef.current < interval) return;
    lastScrubPreviewAtRef.current = now;
    seekTo(seconds, false);
  }, [seekTo]);

  const flushVolumePersistence = useCallback(() => {
    if (volumePersistTimerRef.current !== undefined) {
      window.clearTimeout(volumePersistTimerRef.current);
      volumePersistTimerRef.current = undefined;
    }
    const pending = pendingVolumePersistRef.current;
    if (pending === undefined) return;
    void window.kawaikaraVideo.preferences
      .setVideoVolume(pending)
      .then((saved) => {
        if (pendingVolumePersistRef.current !== pending) return;
        pendingVolumePersistRef.current = undefined;
        if (saved === volumeRef.current) return;
        volumeRef.current = saved;
        setVolume(saved);
      })
      .catch((reason: unknown) => {
        console.warn('[video] The volume preference could not be saved.', reason);
      });
  }, []);

  const scheduleVolumePersistence = useCallback((next: number) => {
    pendingVolumePersistRef.current = next;
    if (volumePersistTimerRef.current !== undefined) {
      window.clearTimeout(volumePersistTimerRef.current);
    }
    volumePersistTimerRef.current = window.setTimeout(() => {
      volumePersistTimerRef.current = undefined;
      flushVolumePersistence();
    }, 240);
  }, [flushVolumePersistence]);

  const updateVolume = useCallback((next: number, persist = true) => {
    const normalized = Math.min(100, Math.max(0, next));
    volumeRef.current = normalized;
    setVolume(normalized);
    if (fallbackVideoRef.current) {
      fallbackVideoRef.current.volume = normalized / 100;
    }
    void playerRef.current?.setVolume(normalized).catch((reason: unknown) =>
      setError(getMpvErrorMessage(reason, labels)),
    );
    if (persist) scheduleVolumePersistence(normalized);
  }, [labels, scheduleVolumePersistence]);

  useEffect(() => {
    if (pendingVolumePersistRef.current !== undefined) return;
    updateVolume(preferences.videoVolume, false);
  }, [preferences.videoVolume, updateVolume]);

  useEffect(() => {
    const flushPendingVolume = () => flushVolumePersistence();
    window.addEventListener('pagehide', flushPendingVolume);
    return () => {
      window.removeEventListener('pagehide', flushPendingVolume);
      flushVolumePersistence();
    };
  }, [flushVolumePersistence]);

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
    const finishPointerScrub = (event: PointerEvent) => {
      finishTimelineScrub(event.pointerId);
    };
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

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) {
          void (async () => {
            if (await window.kawaikaraVideo.application.isFullScreen()) {
              await window.kawaikaraVideo.application.exitFullScreen();
              return;
            }
            if (pictureInPicture) {
              await window.kawaikaraVideo.application.togglePictureInPicture();
              return;
            }
            if (hlsPanelOpen) {
              setHlsPanelOpen(false);
              return;
            }
            if (downloaderOpen) {
              setDownloaderOpen(false);
              return;
            }
            if (source && lastBrowseDirectory && !sourcePanelOpen) {
              setRequestedDirectory(lastBrowseDirectory);
              setSourcePanelOpen(true);
            }
          })();
        }
        return;
      }
      if (isEditableTarget(event.target)) return;
      if (event.isComposing && event.code !== 'Comma' && event.code !== 'Period') {
        return;
      }

      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        normalizeKey(event.key) === ' '
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) {
          revealControls();
          togglePlayback();
        }
        return;
      }

      const normalizedKey = normalizeKey(event.key);
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        (normalizedKey === 'up' || normalizedKey === 'down')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        revealControls();
        updateVolume(
          volumeRef.current +
            (normalizedKey === 'up' ? VIDEO_VOLUME_STEP : -VIDEO_VOLUME_STEP),
        );
        return;
      }

      for (const shortcut of VIDEO_SHORTCUTS) {
        const accelerator = preferences.shortcuts[shortcut.id] ?? shortcut.defaultKey;
        const match = matchVideoAccelerator(
          event,
          accelerator,
          shortcut.id === 'video.seek-backward' || shortcut.id === 'video.seek-forward',
        );
        if (!match.matched) continue;

        event.preventDefault();
        event.stopImmediatePropagation();
        revealControls();
        void runVideoShortcut(
          playerRef.current,
          fallbackVideoRef.current,
          backendRef.current,
          playerStateRef.current,
          shortcut.id,
          preferences.videoSeekSeconds * match.precision,
          seekTo,
        ).catch((reason: unknown) => setError(getMpvErrorMessage(reason, labels)));
        return;
      }
    };

    window.addEventListener('keydown', handleShortcut, true);
    return () => window.removeEventListener('keydown', handleShortcut, true);
  }, [
    downloaderOpen,
    hlsPanelOpen,
    labels,
    lastBrowseDirectory,
    pictureInPicture,
    preferences,
    revealControls,
    seekTo,
    source,
    sourcePanelOpen,
    togglePlayback,
    updateVolume,
  ]);

  const selectLocalFile = async (): Promise<VideoOpenRequest | null> => {
    try {
      return await window.kawaikaraVideo.source.selectLocalFile();
    } catch (reason) {
      console.error('[video] Local file selection failed.', reason);
      setError(getMpvErrorMessage(reason, labels));
      return null;
    }
  };

  const openHlsStream = (event?: FormEvent) => {
    event?.preventDefault();
    const value = hlsUrl.trim();
    if (!isHttpUrl(value)) {
      setError(labels.invalidHls);
      return;
    }
    setError(undefined);
    setHlsPanelOpen(false);
    setSource({
      kind: 'hls',
      label: getStreamLabel(value),
      nativeValue: value,
      chromiumValue: value,
    });
  };

  const controlsLayout =
    fullScreen || pictureInPicture || preferences.videoControlsLayout === 'overlay'
      ? 'overlay'
      : 'inline';
  const showTitle =
    !pictureInPicture &&
    (titleVisible || sourcePanelOpen || hlsPanelOpen || downloaderOpen || !source);
  const showControls =
    controlsLayout === 'inline' ||
    controlsVisible ||
    sourcePanelOpen ||
    hlsPanelOpen ||
    downloaderOpen ||
    !source;

  if (!localization) return null;

  return (
    <KawaiProvider>
      <main
        className={`kawai-theme video-shell ${
          preferences.appTheme === 'dark'
            ? 'kawai-theme-dark'
            : 'kawai-theme-light'
        }`}
        data-controls-visible={showControls ? 'true' : 'false'}
        data-controls-layout={controlsLayout}
        data-title-visible={showTitle ? 'true' : 'false'}
        data-has-source={source ? 'true' : 'false'}
        data-backend={backend}
        data-picture-in-picture={pictureInPicture ? 'true' : 'false'}
      >
        <div ref={playerHostRef} className="video-player-host" />
        <video ref={fallbackVideoRef} className="video-fallback-player" playsInline />
        {source ? (
          <div
            aria-hidden="true"
            className="video-interaction-surface"
            onPointerEnter={revealVideoChrome}
            onPointerLeave={hideTitle}
            onPointerMove={revealVideoChrome}
          />
        ) : null}

        {source && pictureInPicture ? (
          <div
            className="video-pip-overlay"
            onPointerMove={() => {
              hideTitle();
              revealControls();
            }}
            onPointerLeave={revealControls}
          >
            <div className="video-pip-drag-surface" aria-hidden="true" />
            <button
              className="video-pip-button video-pip-restore-button"
              type="button"
              tabIndex={-1}
              aria-label={localization.app.backToSites}
              title={localization.app.backToSites}
              onFocus={blurVideoControl}
              onPointerUp={(event) => event.currentTarget.blur()}
              onClick={() => {
                void window.kawaikaraVideo.application.togglePictureInPicture();
              }}
            >
              <RestoreWindowIcon />
            </button>
            <button
              className="video-pip-button video-pip-playback-button"
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
        ) : null}

        {source ? (
          <header
            className="video-header-overlay"
            onPointerEnter={revealVideoChrome}
            onPointerMove={revealVideoChrome}
          >
            <div className="video-header-copy">
              <h1 className="video-title">{source.label}</h1>
              <p className="video-metadata">
                {getMetadataLabel(playerState, hasTimeline, labels.live)} ·{' '}
                {backend === 'libmpv' ? 'libmpv' : labels.chromiumFallback}
              </p>
            </div>
            <div className="video-header-actions">
              <button
                className="video-source-toggle"
                type="button"
                tabIndex={-1}
                onFocus={blurVideoControl}
                onPointerUp={(event) => event.currentTarget.blur()}
                onClick={() => {
                  if (playerStateRef.current.status === 'Playing') togglePlayback();
                  setRequestedDirectory(lastBrowseDirectory);
                  setSourcePanelOpen(true);
                }}
              >
                {labels.openFolder}
              </button>
              <button
                className="video-source-toggle"
                type="button"
                tabIndex={-1}
                onFocus={blurVideoControl}
                onPointerUp={(event) => event.currentTarget.blur()}
                onClick={() => setHlsPanelOpen((open) => !open)}
              >
                HLS
              </button>
            </div>
          </header>
        ) : null}

        {loading ? <div className="video-loading" aria-label={labels.loading} /> : null}

        {error ? (
          <div className="video-error" role="alert">
            {error}
          </div>
        ) : null}

        {initialRequestResolved && sourcePanelOpen && !pictureInPicture ? (
          <VideoBrowser
            backendLabel={
              backend === 'libmpv'
                ? 'libmpv'
                : backend === 'chromium'
                  ? labels.chromiumFallback
                  : labels.detectingBackend
            }
            backendWarning={
              hardwareAccelerationDisabled
                ? labels.softwareRenderingWarning
                : backend === 'chromium'
                  ? fallbackReason === 'intel-mac'
                    ? labels.intelMacFallback
                    : fallbackReason === 'native-error'
                      ? labels.nativeErrorFallback
                      : labels.nativeUnavailableFallback
                  : undefined
            }
            canClose={Boolean(source)}
            initialDirectory={requestedDirectory}
            labels={localization.videoBrowser}
            theme={preferences.appTheme}
            onClose={() => setSourcePanelOpen(false)}
            onOpenHls={() => setHlsPanelOpen(true)}
            onOpenVideo={(request, directory) => {
              void openLocalRequest(request, directory);
            }}
            onSelectFile={selectLocalFile}
          />
        ) : null}

        {hlsPanelOpen && !pictureInPicture ? (
          <section className="video-hls-panel" aria-label={labels.hlsUrl}>
            <div className="video-hls-panel-heading">
              <div>
                <span>HLS</span>
                <h2>{labels.playHls}</h2>
              </div>
              <button type="button" onClick={() => setHlsPanelOpen(false)}>×</button>
            </div>
            <form className="video-hls-form" onSubmit={openHlsStream}>
              <Input
                label={labels.hlsUrl}
                placeholder="https://example.com/stream.m3u8"
                value={hlsUrl}
                onChange={(event) => setHlsUrl(event.target.value)}
              />
              <Button disabled={!hlsUrl.trim()} type="submit">
                {labels.playHls}
              </Button>
            </form>
          </section>
        ) : null}

        {downloaderOpen && !pictureInPicture ? (
          <div className="video-downloader-overlay">
            <YouTubeDownloaderPanel
              initialUrl={youtubeUrl}
              onClose={() => {
                setDownloaderOpen(false);
                if (!source) setSourcePanelOpen(true);
              }}
            />
          </div>
        ) : null}

        {source ? (
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
              className="video-playback-button"
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
              className="video-progress"
              type="range"
              tabIndex={-1}
              aria-label={labels.timeline}
              min={0}
              max={hasTimeline ? playerState.duration : 1}
              step="any"
              value={hasTimeline ? Math.min(displayedTime, playerState.duration) : 0}
              style={{
                '--video-range-progress': `${String(timelineProgress)}%`,
              } as CSSProperties}
              disabled={!hasTimeline}
              onFocus={blurVideoControl}
              onPointerDown={(event) => {
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
            <span className="video-time video-duration-value">
              {hasTimeline ? formatDuration(playerState.duration) : labels.live}
            </span>
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
        ) : null}
      </main>
    </KawaiProvider>
  );
}

async function runVideoShortcut(
  player: MpvVideoElement | null,
  fallbackVideo: HTMLVideoElement | null,
  backend: PlaybackBackend,
  state: MpvVideoState,
  shortcutId: VideoShortcutId,
  seekSeconds: number,
  seekTo: (seconds: number) => void,
): Promise<void> {
  if (backend === 'detecting') return;
  const direction =
    shortcutId === 'video.frame-backward' || shortcutId === 'video.seek-backward'
      ? -1
      : 1;
  const frameStep =
    shortcutId === 'video.frame-backward' || shortcutId === 'video.frame-forward';
  if (frameStep) {
    const fps = state.fps > 1 && state.fps < 240 ? state.fps : DEFAULT_FRAME_RATE;
    const distance = 1 / fps + 0.000_1;
    const target = clampVideoTime(state.time + direction * distance, state.duration);
    if (backend === 'chromium') {
      if (!fallbackVideo) return;
      fallbackVideo.pause();
    } else {
      if (!player) return;
      await player.pause();
    }
    seekTo(target);
    return;
  }
  const target = clampVideoTime(
    state.time + direction * seekSeconds,
    state.duration,
  );
  seekTo(target);
}

function openChromiumSource(
  video: HTMLVideoElement,
  source: PlayerSource,
  volume: number,
  onFatalError: (reason: unknown) => void,
): ChromiumSourceHandle {
  video.pause();
  video.removeAttribute('src');
  video.load();
  video.volume = Math.min(1, Math.max(0, volume / 100));

  if (
    source.kind !== 'hls' ||
    video.canPlayType('application/vnd.apple.mpegurl') !== ''
  ) {
    video.src = source.chromiumValue;
    video.load();
    return { hls: null, ready: Promise.resolve() };
  }

  if (!Hls.isSupported()) {
    return {
      hls: null,
      ready: Promise.reject(
        new Error('HLS playback is unavailable in this Chromium runtime.'),
      ),
    };
  }

  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: true,
  });
  let opening = true;
  const ready = new Promise<void>((resolve, reject) => {
    hls.once(Hls.Events.MANIFEST_PARSED, () => {
      opening = false;
      resolve();
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      const reason = new Error(
        `HLS ${data.type}: ${data.details || 'fatal playback error'}`,
      );
      if (opening) {
        opening = false;
        reject(reason);
      } else {
        onFatalError(reason);
      }
    });
  });
  hls.loadSource(source.chromiumValue);
  hls.attachMedia(video);
  return { hls, ready };
}

function clampVideoTime(value: number, duration: number): number {
  const maximum = Number.isFinite(duration) && duration > 0
    ? duration
    : Number.POSITIVE_INFINITY;
  return Math.min(maximum, Math.max(0, value));
}

function clampSeekableVideoTime(value: number, duration: number): number {
  const maximum = Math.max(0, duration - Math.min(0.05, duration / 2));
  return Math.min(maximum, Math.max(0, value));
}

function PlaybackIcon({ playing }: { readonly playing: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {playing ? (
        <>
          <rect x="6.5" y="5" width="3.5" height="14" rx="1" />
          <rect x="14" y="5" width="3.5" height="14" rx="1" />
        </>
      ) : (
        <path d="M8 5.8v12.4c0 .8.9 1.3 1.6.9l9.1-6.2a1.05 1.05 0 0 0 0-1.8L9.6 4.9A1.04 1.04 0 0 0 8 5.8Z" />
      )}
    </svg>
  );
}

function RestoreWindowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M9 5H5v14h14v-4" />
      <path d="M11 5h8v8" />
      <path d="m19 5-9 9" />
    </svg>
  );
}

function matchVideoAccelerator(
  event: KeyboardEvent,
  accelerator: string,
  allowPrecisionModifiers: boolean,
): { readonly matched: boolean; readonly precision: number } {
  const parts = accelerator
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const key = parts.pop();
  if (!key) return { matched: false, precision: 1 };

  const isMac = /mac/i.test(navigator.platform);
  let needsControl = false;
  let needsMeta = false;
  let needsAlt = false;
  let needsShift = false;
  for (const modifier of parts) {
    switch (modifier) {
      case 'commandorcontrol':
      case 'cmdorctrl':
        if (isMac) needsMeta = true;
        else needsControl = true;
        break;
      case 'command':
      case 'cmd':
      case 'super':
        needsMeta = true;
        break;
      case 'control':
      case 'ctrl':
        needsControl = true;
        break;
      case 'alt':
      case 'option':
        needsAlt = true;
        break;
      case 'shift':
        needsShift = true;
        break;
      default:
        return { matched: false, precision: 1 };
    }
  }

  const extraControl = allowPrecisionModifiers && event.ctrlKey && !needsControl;
  const extraAlt = allowPrecisionModifiers && event.altKey && !needsAlt;
  const modifiersMatch =
    event.metaKey === needsMeta &&
    event.shiftKey === needsShift &&
    (event.ctrlKey === needsControl || extraControl) &&
    (event.altKey === needsAlt || extraAlt);
  if (!modifiersMatch || normalizeKeyboardEventKey(event) !== normalizeKey(key)) {
    return { matched: false, precision: 1 };
  }
  return {
    matched: true,
    precision: (extraControl ? 0.5 : 1) * (extraAlt ? 0.25 : 1),
  };
}

function normalizeKeyboardEventKey(event: KeyboardEvent): string {
  if (event.code === 'Comma') return ',';
  if (event.code === 'Period') return '.';
  return normalizeKey(event.key);
}

function normalizeKey(key: string): string {
  const normalized = key.toLowerCase();
  const aliases: Record<string, string> = {
    arrowleft: 'left',
    arrowright: 'right',
    arrowup: 'up',
    arrowdown: 'down',
    comma: ',',
    period: '.',
    space: ' ',
    spacebar: ' ',
    return: 'enter',
    esc: 'escape',
  };
  return aliases[normalized] ?? normalized;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const editable = target.closest<HTMLElement>(
    'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="searchbox"], [role="combobox"]',
  );
  if (!editable) return false;
  return !(editable instanceof HTMLInputElement && editable.type === 'range');
}

function blurVideoControl(event: FocusEvent<HTMLElement>): void {
  event.currentTarget.blur();
}

function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '--:--';
  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minuteText = String(minutes).padStart(hours ? 2 : 1, '0');
  const secondText = String(seconds).padStart(2, '0');
  return hours
    ? `${String(hours)}:${minuteText}:${secondText}`
    : `${minuteText}:${secondText}`;
}

function getMetadataLabel(
  state: MpvVideoState,
  hasTimeline: boolean,
  liveLabel: string,
): string {
  const parts = [];
  if (state.codec && state.codec !== '-') parts.push(state.codec.toUpperCase());
  if (state.width > 0 && state.height > 0) parts.push(`${state.width}×${state.height}`);
  if (state.fps > 0) parts.push(`${state.fps.toFixed(2).replace(/\.00$/, '')} fps`);
  parts.push(hasTimeline ? formatDuration(state.duration) : liveLabel);
  return parts.join(' · ');
}

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function getStreamLabel(value: string): string {
  try {
    const url = new URL(value);
    const tail = url.pathname.split('/').filter(Boolean).pop();
    return tail ? `${url.hostname} · ${tail}` : url.hostname;
  } catch {
    return value;
  }
}

function isMpvRuntimeError(reason: unknown): boolean {
  const message = getErrorText(reason);
  return /mpv_addon|libmpv|native module|unsupported platform|sharedTexture API|module could not be found|was compiled against|specified module could not be found/i.test(
    message,
  );
}

function getChromiumErrorMessage(
  reason: unknown,
  labels: VideoMessages,
): string {
  const message = getErrorText(reason).trim();
  return message
    ? `${labels.chromiumPlaybackFailed} ${message}`
    : labels.chromiumPlaybackFailed;
}

function getMpvErrorMessage(reason: unknown, labels: VideoMessages): string {
  const message = getErrorText(reason);
  if (/mpv_addon|libmpv|dll|module could not be found|was compiled against/i.test(message)) {
    return labels.runtimeMissing;
  }
  return message.trim() ? `${labels.playbackFailed} ${message}` : labels.playbackFailed;
}

function getErrorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason ?? '');
}

function isSamePlayerSource(
  current: PlayerSource | undefined,
  next: PlayerSource,
): boolean {
  return Boolean(
    current &&
      current.kind === next.kind &&
      current.nativeValue === next.nativeValue &&
      current.chromiumValue === next.chromiumValue,
  );
}

function areVideoPreferencesEqual(
  current: VideoPreferences,
  next: VideoPreferences,
): boolean {
  return (
    current.appTheme === next.appTheme &&
    current.videoControlsLayout === next.videoControlsLayout &&
    current.videoOverlayHideSeconds === next.videoOverlayHideSeconds &&
    current.videoSeekSeconds === next.videoSeekSeconds &&
    current.videoVolume === next.videoVolume &&
    areShortcutRecordsEqual(current.shortcuts, next.shortcuts)
  );
}

function areShortcutRecordsEqual(
  current: VideoPreferences['shortcuts'],
  next: VideoPreferences['shortcuts'],
): boolean {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  return (
    currentKeys.length === nextKeys.length &&
    currentKeys.every((key) => current[key] === next[key])
  );
}
