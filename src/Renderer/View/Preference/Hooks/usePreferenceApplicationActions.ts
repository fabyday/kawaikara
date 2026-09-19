import type {
  DevToolsMode
} from '../../../../Common/IPC';
import { PREFERENCE_ACTION_POLICIES } from '../Logic/PreferenceActions';
import { type usePreferenceDraft } from './usePreferenceDraft';

/** Inputs used by usePreferenceApplicationActions. */
type PreferenceApplicationActionsOptions = Pick<ReturnType<typeof usePreferenceDraft>,
  | 'runPreferenceAction'
>;

/** Coordinates preference application actions behavior for this View. */
export function usePreferenceApplicationActions({
  runPreferenceAction,
}: PreferenceApplicationActionsOptions) {
  /** Opens the log directory. */
  const openLogDirectory = async () => {
    await runPreferenceAction(
      PREFERENCE_ACTION_POLICIES.openLogDirectory,
      () => window.kawaikara.application.openLogDirectory(),
    );
  };

  /** Opens the dev tools. */
  const openDevTools = async (mode: DevToolsMode) => {
    await runPreferenceAction(
      PREFERENCE_ACTION_POLICIES.openDevTools,
      () => window.kawaikara.application.openDevTools(mode),
    );
  };

  return {
    /** The openLogDirectory value. */
    openLogDirectory,
    /** The openDevTools value. */
    openDevTools,
  };
}
