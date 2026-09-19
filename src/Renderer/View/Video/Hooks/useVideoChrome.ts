import {
  useCallback,
  useEffect
} from 'react';
import { type useVideoState } from './useVideoState';

/** Inputs used by useVideoChrome. */
type VideoChromeOptions = Pick<ReturnType<typeof useVideoState>,
  | 'setHlsPanelOpen'
  | 'controlsHideTimerRef'
  | 'setControlsVisible'
  | 'sourceRef'
  | 'scrubbingRef'
  | 'preferences'
  | 'revealControlsRef'
  | 'titleHideTimerRef'
  | 'setTitleVisible'
  | 'localization'
  | 'setFullScreen'
  | 'setPictureInPicture'
  | 'setPictureInPicturePointerInside'
>;

/** Coordinates video chrome behavior for this View. */
export function useVideoChrome({
  setHlsPanelOpen,
  controlsHideTimerRef,
  setControlsVisible,
  sourceRef,
  scrubbingRef,
  preferences,
  revealControlsRef,
  titleHideTimerRef,
  setTitleVisible,
  localization,
  setFullScreen,
  setPictureInPicture,
  setPictureInPicturePointerInside,
}: VideoChromeOptions) {
  const closeHlsPanel = useCallback(() => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) activeElement.blur();
    setHlsPanelOpen(false);
  }, []);

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
      (active) => {
        setPictureInPicture(active);
        if (!active) setPictureInPicturePointerInside(false);
      },
    ), []);

  useEffect(() =>
    window.kawaikaraVideo.application.onPictureInPicturePointerChanged(
      (inside) => {
        setPictureInPicturePointerInside(inside);
        clearControlsHideTimer();
        setControlsVisible(inside);
      },
    ), [clearControlsHideTimer]);

  return {
    /** The closeHlsPanel value. */
    closeHlsPanel,
    /** The clearControlsHideTimer value. */
    clearControlsHideTimer,
    /** The revealControls value. */
    revealControls,
    /** The clearTitleHideTimer value. */
    clearTitleHideTimer,
    /** The hideTitle value. */
    hideTitle,
    /** The revealVideoChrome value. */
    revealVideoChrome,
  };
}
