import type {
  AppMessages
} from '../../../../Common/IPC';
import { getPictureInPictureError } from '../Logic/MenuInput';
import { type useMenuState } from './useMenuState';

/** Inputs used by useMenuWindowActions. */
type MenuWindowActionsOptions = Pick<ReturnType<typeof useMenuState>,
  | 'selectedId'
  | 'setSelectedId'
  | 'setError'
  | 'setNavigationState'
  | 'closeTimer'
  | 'setMenuVisible'
  | 'setView'
  | 'reduceMotion'
  | 'view'
  | 'setPipLoading'
  | 'setPipMode'
  | 'setPipFailureKey'
  | 'preferences'
  | 'setPreferences'
> & {
  /** The messages value for this section. */
  readonly messages: AppMessages;
};

/** Coordinates menu window actions behavior for this View. */
export function useMenuWindowActions({
  selectedId,
  setSelectedId,
  setError,
  setNavigationState,
  closeTimer,
  setMenuVisible,
  setView,
  reduceMotion,
  view,
  setPipLoading,
  setPipMode,
  messages,
  setPipFailureKey,
  preferences,
  setPreferences,
}: MenuWindowActionsOptions) {
  /** Opens the site. */
  const openSite = async (id: string) => {
    const previousId = selectedId;
    setSelectedId(id);
    setError(undefined);
    try {
      await window.kawaikara.sites.open(id);
      setNavigationState({ canGoBack: false, canGoForward: false });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setSelectedId(previousId);
    }
  };

  /** Performs the begin menu close operation. */
  const beginMenuClose = () => {
    if (closeTimer.current !== undefined) return;
    setMenuVisible(false);
    closeTimer.current = window.setTimeout(
      () => {
        closeTimer.current = undefined;
        setView('menu');
        void window.kawaikara.overlay.close();
      },
      reduceMotion ? 0 : 190,
    );
  };

  /** Closes the overlay. */
  const closeOverlay = () => {
    if (view === 'menu') {
      beginMenuClose();
      return;
    }
    setView('menu');
    void window.kawaikara.overlay.close();
  };

  /** Toggles the picture in picture. */
  const togglePictureInPicture = async () => {
    setPipLoading(true);
    setError(undefined);
    try {
      const result = await window.kawaikara.media.togglePictureInPicture();
      if (result.status === 'entered') {
        setPipMode(result.mode);
        return;
      }
      if (result.status === 'exited') {
        setPipMode(undefined);
        return;
      }
      setPipMode(undefined);
      setError(getPictureInPictureError(result.status, messages));
      setPipFailureKey((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : messages.pipFailed);
      setPipFailureKey((current) => current + 1);
    } finally {
      setPipLoading(false);
    }
  };

  /** Toggles the always on top. */
  const toggleAlwaysOnTop = async () => {
    if (!preferences) return;
    const previous = preferences;
    const alwaysOnTop = !previous.alwaysOnTop;
    setError(undefined);
    // Reflect the press immediately so the activity border never waits for a
    // disk-backed preference round trip before starting its animation.
    setPreferences({
      ...previous, alwaysOnTop
    });
    try {
      setPreferences(
        await window.kawaikara.preferences.update({
          alwaysOnTop,
        }),
      );
    } catch (reason) {
      setPreferences(previous);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return {
    /** The openSite value. */
    openSite,
    /** The beginMenuClose value. */
    beginMenuClose,
    /** The closeOverlay value. */
    closeOverlay,
    /** The togglePictureInPicture value. */
    togglePictureInPicture,
    /** The toggleAlwaysOnTop value. */
    toggleAlwaysOnTop,
  };
}
