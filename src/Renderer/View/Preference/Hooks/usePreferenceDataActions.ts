import type {
  BrowserProfileInfo,
  SiteMenuItem
} from '../../../../Common/IPC';
import { type usePreferenceState } from './usePreferenceState';

/** Inputs used by usePreferenceDataActions. */
type PreferenceDataActionsOptions = Pick<ReturnType<typeof usePreferenceState>,
  | 'draftPreferences'
  | 'setDataActionId'
  | 'setDataNotice'
  | 'setError'
  | 'messages'
>;

/** Coordinates preference data actions behavior for this View. */
export function usePreferenceDataActions({
  draftPreferences,
  setDataActionId,
  setDataNotice,
  setError,
  messages,
}: PreferenceDataActionsOptions) {
  /** Clears the browser profile data. */
  const clearBrowserProfileData = async (profile: BrowserProfileInfo) => {
    if (!draftPreferences) return;
    const actionId = `profile:${profile.id}`;
    setDataActionId(actionId);
    setDataNotice(undefined);
    setError(undefined);
    try {
      const result = await window.kawaikara.data.clearBrowserProfile(
        profile.id,
        draftPreferences.appLocale,
      );
      if (result.status === 'cleared') {
        setDataNotice(
          messages.dataClearSuccess.replace('{name}', profile.name),
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDataActionId(undefined);
    }
  };

  /** Clears the isolated site data. */
  const clearIsolatedSiteData = async (site: SiteMenuItem) => {
    if (!draftPreferences) return;
    const actionId = `site:${site.id}`;
    setDataActionId(actionId);
    setDataNotice(undefined);
    setError(undefined);
    try {
      const result = await window.kawaikara.data.clearIsolatedSite(
        site.id,
        draftPreferences.appLocale,
      );
      if (result.status === 'cleared') {
        setDataNotice(
          messages.dataClearSuccess.replace('{name}', site.title),
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDataActionId(undefined);
    }
  };

  /** Clears the application cache. */
  const clearApplicationCache = async () => {
    if (!draftPreferences) return;
    setDataActionId('application-cache');
    setDataNotice(undefined);
    setError(undefined);
    try {
      await window.kawaikara.data.clearApplicationCache(
        draftPreferences.appLocale,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDataActionId(undefined);
    }
  };

  /** Clears the all browser profiles. */
  const clearAllBrowserProfiles = async () => {
    if (!draftPreferences) return;
    setDataActionId('all-browser-profiles');
    setDataNotice(undefined);
    setError(undefined);
    try {
      const result = await window.kawaikara.data.clearAllBrowserProfiles(
        draftPreferences.appLocale,
      );
      if (result.status === 'cleared') {
        setDataNotice(messages.allProfileDataClearSuccess);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDataActionId(undefined);
    }
  };

  /** Resets the application. */
  const resetApplication = async () => {
    if (!draftPreferences) return;
    setDataActionId('application-reset');
    setDataNotice(undefined);
    setError(undefined);
    try {
      await window.kawaikara.data.resetApplication(
        draftPreferences.appLocale,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDataActionId(undefined);
    }
  };

  return {
    /** The clearBrowserProfileData value. */
    clearBrowserProfileData,
    /** The clearIsolatedSiteData value. */
    clearIsolatedSiteData,
    /** The clearApplicationCache value. */
    clearApplicationCache,
    /** The clearAllBrowserProfiles value. */
    clearAllBrowserProfiles,
    /** The resetApplication value. */
    resetApplication,
  };
}
