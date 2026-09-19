import {
  type MpvVideoElement,
  type MpvVideoState
} from 'electron-mpv-video/renderer';
import Hls from 'hls.js';
import {
  useRef,
  useState
} from 'react';
import type {
  RendererMessages,
  VideoMessages
} from '../../../../Common/IPC';
import {
  DEFAULT_VIDEO_SEEK_SECONDS
} from '../../../../Common/VideoControls';
import { INITIAL_PLAYER_STATE } from '../Playback/PlayerDefaults';
import { FallbackReason, PendingMpvSeek, PlaybackBackend, PlayerSource, VideoPreferences, VideoSeekRange } from '../Types';

/** Coordinates video state behavior for this View. */
export function useVideoState() {
  const playerHostRef = useRef<HTMLDivElement>(null);

  const playerRef = useRef<MpvVideoElement | null>(null);

  const fallbackVideoRef = useRef<HTMLVideoElement>(null);

  const hlsRef = useRef<Hls | null>(null);

  const fallbackFrameSamplesRef = useRef<number[]>([]);

  const rendererLogSignatureRef = useRef('');

  const playerStateRef = useRef<MpvVideoState>(INITIAL_PLAYER_STATE);

  const pendingMpvStateRef = useRef<MpvVideoState | undefined>(undefined);

  const mpvStateUiTimerRef = useRef<number | undefined>(undefined);

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

  const sourceOpeningRef = useRef(false);

  const mpvSeekInFlightRef = useRef(false);

  const pendingMpvSeekRef = useRef<PendingMpvSeek | undefined>(undefined);

  const replayInFlightRef = useRef(false);

  const labelsRef = useRef<VideoMessages | undefined>(undefined);

  const revealControlsRef = useRef<() => void>(() => undefined);

  const [backend, setBackend] = useState<PlaybackBackend>('detecting');

  const [fallbackReason, setFallbackReason] = useState<FallbackReason>();

  const [hardwareAccelerationDisabled, setHardwareAccelerationDisabled] =
    useState(false);

  const [electronGpuAccelerationEnabled, setElectronGpuAccelerationEnabled] =
    useState(true);

  const [mpvRenderMode, setMpvRenderMode] =
    useState<'shared-texture' | 'webgl' | 'canvas2d'>('shared-texture');

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

  const [pictureInPicturePointerInside, setPictureInPicturePointerInside] =
    useState(false);

  const [hlsPanelOpen, setHlsPanelOpen] = useState(false);

  const [downloaderOpen, setDownloaderOpen] = useState(false);

  const [controlsVisible, setControlsVisible] = useState(true);

  const [titleVisible, setTitleVisible] = useState(false);

  const [scrubTime, setScrubTime] = useState<number>();

  const [hlsSeekRange, setHlsSeekRange] = useState<VideoSeekRange>();

  const [followingLive, setFollowingLive] = useState(false);

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

  return {
    /** The playerHostRef value. */
    playerHostRef,
    /** The playerRef value. */
    playerRef,
    /** The fallbackVideoRef value. */
    fallbackVideoRef,
    /** The hlsRef value. */
    hlsRef,
    /** The fallbackFrameSamplesRef value. */
    fallbackFrameSamplesRef,
    /** The rendererLogSignatureRef value. */
    rendererLogSignatureRef,
    /** The playerStateRef value. */
    playerStateRef,
    /** The pendingMpvStateRef value. */
    pendingMpvStateRef,
    /** The mpvStateUiTimerRef value. */
    mpvStateUiTimerRef,
    /** The backendRef value. */
    backendRef,
    /** The sourceRef value. */
    sourceRef,
    /** The viewVisibleRef value. */
    viewVisibleRef,
    /** The controlsHideTimerRef value. */
    controlsHideTimerRef,
    /** The titleHideTimerRef value. */
    titleHideTimerRef,
    /** The timelineRef value. */
    timelineRef,
    /** The scrubbingRef value. */
    scrubbingRef,
    /** The scrubPointerIdRef value. */
    scrubPointerIdRef,
    /** The scrubTargetRef value. */
    scrubTargetRef,
    /** The lastScrubPreviewAtRef value. */
    lastScrubPreviewAtRef,
    /** The volumeRef value. */
    volumeRef,
    /** The pendingVolumePersistRef value. */
    pendingVolumePersistRef,
    /** The volumePersistTimerRef value. */
    volumePersistTimerRef,
    /** The openGenerationRef value. */
    openGenerationRef,
    /** The sourceOpeningRef value. */
    sourceOpeningRef,
    /** The mpvSeekInFlightRef value. */
    mpvSeekInFlightRef,
    /** The pendingMpvSeekRef value. */
    pendingMpvSeekRef,
    /** The replayInFlightRef value. */
    replayInFlightRef,
    /** The labelsRef value. */
    labelsRef,
    /** The revealControlsRef value. */
    revealControlsRef,
    /** The backend value. */
    backend,
    /** The setBackend value. */
    setBackend,
    /** The fallbackReason value. */
    fallbackReason,
    /** The setFallbackReason value. */
    setFallbackReason,
    /** The hardwareAccelerationDisabled value. */
    hardwareAccelerationDisabled,
    /** The setHardwareAccelerationDisabled value. */
    setHardwareAccelerationDisabled,
    /** The electronGpuAccelerationEnabled value. */
    electronGpuAccelerationEnabled,
    /** The setElectronGpuAccelerationEnabled value. */
    setElectronGpuAccelerationEnabled,
    /** The mpvRenderMode value. */
    mpvRenderMode,
    /** The setMpvRenderMode value. */
    setMpvRenderMode,
    /** The playerState value. */
    playerState,
    /** The setPlayerState value. */
    setPlayerState,
    /** The source value. */
    source,
    /** The setSource value. */
    setSource,
    /** The sourceRevision value. */
    sourceRevision,
    /** The setSourceRevision value. */
    setSourceRevision,
    /** The hlsUrl value. */
    hlsUrl,
    /** The setHlsUrl value. */
    setHlsUrl,
    /** The error value. */
    error,
    /** The setError value. */
    setError,
    /** The loading value. */
    loading,
    /** The setLoading value. */
    setLoading,
    /** The sourcePanelOpen value. */
    sourcePanelOpen,
    /** The setSourcePanelOpen value. */
    setSourcePanelOpen,
    /** The initialRequestResolved value. */
    initialRequestResolved,
    /** The setInitialRequestResolved value. */
    setInitialRequestResolved,
    /** The requestedDirectory value. */
    requestedDirectory,
    /** The setRequestedDirectory value. */
    setRequestedDirectory,
    /** The lastBrowseDirectory value. */
    lastBrowseDirectory,
    /** The setLastBrowseDirectory value. */
    setLastBrowseDirectory,
    /** The fullScreen value. */
    fullScreen,
    /** The setFullScreen value. */
    setFullScreen,
    /** The pictureInPicture value. */
    pictureInPicture,
    /** The setPictureInPicture value. */
    setPictureInPicture,
    /** The pictureInPicturePointerInside value. */
    pictureInPicturePointerInside,
    /** The setPictureInPicturePointerInside value. */
    setPictureInPicturePointerInside,
    /** The hlsPanelOpen value. */
    hlsPanelOpen,
    /** The setHlsPanelOpen value. */
    setHlsPanelOpen,
    /** The downloaderOpen value. */
    downloaderOpen,
    /** The setDownloaderOpen value. */
    setDownloaderOpen,
    /** The controlsVisible value. */
    controlsVisible,
    /** The setControlsVisible value. */
    setControlsVisible,
    /** The titleVisible value. */
    titleVisible,
    /** The setTitleVisible value. */
    setTitleVisible,
    /** The scrubTime value. */
    scrubTime,
    /** The setScrubTime value. */
    setScrubTime,
    /** The hlsSeekRange value. */
    hlsSeekRange,
    /** The setHlsSeekRange value. */
    setHlsSeekRange,
    /** The followingLive value. */
    followingLive,
    /** The setFollowingLive value. */
    setFollowingLive,
    /** The youtubeUrl value. */
    youtubeUrl,
    /** The setYoutubeUrl value. */
    setYoutubeUrl,
    /** The volume value. */
    volume,
    /** The setVolume value. */
    setVolume,
    /** The localization value. */
    localization,
    /** The setLocalization value. */
    setLocalization,
    /** The preferences value. */
    preferences,
    /** The setPreferences value. */
    setPreferences,
  };
}
