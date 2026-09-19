import {
  useCallback,
  useEffect
} from 'react';
import type {
  ApplicationLinkId,
  PreferencePatch,
  PreferenceState
} from '../../../../Common/IPC';
import { PREFERENCE_ACTION_POLICIES } from '../Logic/PreferenceActions';
import { preferencesEqual } from '../Logic/PreferenceOptions';
import { PreferenceActionPolicy, PreferenceViewProps } from '../Types';
import { type usePreferenceState } from './usePreferenceState';

/** Inputs used by usePreferenceDraft. */
type PreferenceDraftOptions = Pick<ReturnType<typeof usePreferenceState>,
  | 'savedPreferences'
  | 'draftPreferences'
  | 'setError'
  | 'setDraftPreferences'
  | 'setDiscardConfirmationOpen'
  | 'setLogViewerOpen'
  | 'logViewerOpen'
  | 'setSaving'
  | 'setSavedPreferences'
  | 'setCheckingUpdates'
  | 'setUpdateCheckResult'
> & Pick<PreferenceViewProps,
  | 'onThemePreview'
  | 'onBack'
  | 'onBackHandlerChange'
  | 'onPreferencesChange'
>;

/** Coordinates preference draft behavior for this View. */
export function usePreferenceDraft({
  savedPreferences,
  draftPreferences,
  onThemePreview,
  setError,
  setDraftPreferences,
  setDiscardConfirmationOpen,
  setLogViewerOpen,
  onBack,
  logViewerOpen,
  onBackHandlerChange,
  setSaving,
  setSavedPreferences,
  onPreferencesChange,
  setCheckingUpdates,
  setUpdateCheckResult,
}: PreferenceDraftOptions) {
  const hasChanges = Boolean(
    savedPreferences &&
    draftPreferences &&
    !preferencesEqual(savedPreferences, draftPreferences),
  );

  /** Updates the draft. */
  const updateDraft = (patch: PreferencePatch) => {
    if (patch.appTheme) {
      onThemePreview?.(patch.appTheme);
      void window.kawaikara.preferences.previewTheme(patch.appTheme).catch(
        (reason: unknown) => {
          setError(reason instanceof Error ? reason.message : String(reason));
        },
      );
    }
    setDraftPreferences((current) =>
      current ? {
        ...current, ...patch
      } : current,
    );
    setError(undefined);
  };

  const completeBack = useCallback(() => {
    if (savedPreferences) {
      onThemePreview?.(savedPreferences.appTheme);
      void window.kawaikara.preferences
        .previewTheme(savedPreferences.appTheme)
        .catch(() => undefined);
    }
    setDiscardConfirmationOpen(false);
    setLogViewerOpen(false);
    onBack();
  }, [onBack, onThemePreview, savedPreferences]);

  const requestBack = useCallback(() => {
    if (logViewerOpen) {
      setLogViewerOpen(false);
      return;
    }
    if (hasChanges) {
      setDiscardConfirmationOpen(true);
      return;
    }
    completeBack();
  }, [completeBack, hasChanges, logViewerOpen]);

  useEffect(() => {
    onBackHandlerChange?.(requestBack);
    return () => onBackHandlerChange?.(undefined);
  }, [onBackHandlerChange, requestBack]);

  /** Saves the operation. */
  const save = async (): Promise<PreferenceState | undefined> => {
    if (!draftPreferences) return undefined;
    if (!hasChanges) return draftPreferences;
    setSaving(true);
    setError(undefined);
    try {
      // Locale is global. Clear legacy per-plugin and per-site overrides when
      // saving so every integration follows the same app locale.
      const next = await window.kawaikara.preferences.update({
        ...draftPreferences,
        pluginLocales: {},
        siteLocales: {},
      });
      setSavedPreferences(next);
      setDraftPreferences(next);
      onPreferencesChange?.(next);
      return next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return undefined;
    } finally {
      setSaving(false);
    }
  };

  /** Runs the preference action. */
  const runPreferenceAction = async <Result,>(
    policy: PreferenceActionPolicy,
    action: () => Promise<Result>,
  ): Promise<Result | undefined> => {
    if (policy.save === 'before' && !(await save())) return undefined;
    setError(undefined);
    try {
      const result = await action();
      if (policy.completion === 'close-preferences') {
        await window.kawaikara.overlay.close();
      }
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return undefined;
    }
  };

  /** Opens the application link. */
  const openApplicationLink = async (id: ApplicationLinkId) => {
    await runPreferenceAction(
      PREFERENCE_ACTION_POLICIES.applicationLink,
      () => window.kawaikara.application.openLink(id),
    );
  };

  /** Performs the check for updates operation. */
  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateCheckResult(undefined);
    try {
      const result = await runPreferenceAction(
        PREFERENCE_ACTION_POLICIES.checkForUpdates,
        () => window.kawaikara.application.checkForUpdates(),
      );
      if (result) setUpdateCheckResult(result);
    } finally {
      setCheckingUpdates(false);
    }
  };

  return {
    /** The hasChanges value. */
    hasChanges,
    /** The updateDraft value. */
    updateDraft,
    /** The completeBack value. */
    completeBack,
    /** The requestBack value. */
    requestBack,
    /** The save value. */
    save,
    /** The runPreferenceAction value. */
    runPreferenceAction,
    /** The openApplicationLink value. */
    openApplicationLink,
    /** The checkForUpdates value. */
    checkForUpdates,
  };
}
