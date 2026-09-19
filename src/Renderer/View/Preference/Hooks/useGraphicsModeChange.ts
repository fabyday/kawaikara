import type {
  GraphicsMode
} from '../../../../Common/IPC';
import { PreferenceViewProps } from '../Types';
import { type usePreferenceState } from './usePreferenceState';

/** Inputs used by useGraphicsModeChange. */
type GraphicsModeChangeOptions = Pick<ReturnType<typeof usePreferenceState>,
  | 'draftPreferences'
  | 'setGraphicsRestartRequest'
  | 'setError'
  | 'graphicsRestartRequest'
  | 'setSaving'
  | 'setSavedPreferences'
  | 'setDraftPreferences'
> & Pick<PreferenceViewProps,
  | 'onPreferencesChange'
>;

/** Coordinates graphics mode change behavior for this View. */
export function useGraphicsModeChange({
  draftPreferences,
  setGraphicsRestartRequest,
  setError,
  graphicsRestartRequest,
  setSaving,
  setSavedPreferences,
  setDraftPreferences,
  onPreferencesChange,
}: GraphicsModeChangeOptions) {
  /** Requests the graphics mode change. */
  const requestGraphicsModeChange = (graphicsMode: GraphicsMode) => {
    if (!draftPreferences || graphicsMode === draftPreferences.graphicsMode) {
      return;
    }
    setGraphicsRestartRequest(graphicsMode);
    setError(undefined);
  };

  /** Applies the graphics mode change. */
  const applyGraphicsModeChange = async () => {
    if (graphicsRestartRequest === undefined || !draftPreferences) return;
    const nextDraft = {
      ...draftPreferences,
      graphicsMode: graphicsRestartRequest,
      pluginLocales: {},
      siteLocales: {},
    };
    setSaving(true);
    setError(undefined);
    try {
      const next = await window.kawaikara.preferences.update(nextDraft, {
        restartForGraphicsChange: true,
      });
      setSavedPreferences(next);
      setDraftPreferences(next);
      onPreferencesChange?.(next);
      setGraphicsRestartRequest(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  return {
    /** The requestGraphicsModeChange value. */
    requestGraphicsModeChange,
    /** The applyGraphicsModeChange value. */
    applyGraphicsModeChange,
  };
}
