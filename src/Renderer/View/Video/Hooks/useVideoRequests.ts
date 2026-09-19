import {
  useCallback,
  useEffect
} from 'react';
import type {
  VideoOpenRequest
} from '../../../../Common/IPC';
import { areVideoPreferencesEqual, getErrorText, getMpvErrorMessage, isSamePlayerSource } from '../Presentation';
import { PlayerSource } from '../Types';
import { type useVideoState } from './useVideoState';

/** Inputs used by useVideoRequests. */
type VideoRequestsOptions = Pick<ReturnType<typeof useVideoState>,
  | 'setYoutubeUrl'
  | 'setDownloaderOpen'
  | 'setSourcePanelOpen'
  | 'setRequestedDirectory'
  | 'setLastBrowseDirectory'
  | 'setHlsPanelOpen'
  | 'setError'
  | 'sourceRef'
  | 'setSource'
  | 'setSourceRevision'
  | 'setLoading'
  | 'labelsRef'
  | 'setInitialRequestResolved'
  | 'pendingVolumePersistRef'
  | 'volumeRef'
  | 'setPreferences'
  | 'setLocalization'
> & {
  /** The localizationReady value for this section. */
  readonly localizationReady: boolean;
};

/** Coordinates video requests behavior for this View. */
export function useVideoRequests({
  setYoutubeUrl,
  setDownloaderOpen,
  setSourcePanelOpen,
  setRequestedDirectory,
  setLastBrowseDirectory,
  setHlsPanelOpen,
  setError,
  sourceRef,
  setSource,
  setSourceRevision,
  setLoading,
  labelsRef,
  localizationReady,
  setInitialRequestResolved,
  pendingVolumePersistRef,
  volumeRef,
  setPreferences,
  setLocalization,
}: VideoRequestsOptions) {
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
    const currentSource = sourceRef.current;
    const resolvedSource = currentSource && isSamePlayerSource(
      currentSource,
      nextSource,
    ) ? currentSource : nextSource;
    sourceRef.current = resolvedSource;
    setSource(resolvedSource);
    if (forcePlaybackReload) {
      setSourceRevision((current) => current + 1);
    }
  }, []);

  const openLocalRequest = useCallback(async (
    request: Extract<VideoOpenRequest, {
      readonly kind: 'local'
    }>,
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
    /** Performs the refresh preferences operation. */
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

  return {
    /** The openLocalRequest value. */
    openLocalRequest,
  };
}
