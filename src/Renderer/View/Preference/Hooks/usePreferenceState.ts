import {
  useState
} from 'react';
import type {
  ApplicationInfo,
  ApplicationUpdateCheckResult,
  BundleInfo,
  BundleRuntimeInfo,
  DeveloperYouTubeStatus,
  DevelopmentState,
  DisplayInfo,
  GraphicsMode,
  PreferenceState
} from '../../../../Common/IPC';
import { PreferenceViewProps, ShortcutConflict } from '../Types';

/** Inputs used by usePreferenceState. */
type PreferenceStateOptions = Pick<PreferenceViewProps,
  | 'initialMessages'
  | 'initialLogViewerMessages'
  | 'initialLocale'
>;

/** Coordinates preference state behavior for this View. */
export function usePreferenceState({
  initialMessages,
  initialLogViewerMessages,
  initialLocale,
}: PreferenceStateOptions) {
  const [savedPreferences, setSavedPreferences] = useState<PreferenceState>();

  const [draftPreferences, setDraftPreferences] = useState<PreferenceState>();

  const [runtimeBundles, setRuntimeBundles] = useState<BundleRuntimeInfo[]>([]);

  const [bundles, setBundles] = useState<BundleInfo[]>([]);

  const [appInfo, setAppInfo] = useState<ApplicationInfo>();

  const [displays, setDisplays] = useState<DisplayInfo[]>([]);

  const [developerYouTubeStatus, setDeveloperYouTubeStatus] =
    useState<DeveloperYouTubeStatus>();

  const [developmentState, setDevelopmentState] = useState<DevelopmentState>();

  const [developmentActionId, setDevelopmentActionId] = useState<string>();

  const [developmentNotice, setDevelopmentNotice] = useState<string>();

  const [updateCheckResult, setUpdateCheckResult] =
    useState<ApplicationUpdateCheckResult>();

  const [checkingUpdates, setCheckingUpdates] = useState(false);

  const [installingBundle, setInstallingBundle] = useState(false);

  const [bundleActionId, setBundleActionId] = useState<string>();

  const [bundleNotice, setBundleNotice] = useState<string>();

  const [dataActionId, setDataActionId] = useState<string>();

  const [dataNotice, setDataNotice] = useState<string>();

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string>();

  const [shortcutConflict, setShortcutConflict] =
    useState<ShortcutConflict>();

  const [graphicsRestartRequest, setGraphicsRestartRequest] =
    useState<GraphicsMode>();

  const [menuOrderEditorOpen, setMenuOrderEditorOpen] = useState(false);

  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);

  const [bundleTabActivation, setBundleTabActivation] = useState(0);

  const [messages, setMessages] = useState(initialMessages);

  const [logViewerMessages, setLogViewerMessages] = useState(
    initialLogViewerMessages,
  );

  const [resolvedLocale, setResolvedLocale] = useState(initialLocale);

  const [logViewerOpen, setLogViewerOpen] = useState(false);

  return {
    /** The savedPreferences value. */
    savedPreferences,
    /** The setSavedPreferences value. */
    setSavedPreferences,
    /** The draftPreferences value. */
    draftPreferences,
    /** The setDraftPreferences value. */
    setDraftPreferences,
    /** The runtimeBundles value. */
    runtimeBundles,
    /** The setRuntimeBundles value. */
    setRuntimeBundles,
    /** The bundles value. */
    bundles,
    /** The setBundles value. */
    setBundles,
    /** The appInfo value. */
    appInfo,
    /** The setAppInfo value. */
    setAppInfo,
    /** The displays value. */
    displays,
    /** The setDisplays value. */
    setDisplays,
    /** The developerYouTubeStatus value. */
    developerYouTubeStatus,
    /** The setDeveloperYouTubeStatus value. */
    setDeveloperYouTubeStatus,
    /** The developmentState value. */
    developmentState,
    /** The setDevelopmentState value. */
    setDevelopmentState,
    /** The developmentActionId value. */
    developmentActionId,
    /** The setDevelopmentActionId value. */
    setDevelopmentActionId,
    /** The developmentNotice value. */
    developmentNotice,
    /** The setDevelopmentNotice value. */
    setDevelopmentNotice,
    /** The updateCheckResult value. */
    updateCheckResult,
    /** The setUpdateCheckResult value. */
    setUpdateCheckResult,
    /** The checkingUpdates value. */
    checkingUpdates,
    /** The setCheckingUpdates value. */
    setCheckingUpdates,
    /** The installingBundle value. */
    installingBundle,
    /** The setInstallingBundle value. */
    setInstallingBundle,
    /** The bundleActionId value. */
    bundleActionId,
    /** The setBundleActionId value. */
    setBundleActionId,
    /** The bundleNotice value. */
    bundleNotice,
    /** The setBundleNotice value. */
    setBundleNotice,
    /** The dataActionId value. */
    dataActionId,
    /** The setDataActionId value. */
    setDataActionId,
    /** The dataNotice value. */
    dataNotice,
    /** The setDataNotice value. */
    setDataNotice,
    /** The saving value. */
    saving,
    /** The setSaving value. */
    setSaving,
    /** The error value. */
    error,
    /** The setError value. */
    setError,
    /** The shortcutConflict value. */
    shortcutConflict,
    /** The setShortcutConflict value. */
    setShortcutConflict,
    /** The graphicsRestartRequest value. */
    graphicsRestartRequest,
    /** The setGraphicsRestartRequest value. */
    setGraphicsRestartRequest,
    /** The menuOrderEditorOpen value. */
    menuOrderEditorOpen,
    /** The setMenuOrderEditorOpen value. */
    setMenuOrderEditorOpen,
    /** The discardConfirmationOpen value. */
    discardConfirmationOpen,
    /** The setDiscardConfirmationOpen value. */
    setDiscardConfirmationOpen,
    /** The bundleTabActivation value. */
    bundleTabActivation,
    /** The setBundleTabActivation value. */
    setBundleTabActivation,
    /** The messages value. */
    messages,
    /** The setMessages value. */
    setMessages,
    /** The logViewerMessages value. */
    logViewerMessages,
    /** The setLogViewerMessages value. */
    setLogViewerMessages,
    /** The resolvedLocale value. */
    resolvedLocale,
    /** The setResolvedLocale value. */
    setResolvedLocale,
    /** The logViewerOpen value. */
    logViewerOpen,
    /** The setLogViewerOpen value. */
    setLogViewerOpen,
  };
}
