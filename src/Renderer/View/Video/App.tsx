import { KawaiProvider } from '@kawaikara/kawai-ui';
import {
  defineMpvVideoElement
} from 'electron-mpv-video/renderer';
import {
  useCallback,
  useEffect,
  type FormEvent
} from 'react';
import type {
  VideoMessages,
  VideoOpenRequest
} from '../../../Common/IPC';
import { installMpvSoftwareRenderSizeLimit } from '../../Domain/MpvVideoPerformance';
import { HlsSourcePanel } from './HlsSourcePanel';
import { useChromiumPlayback } from './Hooks/useChromiumPlayback';
import { useMpvRenderer } from './Hooks/useMpvRenderer';
import { usePlaybackControls } from './Hooks/usePlaybackControls';
import { usePlaybackSource } from './Hooks/usePlaybackSource';
import { usePlaybackState } from './Hooks/usePlaybackState';
import { useTimelineScrubbing } from './Hooks/useTimelineScrubbing';
import { useVideoChrome } from './Hooks/useVideoChrome';
import { useVideoKeyboard } from './Hooks/useVideoKeyboard';
import { useVideoPresentation } from './Hooks/useVideoPresentation';
import { useVideoRequests } from './Hooks/useVideoRequests';
import { useVideoState } from './Hooks/useVideoState';
import { useVideoVisibility } from './Hooks/useVideoVisibility';
import { useVideoVolume } from './Hooks/useVideoVolume';
import { VIDEO_LONG_DURATION_SECONDS, VIDEO_LONG_SCRUB_PREVIEW_INTERVAL_MS, VIDEO_SCRUB_PREVIEW_INTERVAL_MS } from './Playback/PlayerDefaults';
import { finiteSeekRange } from './Playback/SeekRange';
import { getMpvErrorMessage, getStreamLabel, isHttpUrl } from './Presentation';
import { PlayerSource } from './Types';
import { VideoBrowser } from './VideoBrowser';
import { VideoControls } from './VideoControls';
import { VideoHeader } from './VideoHeader';
import { VideoPictureInPicture } from './VideoPictureInPicture';
import { YouTubeDownloaderPanel } from './YouTubeDownloaderPanel';

installMpvSoftwareRenderSizeLimit();
defineMpvVideoElement();

