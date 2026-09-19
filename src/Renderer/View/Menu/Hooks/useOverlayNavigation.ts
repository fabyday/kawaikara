import type {
  OverlayView
} from '../../../../Common/IPC';
import { type useMenuState } from './useMenuState';

/** Inputs used by useOverlayNavigation. */
type OverlayNavigationOptions = Pick<ReturnType<typeof useMenuState>,
  | 'viewRef'
  | 'preferenceReturnPending'
  | 'setSkipMenuEntryAnimation'
  | 'setMenuVisible'
  | 'setView'
  | 'setError'
  | 'updateStateRef'
>;

/** Coordinates overlay navigation behavior for this View. */
export function useOverlayNavigation({
  viewRef,
  preferenceReturnPending,
  setSkipMenuEntryAnimation,
  setMenuVisible,
  setView,
  setError,
  updateStateRef,
}: OverlayNavigationOptions) {
  /** Sets the overlay view. */
  const setOverlayView = (nextView: OverlayView) => {
    if (nextView === 'preference' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (nextView === 'menu' && viewRef.current === 'preference') {
      preferenceReturnPending.current = true;
      setSkipMenuEntryAnimation(true);
      setMenuVisible(true);
    }
    viewRef.current = nextView;
    setView(nextView);
    void window.kawaikara.overlay.setView(nextView).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  };

  /** Performs the dismiss update operation. */
  const dismissUpdate = () => {
    if (updateStateRef.current?.origin === 'manual') {
      setOverlayView('preference');
    } else {
      void window.kawaikara.overlay.close();
    }
  };

  /** Performs the retry update operation. */
  const retryUpdate = async () => {
    await window.kawaikara.application.checkForUpdates();
  };

  return {
    /** The setOverlayView value. */
    setOverlayView,
    /** The dismissUpdate value. */
    dismissUpdate,
    /** The retryUpdate value. */
    retryUpdate,
  };
}
