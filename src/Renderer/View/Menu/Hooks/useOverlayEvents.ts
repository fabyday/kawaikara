import {
  useEffect
} from 'react';
import { type useMenuState } from './useMenuState';
import { type useMenuWindowActions } from './useMenuWindowActions';

/** Inputs used by useOverlayEvents. */
type OverlayEventsOptions = Pick<ReturnType<typeof useMenuState>,
  | 'viewRef'
  | 'view'
  | 'updateStateRef'
  | 'updateState'
  | 'localization'
  | 'closeTimer'
  | 'shortcutHighlightTimer'
  | 'pipFailureTimer'
  | 'addressCopiedTimer'
  | 'setSites'
  | 'setAddress'
  | 'setNavigationState'
  | 'setSelectedId'
  | 'setPreferences'
  | 'setLocalization'
  | 'setError'
  | 'preferenceReturnPending'
  | 'setSkipMenuEntryAnimation'
  | 'setPreviewTheme'
  | 'setView'
  | 'setMenuEntrySequence'
  | 'setMenuVisible'
  | 'setSitePanelRefreshKey'
  | 'setUpdateState'
  | 'setUpdatePanelView'
  | 'updatePanelViewRef'
  | 'preferenceBackHandler'
  | 'setPipMode'
> & Pick<ReturnType<typeof useMenuWindowActions>,
  | 'beginMenuClose'
>;

/** Coordinates overlay events behavior for this View. */
export function useOverlayEvents({
  viewRef,
  view,
  updateStateRef,
  updateState,
  localization,
  closeTimer,
  shortcutHighlightTimer,
  pipFailureTimer,
  addressCopiedTimer,
  setSites,
  setAddress,
  setNavigationState,
  setSelectedId,
  setPreferences,
  setLocalization,
  setError,
  preferenceReturnPending,
  setSkipMenuEntryAnimation,
  setPreviewTheme,
  setView,
  setMenuEntrySequence,
  setMenuVisible,
  setSitePanelRefreshKey,
  setUpdateState,
  setUpdatePanelView,
  updatePanelViewRef,
  preferenceBackHandler,
  beginMenuClose,
  setPipMode,
}: OverlayEventsOptions) {
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    updateStateRef.current = updateState;
  }, [updateState]);

  useEffect(() => {
    if (localization) document.documentElement.lang = localization.locale;
  }, [localization]);

  useEffect(
    () => () => {
      if (closeTimer.current !== undefined) {
        window.clearTimeout(closeTimer.current);
      }
      if (shortcutHighlightTimer.current !== undefined) {
        window.clearTimeout(shortcutHighlightTimer.current);
      }
      if (pipFailureTimer.current !== undefined) {
        window.clearTimeout(pipFailureTimer.current);
      }
      if (addressCopiedTimer.current !== undefined) {
        window.clearTimeout(addressCopiedTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    void Promise.all([
      window.kawaikara.sites.list(),
      window.kawaikara.sites.currentAddress(),
      window.kawaikara.sites.navigationState(),
      window.kawaikara.preferences.get(),
      window.kawaikara.application.getMessages(),
    ])
      .then(([
        nextSites,
        nextAddress,
        nextNavigationState,
        nextPreferences,
        nextLocalization,
      ]) => {
        setSites(nextSites);
        setAddress(nextAddress);
        setNavigationState(nextNavigationState);
        setSelectedId(nextSites.find((site) => site.isCurrent)?.id);
        setPreferences(nextPreferences);
        setLocalization(nextLocalization);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  useEffect(() => {
    const removeMenuListener = window.kawaikara.overlay.onShowMenu(() => {
      const returningFromPreference =
        preferenceReturnPending.current || viewRef.current === 'preference';
      preferenceReturnPending.current = false;
      setSkipMenuEntryAnimation(returningFromPreference);
      setPreviewTheme(undefined);
      if (closeTimer.current !== undefined) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = undefined;
      }
      setView('menu');
      viewRef.current = 'menu';
      setMenuEntrySequence((current) => current + 1);
      setMenuVisible(true);
      setSitePanelRefreshKey((current) => current + 1);
      void Promise.all([
        window.kawaikara.sites.list(),
        window.kawaikara.sites.currentAddress(),
        window.kawaikara.sites.navigationState(),
        window.kawaikara.preferences.get(),
        window.kawaikara.application.getMessages(),
      ]).then(([
        nextSites,
        nextAddress,
        nextNavigationState,
        nextPreferences,
        nextLocalization,
      ]) => {
        setSites(nextSites);
        setAddress(nextAddress);
        setNavigationState(nextNavigationState);
        setSelectedId(nextSites.find((site) => site.isCurrent)?.id);
        setPreferences(nextPreferences);
        setLocalization(nextLocalization);
      });
    });
    const removePreferenceListener =
      window.kawaikara.overlay.onShowPreferences(() => {
        if (closeTimer.current !== undefined) {
          window.clearTimeout(closeTimer.current);
          closeTimer.current = undefined;
        }
        setMenuVisible(true);
        setView('preference');
        viewRef.current = 'preference';
      });
    const removeUpdateListener = window.kawaikara.overlay.onShowUpdate((state) => {
      if (closeTimer.current !== undefined) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = undefined;
      }
      setMenuVisible(true);
      setUpdateState(state);
      updateStateRef.current = state;
      setUpdatePanelView('status');
      updatePanelViewRef.current = 'status';
      setView('update');
      viewRef.current = 'update';
    });
    const removeUpdateStateListener =
      window.kawaikara.application.onUpdateStateChanged((state) => {
        setUpdateState(state);
        updateStateRef.current = state;
      });
    const removeCloseListener = window.kawaikara.overlay.onRequestClose(() => {
      if (viewRef.current === 'update') {
        if (updatePanelViewRef.current === 'release-notes') {
          setUpdatePanelView('status');
          updatePanelViewRef.current = 'status';
          return;
        }
        if (updateStateRef.current?.origin === 'manual') {
          void window.kawaikara.overlay.setView('preference');
        } else {
          void window.kawaikara.overlay.close();
        }
        return;
      }
      if (viewRef.current !== 'menu') {
        if (viewRef.current === 'preference' && preferenceBackHandler.current) {
          preferenceBackHandler.current();
          return;
        }
        void window.kawaikara.overlay.setView('menu');
        return;
      }
      beginMenuClose();
    });
    const removeHiddenListener = window.kawaikara.overlay.onHidden(() => {
      if (closeTimer.current !== undefined) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = undefined;
      }
      setMenuVisible(false);
      setPreviewTheme(undefined);
      preferenceReturnPending.current = false;
      setSkipMenuEntryAnimation(false);
      setView('menu');
      viewRef.current = 'menu';
    });
    const removePictureInPictureListener =
      window.kawaikara.media.onPictureInPictureChanged((result) => {
        if (result.status === 'entered') setPipMode(result.mode);
        else setPipMode(undefined);
      });
    return () => {
      removeMenuListener();
      removePreferenceListener();
      removeUpdateListener();
      removeUpdateStateListener();
      removeCloseListener();
      removeHiddenListener();
      removePictureInPictureListener();
    };
  }, []);
}
