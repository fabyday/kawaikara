import type {
  BundleInfo
} from '../../../../Common/IPC';
import { type usePreferenceState } from './usePreferenceState';

/** Inputs used by useBundleActions. */
type BundleActionsOptions = Pick<ReturnType<typeof usePreferenceState>,
  | 'setBundles'
  | 'setRuntimeBundles'
  | 'draftPreferences'
  | 'setInstallingBundle'
  | 'setBundleNotice'
  | 'setError'
  | 'messages'
  | 'setBundleActionId'
>;

/** Coordinates bundle actions behavior for this View. */
export function useBundleActions({
  setBundles,
  setRuntimeBundles,
  draftPreferences,
  setInstallingBundle,
  setBundleNotice,
  setError,
  messages,
  setBundleActionId,
}: BundleActionsOptions) {
  /** Performs the refresh bundle state operation. */
  const refreshBundleState = async () => {
    const [nextBundles, nextRuntimeBundles] = await Promise.all([
      window.kawaikara.bundles.list(),
      window.kawaikara.bundles.runtime(),
    ]);
    setBundles(nextBundles);
    setRuntimeBundles(nextRuntimeBundles);
  };

  /** Installs the bundle. */
  const installBundle = async () => {
    if (!draftPreferences) return;
    setInstallingBundle(true);
    setBundleNotice(undefined);
    setError(undefined);
    try {
      const result = await window.kawaikara.bundles.install(
        draftPreferences.appLocale,
      );
      if (result.status === 'cancelled') return;
      setBundles(await window.kawaikara.bundles.list());
      setBundleNotice(
        messages.bundleInstallSuccess.replace('{name}', result.bundle.name),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setInstallingBundle(false);
    }
  };

  /** Updates the bundle. */
  const updateBundle = async (bundle: BundleInfo) => {
    if (!draftPreferences || !bundle.updatable) return;
    setBundleActionId(bundle.id);
    setBundleNotice(undefined);
    setError(undefined);
    try {
      const result = await window.kawaikara.bundles.update(
        bundle.id,
        draftPreferences.appLocale,
      );
      if (result.status === 'cancelled') return;
      setBundles(await window.kawaikara.bundles.list());
      setBundleNotice(
        messages.bundleUpdateSuccess.replace('{name}', result.bundle.name),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBundleActionId(undefined);
    }
  };

  /** Removes the bundle. */
  const removeBundle = async (bundle: BundleInfo) => {
    if (!draftPreferences) return;
    setBundleActionId(bundle.id);
    setBundleNotice(undefined);
    setError(undefined);
    try {
      const result = await window.kawaikara.bundles.remove(
        bundle.id,
        draftPreferences.appLocale,
      );
      if (result.status === 'cancelled') return;
      setBundles(await window.kawaikara.bundles.list());
      setBundleNotice(
        messages.bundleRemoveSuccess.replace('{name}', bundle.name),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBundleActionId(undefined);
    }
  };

  return {
    /** The refreshBundleState value. */
    refreshBundleState,
    /** The installBundle value. */
    installBundle,
    /** The updateBundle value. */
    updateBundle,
    /** The removeBundle value. */
    removeBundle,
  };
}
