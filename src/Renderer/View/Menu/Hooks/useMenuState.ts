import { useReducedMotion } from 'motion/react';
import {
  useRef,
  useState
} from 'react';
import type {
  ApplicationUpdatePanelState,
  AppTheme,
  OverlayView,
  PictureInPictureMode,
  PreferenceState,
  RendererMessages,
  SiteMenuItem,
  SiteNavigationState
} from '../../../../Common/IPC';

/** Coordinates menu state behavior for this View. */
export function useMenuState() {
  const [sites, setSites] = useState<SiteMenuItem[]>([]);

  const [preferences, setPreferences] = useState<PreferenceState>();

  const [localization, setLocalization] = useState<RendererMessages>();

  const [view, setView] = useState<OverlayView>('menu');

  const [selectedId, setSelectedId] = useState<string>();

  const [error, setError] = useState<string>();

  const [pipMode, setPipMode] = useState<PictureInPictureMode>();

  const [pipLoading, setPipLoading] = useState(false);

  const [pipFailureKey, setPipFailureKey] = useState(0);

  const [menuVisible, setMenuVisible] = useState(false);

  const [skipMenuEntryAnimation, setSkipMenuEntryAnimation] = useState(false);

  const [menuEntrySequence, setMenuEntrySequence] = useState(0);

  const [shortcutTargetCategory, setShortcutTargetCategory] = useState<string>();

  const [kawaiShortcutPage, setKawaiShortcutPage] = useState(0);

  const [sitePanelRefreshKey, setSitePanelRefreshKey] = useState(0);

  const [address, setAddress] = useState('');

  const [addressFocused, setAddressFocused] = useState(false);

  const [addressError, setAddressError] = useState(false);

  const [addressFailureKey, setAddressFailureKey] = useState(0);

  const [addressLoading, setAddressLoading] = useState(false);

  const [navigationLoading, setNavigationLoading] = useState(false);

  const [navigationState, setNavigationState] = useState<SiteNavigationState>({
    canGoBack: false,
    canGoForward: false,
  });

  const [addressSuggestionsDismissed, setAddressSuggestionsDismissed] =
    useState(false);

  const [activeAddressSuggestion, setActiveAddressSuggestion] = useState(0);

  const [addressCopied, setAddressCopied] = useState(false);

  const [previewTheme, setPreviewTheme] = useState<AppTheme>();

  const [updateState, setUpdateState] = useState<ApplicationUpdatePanelState>();

  const [updatePanelView, setUpdatePanelView] = useState<
    'status' | 'release-notes'
  >('status');

  const addressInputRef = useRef<HTMLInputElement>(null);

  const closeTimer = useRef<number | undefined>(undefined);

  const pipFailureTimer = useRef<number | undefined>(undefined);

  const addressCopiedTimer = useRef<number | undefined>(undefined);

  const shortcutHighlightTimer = useRef<number | undefined>(undefined);

  const kawaiShortcutActiveRef = useRef(false);

  const categoryElements = useRef(new Map<string, HTMLElement>());

  const viewRef = useRef<OverlayView>('menu');

  const preferenceReturnPending = useRef(false);

  const preferenceBackHandler = useRef<(() => void) | undefined>(undefined);

  const updateStateRef = useRef<ApplicationUpdatePanelState | undefined>(undefined);

  const updatePanelViewRef = useRef<'status' | 'release-notes'>('status');

  const reduceMotion = useReducedMotion();

  return {
    /** The sites value. */
    sites,
    /** The setSites value. */
    setSites,
    /** The preferences value. */
    preferences,
    /** The setPreferences value. */
    setPreferences,
    /** The localization value. */
    localization,
    /** The setLocalization value. */
    setLocalization,
    /** The view value. */
    view,
    /** The setView value. */
    setView,
    /** The selectedId value. */
    selectedId,
    /** The setSelectedId value. */
    setSelectedId,
    /** The error value. */
    error,
    /** The setError value. */
    setError,
    /** The pipMode value. */
    pipMode,
    /** The setPipMode value. */
    setPipMode,
    /** The pipLoading value. */
    pipLoading,
    /** The setPipLoading value. */
    setPipLoading,
    /** The pipFailureKey value. */
    pipFailureKey,
    /** The setPipFailureKey value. */
    setPipFailureKey,
    /** The menuVisible value. */
    menuVisible,
    /** The setMenuVisible value. */
    setMenuVisible,
    /** The skipMenuEntryAnimation value. */
    skipMenuEntryAnimation,
    /** The setSkipMenuEntryAnimation value. */
    setSkipMenuEntryAnimation,
    /** The menuEntrySequence value. */
    menuEntrySequence,
    /** The setMenuEntrySequence value. */
    setMenuEntrySequence,
    /** The shortcutTargetCategory value. */
    shortcutTargetCategory,
    /** The setShortcutTargetCategory value. */
    setShortcutTargetCategory,
    /** The current ten-site Kawai Shortcut page. */
    kawaiShortcutPage,
    /** Updates the current ten-site Kawai Shortcut page. */
    setKawaiShortcutPage,
    /** The sitePanelRefreshKey value. */
    sitePanelRefreshKey,
    /** The setSitePanelRefreshKey value. */
    setSitePanelRefreshKey,
    /** The address value. */
    address,
    /** The setAddress value. */
    setAddress,
    /** The addressFocused value. */
    addressFocused,
    /** The setAddressFocused value. */
    setAddressFocused,
    /** The addressError value. */
    addressError,
    /** The setAddressError value. */
    setAddressError,
    /** The addressFailureKey value. */
    addressFailureKey,
    /** The setAddressFailureKey value. */
    setAddressFailureKey,
    /** The addressLoading value. */
    addressLoading,
    /** The setAddressLoading value. */
    setAddressLoading,
    /** The navigationLoading value. */
    navigationLoading,
    /** The setNavigationLoading value. */
    setNavigationLoading,
    /** The navigationState value. */
    navigationState,
    /** The setNavigationState value. */
    setNavigationState,
    /** The addressSuggestionsDismissed value. */
    addressSuggestionsDismissed,
    /** The setAddressSuggestionsDismissed value. */
    setAddressSuggestionsDismissed,
    /** The activeAddressSuggestion value. */
    activeAddressSuggestion,
    /** The setActiveAddressSuggestion value. */
    setActiveAddressSuggestion,
    /** The addressCopied value. */
    addressCopied,
    /** The setAddressCopied value. */
    setAddressCopied,
    /** The previewTheme value. */
    previewTheme,
    /** The setPreviewTheme value. */
    setPreviewTheme,
    /** The updateState value. */
    updateState,
    /** The setUpdateState value. */
    setUpdateState,
    /** The updatePanelView value. */
    updatePanelView,
    /** The setUpdatePanelView value. */
    setUpdatePanelView,
    /** The addressInputRef value. */
    addressInputRef,
    /** The closeTimer value. */
    closeTimer,
    /** The pipFailureTimer value. */
    pipFailureTimer,
    /** The addressCopiedTimer value. */
    addressCopiedTimer,
    /** The shortcutHighlightTimer value. */
    shortcutHighlightTimer,
    /** Whether Main-process close requests should cancel Kawai Shortcut first. */
    kawaiShortcutActiveRef,
    /** The categoryElements value. */
    categoryElements,
    /** The viewRef value. */
    viewRef,
    /** The preferenceReturnPending value. */
    preferenceReturnPending,
    /** The preferenceBackHandler value. */
    preferenceBackHandler,
    /** The updateStateRef value. */
    updateStateRef,
    /** The updatePanelViewRef value. */
    updatePanelViewRef,
    /** The reduceMotion value. */
    reduceMotion,
  };
}
