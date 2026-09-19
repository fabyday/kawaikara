import { type useBundleActions } from './useBundleActions';
import { type usePreferenceDraft } from './usePreferenceDraft';
import { type usePreferenceState } from './usePreferenceState';

/** Inputs used by useDevelopmentActions. */
type DevelopmentActionsOptions = Pick<ReturnType<typeof usePreferenceDraft>,
  | 'save'
> & Pick<ReturnType<typeof usePreferenceState>,
  | 'setDevelopmentActionId'
  | 'setDevelopmentNotice'
  | 'setError'
  | 'setDevelopmentState'
  | 'messages'
> & Pick<ReturnType<typeof useBundleActions>,
  | 'refreshBundleState'
>;

/** Coordinates development actions behavior for this View. */
export function useDevelopmentActions({
  save,
  setDevelopmentActionId,
  setDevelopmentNotice,
  setError,
  setDevelopmentState,
  refreshBundleState,
  messages,
}: DevelopmentActionsOptions) {
  /** Attaches the development project. */
  const attachDevelopmentProject = async () => {
    const saved = await save();
    if (!saved?.developmentMode) return;
    setDevelopmentActionId('attach');
    setDevelopmentNotice(undefined);
    setError(undefined);
    try {
      const result = await window.kawaikara.development.attach(saved.appLocale);
      if (result.status === 'cancelled') return;
      setDevelopmentState(await window.kawaikara.development.getState());
      await refreshBundleState();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDevelopmentActionId(undefined);
    }
  };

  /** Performs the rebuild development project operation. */
  const rebuildDevelopmentProject = async (projectId: string) => {
    setDevelopmentActionId(`rebuild:${projectId}`);
    setDevelopmentNotice(undefined);
    setError(undefined);
    try {
      setDevelopmentState(await window.kawaikara.development.rebuild(projectId));
      await refreshBundleState();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDevelopmentActionId(undefined);
    }
  };

  /** Sets the development hot reload. */
  const setDevelopmentHotReload = async (
    projectId: string,
    enabled: boolean,
  ) => {
    setError(undefined);
    try {
      setDevelopmentState(
        await window.kawaikara.development.setHotReload(projectId, enabled),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  /** Detaches the development project. */
  const detachDevelopmentProject = async (projectId: string) => {
    setDevelopmentActionId(`detach:${projectId}`);
    setDevelopmentNotice(undefined);
    setError(undefined);
    try {
      setDevelopmentState(await window.kawaikara.development.detach(projectId));
      await refreshBundleState();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDevelopmentActionId(undefined);
    }
  };

  /** Copies the vs code configuration. */
  const copyVsCodeConfiguration = async () => {
    setDevelopmentActionId('copy-vscode');
    setError(undefined);
    try {
      const configuration =
        await window.kawaikara.development.getVsCodeConfiguration();
      await window.kawaikara.application.copyText(configuration);
      setDevelopmentNotice(messages.vsCodeConfigurationCopied);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDevelopmentActionId(undefined);
    }
  };

  return {
    /** The attachDevelopmentProject value. */
    attachDevelopmentProject,
    /** The rebuildDevelopmentProject value. */
    rebuildDevelopmentProject,
    /** The setDevelopmentHotReload value. */
    setDevelopmentHotReload,
    /** The detachDevelopmentProject value. */
    detachDevelopmentProject,
    /** The copyVsCodeConfiguration value. */
    copyVsCodeConfiguration,
  };
}