/** Performs the video view operation. */
export function VideoView() {

  const videoState = useVideoState();
  const {
    playerHostRef,
    fallbackVideoRef,
    playerStateRef,
    backendRef,
    sourceRef,
    lastScrubPreviewAtRef,
    labelsRef,
    backend,
    fallbackReason,
    hardwareAccelerationDisabled,
    electronGpuAccelerationEnabled,
    playerState,
    source,
    setSource,
    hlsUrl,
    error,
    setError,
    loading,
    sourcePanelOpen,
    setSourcePanelOpen,
    initialRequestResolved,
    requestedDirectory,
    fullScreen,
    pictureInPicture,
    pictureInPicturePointerInside,
    hlsPanelOpen,
    setHlsPanelOpen,
    downloaderOpen,
    setDownloaderOpen,
    controlsVisible,
    titleVisible,
    scrubTime,
    hlsSeekRange,
    followingLive,
    youtubeUrl,
    localization,
    preferences,
  } = videoState;

  const playbackState = usePlaybackState({
    ...videoState,
  });
  const {
    clearMpvStateUiTimer,
  } = playbackState;

  const labels = localization?.video as VideoMessages;
  if (labels) labelsRef.current = labels;
  const localizationReady = Boolean(localization);
  const isPlaying = playerState.status === 'Playing';
  const isHls = source?.kind === 'hls';
  const timelineRange = isHls
    ? hlsSeekRange ?? finiteSeekRange(playerState.duration)
    : finiteSeekRange(playerState.duration);
  const hasTimeline = timelineRange !== undefined;
  const displayedTime = scrubTime ?? playerState.time;
  const timelineProgress = isHls && followingLive
    ? 100
    : timelineRange
      ? Math.min(100, Math.max(
        0,
        ((displayedTime - timelineRange.start) /
          (timelineRange.end - timelineRange.start)) * 100,
      ))
      : isHls
        ? 100
        : 0;
  const behindLiveEdge = Boolean(isHls && !followingLive);

  useEffect(() => clearMpvStateUiTimer, [clearMpvStateUiTimer]);

  useEffect(() => {
    if (localization) document.documentElement.lang = localization.locale;
  }, [localization]);

  useEffect(() => {
    backendRef.current = backend;
  }, [backend]);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  const videoChrome = useVideoChrome({
    ...videoState,
  });
  const {
    closeHlsPanel,
    hideTitle,
    revealVideoChrome,
  } = videoChrome;

  useVideoVisibility({
    ...videoState,
    ...videoChrome,
  });

  useMpvRenderer({
    ...videoState,
    ...playbackState,
    localizationReady,
  });

  usePlaybackSource({
    ...videoState,
    ...playbackState,
    localizationReady,
  });

  useChromiumPlayback({
    ...videoState,
    ...playbackState,
  });

  const videoRequests = useVideoRequests({
    ...videoState,
    localizationReady,
  });
  const {
    openLocalRequest,
  } = videoRequests;

  useVideoPresentation({
    ...videoState,
  });

  const playbackControls = usePlaybackControls({
    ...videoState,
    ...playbackState,
    ...videoChrome,
    labels,
  });
  const {
    seekTo,
  } = playbackControls;

  const previewTimelineScrub = useCallback((seconds: number) => {
    const now = performance.now();
    const interval = playerStateRef.current.duration >= VIDEO_LONG_DURATION_SECONDS
      ? VIDEO_LONG_SCRUB_PREVIEW_INTERVAL_MS
      : VIDEO_SCRUB_PREVIEW_INTERVAL_MS;
    if (now - lastScrubPreviewAtRef.current < interval) return;
    lastScrubPreviewAtRef.current = now;
    seekTo(seconds, false);
  }, [seekTo]);

  const videoVolume = useVideoVolume({
    ...videoState,
    labels,
  });

  const timelineScrubbing = useTimelineScrubbing({
    ...videoState,
    ...playbackControls,
    ...videoChrome,
  });

  useVideoKeyboard({
    ...videoState,
    ...videoChrome,
    ...playbackControls,
    ...videoVolume,
    labels,
  });

  /** Selects the local file. */
  const selectLocalFile = async (): Promise<VideoOpenRequest | null> => {
    try {
      return await window.kawaikaraVideo.source.selectLocalFile();
    } catch (reason) {
      console.error('[video] Local file selection failed.', reason);
      setError(getMpvErrorMessage(reason, labels));
      return null;
    }
  };

  /** Opens the hls stream. */
  const openHlsStream = (event?: FormEvent) => {
    event?.preventDefault();
    const value = hlsUrl.trim();
    if (!isHttpUrl(value)) {
      setError(labels.invalidHls);
      return;
    }
    setError(undefined);
    closeHlsPanel();
    const nextSource: PlayerSource = {
      kind: 'hls',
      label: getStreamLabel(value),
      nativeValue: value,
      chromiumValue: value,
    };
    sourceRef.current = nextSource;
    setSource(nextSource);
  };

  const controlsLayout =
    fullScreen || pictureInPicture || preferences.videoControlsLayout === 'overlay'
      ? 'overlay'
      : 'inline';
  const showTitle =
    !pictureInPicture &&
    (titleVisible || sourcePanelOpen || hlsPanelOpen || downloaderOpen || !source);
  const showControls =
    pictureInPicture ? pictureInPicturePointerInside :
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
        className={`kawai-theme video-shell ${preferences.appTheme === 'dark'
            ? 'kawai-theme-dark'
            : 'kawai-theme-light'
          }`}
        data-controls-visible={showControls ? 'true' : 'false'}
        data-controls-layout={controlsLayout}
        data-title-visible={showTitle ? 'true' : 'false'}
        data-has-source={source ? 'true' : 'false'}
        data-backend={backend}
        data-electron-gpu={electronGpuAccelerationEnabled ? 'true' : 'false'}
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
          <VideoPictureInPicture
            {...playbackControls}
            isPlaying={isPlaying}
            labels={labels}
          />
        ) : null}

        {source ? (
          <VideoHeader
            {...videoChrome}
            {...videoState}
            source={source}
            hasTimeline={hasTimeline}
            labels={labels}
          />
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
              !electronGpuAccelerationEnabled
                ? labels.captureCompatibleRenderingWarning
                : hardwareAccelerationDisabled
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
            onOpenHls={() => {
              setHlsPanelOpen(true);
            }}
            onOpenVideo={(request, directory) => {
              void openLocalRequest(request, directory);
            }}
            onSelectFile={selectLocalFile}
          />
        ) : null}

        {hlsPanelOpen && !pictureInPicture ? (
          <HlsSourcePanel
            {...videoChrome}
            {...videoState}
            labels={labels}
            localization={localization}
            openHlsStream={openHlsStream}
          />
        ) : null}

        {downloaderOpen && !pictureInPicture ? (
          <div className="video-downloader-overlay">
            <YouTubeDownloaderPanel
              labels={localization.downloader}
              initialUrl={youtubeUrl}
              onClose={() => {
                setDownloaderOpen(false);
                if (!source) setSourcePanelOpen(true);
              }}
            />
          </div>
        ) : null}

        {source ? (
          <VideoControls
            {...videoChrome}
            {...playbackControls}
            {...videoState}
            {...timelineScrubbing}
            {...videoVolume}
            labels={labels}
            isPlaying={isPlaying}
            displayedTime={displayedTime}
            isHls={isHls}
            timelineRange={timelineRange}
            timelineProgress={timelineProgress}
            hasTimeline={hasTimeline}
            previewTimelineScrub={previewTimelineScrub}
            behindLiveEdge={behindLiveEdge}
          />
        ) : null}
      </main>
    </KawaiProvider>
  );
}
