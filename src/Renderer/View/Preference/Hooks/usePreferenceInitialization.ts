import {
  useEffect
} from 'react';
import { PreferenceViewProps } from '../Types';
import { type usePreferenceState } from './usePreferenceState';

/** Inputs used by usePreferenceInitialization. */
type PreferenceInitializationOptions = Pick<ReturnType<typeof usePreferenceState>,
  | 'setSavedPreferences'
  | 'setDraftPreferences'
  | 'setRuntimeBundles'
  | 'setBundles'
  | 'setAppInfo'
  | 'setDisplays'
  | 'setDevelopmentState'
  | 'setError'
  | 'draftPreferences'
  | 'setMessages'
  | 'setLogViewerMessages'
  | 'setResolvedLocale'
  | 'setDeveloperYouTubeStatus'
> & Pick<PreferenceViewProps,
  | 'onMessagesChange'
>;

/** Coordinates preference initialization behavior for this View. */
export function usePreferenceInitialization({
  setSavedPreferences,
  setDraftPreferences,
  setRuntimeBundles,
  setBundles,
  setAppInfo,
  setDisplays,
  setDevelopmentState,
  setError,
  draftPreferences,
  setMessages,
  setLogViewerMessages,
  setResolvedLocale,
  onMessagesChange,
  setDeveloperYouTubeStatus,
}: PreferenceInitializationOptions) {
  useEffect(() => {
    void Promise.all([
      window.kawaikara.preferences.get(),
      window.kawaikara.bundles.runtime(),
      window.kawaikara.bundles.list(),
      window.kawaikara.application.getInfo(),
      window.kawaikara.application.listDisplays(),
      window.kawaikara.development.getState(),
    ])
      .then(([
        nextPreferences,
        nextRuntimeBundles,
        nextBundles,
        nextAppInfo,
        nextDisplays,
        nextDevelopmentState,
      ]) => {
        setSavedPreferences(nextPreferences);
        setDraftPreferences(nextPreferences);
        setRuntimeBundles(nextRuntimeBundles);
        setBundles(nextBundles);
        setAppInfo(nextAppInfo);
        setDisplays(nextDisplays);
        setDevelopmentState(nextDevelopmentState);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  useEffect(
    () => window.kawaikara.development.onStateChanged(setDevelopmentState),
    [],
  );

  useEffect(() => {
    const locale = draftPreferences?.appLocale;
    if (!locale) return;
    let active = true;
    void window.kawaikara.application
      .getMessages(locale)
      .then((next) => {
        if (!active) return;
        setMessages(next.app);
        setLogViewerMessages(next.logViewer);
        setResolvedLocale(next.locale);
        onMessagesChange?.(next.app);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      active = false;
    };
  }, [draftPreferences?.appLocale, onMessagesChange]);

  useEffect(() => {
    let active = true;
    /** Performs the refresh operation. */
    const refresh = () => {
      void window.kawaikara.application
        .getDeveloperYouTubeStatus()
        .then((status) => {
          if (active) setDeveloperYouTubeStatus(status);
        })
        .catch((reason: unknown) => {
          if (!active) return;
          setDeveloperYouTubeStatus({
            isLive: false,
            checkedAt: new Date().toISOString(),
            error: reason instanceof Error ? reason.message : String(reason),
          });
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
}
