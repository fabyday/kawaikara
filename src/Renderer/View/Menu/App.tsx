import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Button,
  Flex,
  Head,
  KawaiProvider,
  Panel,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';
import type {
  ApplicationUpdatePanelState,
  AppMessages,
  AppTheme,
  OverlayView,
  PictureInPictureMode,
  PictureInPictureStatus,
  PreferenceState,
  RendererMessages,
  SiteMenuItem,
} from '../../../Common/IPC';
import { ActivityBorder } from '../../Component/ActivityBorder';
import { GearIcon } from '../../Component/GearIcon';
import {
  AUTO_HIDE_SCROLLBAR_DELAY_MS,
  AutoHideScrollArea,
} from '../../Component/AutoHideScrollArea';
import { PictureInPictureButton } from '../../Component/PictureInPictureButton';
import { SiteIcon, SiteIconCache } from '../../Component/SiteIcon';
import { SiteMenuButton } from '../../Component/SiteMenuButton';
import {
  createOrderedSiteGroups,
  getDefaultMenuCategoryShortcut,
  getMenuCategoryShortcutId,
  isApplePlatform,
  matchesKeyboardAccelerator,
} from '../../Domain/MenuOrder';
import { PreferenceView } from '../Preference/App';
import { UpdatePanel } from '../Update/UpdatePanel';
import { PluginViewHost } from './PluginViewHost';

/** Performs the app operation. */
export function App() {
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
  const [shortcutTargetCategory, setShortcutTargetCategory] = useState<string>();
  const [sitePanelRefreshKey, setSitePanelRefreshKey] = useState(0);
  const [address, setAddress] = useState('');
  const [addressFocused, setAddressFocused] = useState(false);
  const [addressError, setAddressError] = useState(false);
  const [addressFailureKey, setAddressFailureKey] = useState(0);
  const [addressLoading, setAddressLoading] = useState(false);
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
  const categoryElements = useRef(new Map<string, HTMLElement>());
  const viewRef = useRef<OverlayView>('menu');
  const preferenceReturnPending = useRef(false);
  const preferenceBackHandler = useRef<(() => void) | undefined>(undefined);
  const updateStateRef = useRef<ApplicationUpdatePanelState | undefined>(undefined);
  const updatePanelViewRef = useRef<'status' | 'release-notes'>('status');
  const reduceMotion = useReducedMotion();

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
      window.kawaikara.preferences.get(),
      window.kawaikara.application.getMessages(),
    ])
      .then(([nextSites, nextAddress, nextPreferences, nextLocalization]) => {
        setSites(nextSites);
        setAddress(nextAddress);
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
      setMenuVisible(true);
      setSitePanelRefreshKey((current) => current + 1);
      void Promise.all([
        window.kawaikara.sites.list(),
        window.kawaikara.sites.currentAddress(),
        window.kawaikara.preferences.get(),
        window.kawaikara.application.getMessages(),
      ]).then(([nextSites, nextAddress, nextPreferences, nextLocalization]) => {
        setSites(nextSites);
        setAddress(nextAddress);
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

  const messages = localization?.app as AppMessages;

  const groups = useMemo(() => {
    return createOrderedSiteGroups(sites, preferences);
  }, [preferences, sites]);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedId),
    [selectedId, sites],
  );

  const addressSuggestions = useMemo(
    () => createAddressSuggestions(sites, address),
    [address, sites],
  );
  const addressSuggestionsVisible =
    addressFocused &&
    !addressSuggestionsDismissed &&
    addressSuggestions.length > 0;

  useEffect(() => {
    if (pipFailureKey === 0) return;
    if (pipFailureTimer.current !== undefined) {
      window.clearTimeout(pipFailureTimer.current);
    }
    pipFailureTimer.current = window.setTimeout(() => {
      pipFailureTimer.current = undefined;
      setPipFailureKey(0);
    }, 420);
  }, [pipFailureKey]);

  const handleSitePanelError = useCallback((message: string) => {
    setError(message);
  }, []);
  const handlePreferenceMessagesChange = useCallback(
    (nextMessages: AppMessages) => {
      setLocalization((current) => current
        ? { ...current, app: nextMessages
        }
        : current);
    },
    [],
  );

  useEffect(() => {
    if (!menuVisible || view !== 'menu' || !preferences) return;
    /** Handles the category shortcut. */
    const handleCategoryShortcut = (event: KeyboardEvent) => {
      // This listener runs in the capture phase, before the address input's
      // own key handler. Check the event target directly instead of waiting
      // for the asynchronous Main-process editable-focus report.
      if (isEditableKeyboardTarget(event.target)) return;
      const target = groups.find(([category], index) => {
        const shortcut =
          preferences.shortcuts[getMenuCategoryShortcutId(category)] ??
          getDefaultMenuCategoryShortcut(index);
        return matchesKeyboardAccelerator(event, shortcut);
      });
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      const category = target[0];
      categoryElements.current.get(category)?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      setShortcutTargetCategory(category);
      if (shortcutHighlightTimer.current !== undefined) {
        window.clearTimeout(shortcutHighlightTimer.current);
      }
      shortcutHighlightTimer.current = window.setTimeout(() => {
        shortcutHighlightTimer.current = undefined;
        setShortcutTargetCategory(undefined);
      }, AUTO_HIDE_SCROLLBAR_DELAY_MS);
    };
    window.addEventListener('keydown', handleCategoryShortcut, true);
    return () => window.removeEventListener('keydown', handleCategoryShortcut, true);
  }, [groups, menuVisible, preferences, reduceMotion, view]);

  useEffect(() => {
    if (!menuVisible || view !== 'menu') return;
    /** Performs the focus address operation. */
    const focusAddress = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'l' ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      addressInputRef.current?.focus();
      addressInputRef.current?.select();
    };
    window.addEventListener('keydown', focusAddress, true);
    return () => window.removeEventListener('keydown', focusAddress, true);
  }, [menuVisible, view]);

  /** Opens the site. */
  const openSite = async (id: string) => {
    const previousId = selectedId;
    setSelectedId(id);
    setError(undefined);
    try {
      await window.kawaikara.sites.open(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setSelectedId(previousId);
    }
  };

  /** Performs the begin menu close operation. */
  const beginMenuClose = () => {
    if (closeTimer.current !== undefined) return;
    setMenuVisible(false);
    closeTimer.current = window.setTimeout(
      () => {
        closeTimer.current = undefined;
        setView('menu');
        void window.kawaikara.overlay.close();
      },
      reduceMotion ? 0 : 190,
    );
  };

  /** Closes the overlay. */
  const closeOverlay = () => {
    if (view === 'menu') {
      beginMenuClose();
      return;
    }
    setView('menu');
    void window.kawaikara.overlay.close();
  };

  /** Toggles the picture in picture. */
  const togglePictureInPicture = async () => {
    setPipLoading(true);
    setError(undefined);
    try {
      const result = await window.kawaikara.media.togglePictureInPicture();
      if (result.status === 'entered') {
        setPipMode(result.mode);
        return;
      }
      if (result.status === 'exited') {
        setPipMode(undefined);
        return;
      }
      setPipMode(undefined);
      setError(getPictureInPictureError(result.status, messages));
      setPipFailureKey((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : messages.pipFailed);
      setPipFailureKey((current) => current + 1);
    } finally {
      setPipLoading(false);
    }
  };

  /** Toggles the always on top. */
  const toggleAlwaysOnTop = async () => {
    if (!preferences) return;
    const previous = preferences;
    const alwaysOnTop = !previous.alwaysOnTop;
    setError(undefined);
    // Reflect the press immediately so the activity border never waits for a
    // disk-backed preference round trip before starting its animation.
    setPreferences({ ...previous, alwaysOnTop
    });
    try {
      setPreferences(
        await window.kawaikara.preferences.update({
          alwaysOnTop,
        }),
      );
    } catch (reason) {
      setPreferences(previous);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  /** Opens the address value. */
  const openAddressValue = async (value: string) => {
    if (addressLoading) return;
    setAddressLoading(true);
    setAddressError(false);
    setAddressSuggestionsDismissed(true);
    try {
      const result = await window.kawaikara.sites.openAddress(value);
      if (result.status === 'unsupported') {
        setAddressError(true);
        setAddressFailureKey((current) => current + 1);
        window.requestAnimationFrame(() => addressInputRef.current?.focus());
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setAddressLoading(false);
    }
  };

  /** Opens the address. */
  const openAddress = async (event: FormEvent) => {
    event.preventDefault();
    await openAddressValue(address);
  };

  /** Copies the address. */
  const copyAddress = async () => {
    const value = address.trim();
    if (!value) return;
    try {
      await window.kawaikara.application.copyText(value);
      setAddressCopied(true);
      if (addressCopiedTimer.current !== undefined) {
        window.clearTimeout(addressCopiedTimer.current);
      }
      addressCopiedTimer.current = window.setTimeout(() => {
        addressCopiedTimer.current = undefined;
        setAddressCopied(false);
      }, 1_400);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  /** Performs the navigate address history operation. */
  const navigateAddressHistory = async (direction: 'back' | 'forward') => {
    try {
      const moved = direction === 'back'
        ? await window.kawaikara.sites.goBack()
        : await window.kawaikara.sites.goForward();
      if (!moved) return;
      setAddressSuggestionsDismissed(true);
      // NavigationHistory updates immediately, while the committed URL follows
      // asynchronously. Read it after the next renderer turn.
      window.setTimeout(() => {
        void window.kawaikara.sites.currentAddress().then(setAddress);
      }, 120);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  /** Performs the choose address suggestion operation. */
  const chooseAddressSuggestion = (suggestion: AddressSuggestion) => {
    setAddress(suggestion.host);
    setAddressError(false);
    setAddressSuggestionsDismissed(true);
    setActiveAddressSuggestion(0);
    addressInputRef.current?.focus();
  };

  /** Sets the overlay view. */
  const setOverlayView = (nextView: OverlayView) => {
    if (nextView === 'preference' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (nextView === 'menu' && viewRef.current === 'preference') {
      preferenceReturnPending.current = true;
      setSkipMenuEntryAnimation(true);
      setMenuVisible(true);
    }
    viewRef.current = nextView;
    setView(nextView);
    void window.kawaikara.overlay.setView(nextView).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  };

  /** Performs the dismiss update operation. */
  const dismissUpdate = () => {
    if (updateStateRef.current?.origin === 'manual') {
      setOverlayView('preference');
    } else {
      void window.kawaikara.overlay.close();
    }
  };

  /** Performs the retry update operation. */
  const retryUpdate = async () => {
    await window.kawaikara.application.checkForUpdates();
  };

  if (!localization) return null;

  const addressHelp = messages.addressHelp.replace(
    '{shortcut}',
    isApplePlatform() ? 'Cmd+L' : 'Ctrl+L',
  );

  const manualUpdateVisible =
    view === 'update' && updateState?.origin === 'manual';

  return (
    <KawaiProvider>
      <SiteIconCache sites={sites} />
      <AnimatePresence initial={false}>
        {(menuVisible && view === 'menu') ||
        view === 'preference' ||
        manualUpdateVisible ? (
          <motion.main
            animate={{ opacity: 1
            }}
            className={`kawai-theme ${
              (previewTheme ?? preferences?.appTheme ?? 'dark') === 'dark'
                ? 'kawai-theme-dark'
                : 'kawai-theme-light'
            } menu-shell${
              view === 'preference' || manualUpdateVisible
                ? ' is-preference-underlay'
                : ''
            }`}
            inert={view === 'preference' || manualUpdateVisible ? true : undefined}
            key="menu-shell"
            exit={{
              opacity: 0,
              transition: reduceMotion
                ? { duration: 0
                }
                : { duration: 0.2, ease: [0.4, 0, 1, 1]
                },
            }}
            initial={false}
            transition={
              reduceMotion
                ? { duration: 0
                }
                : {
                    opacity: { duration: 0.24, ease: 'easeOut'
                    },
                  }
            }
          >
        <div
          className="menu-layout"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) beginMenuClose();
          }}
        >
        <motion.div
          animate={{ opacity: 1, x: 0
          }}
          className="menu-rail-motion"
          exit={{
            opacity: reduceMotion ? 0 : 1,
            x: reduceMotion ? 0 : '-112%',
          }}
          initial={
            skipMenuEntryAnimation || view === 'preference'
              ? false
              : {
                  opacity: reduceMotion ? 1 : 0.82,
                  x: reduceMotion ? 0 : '-112%',
                }
          }
          transition={
            reduceMotion
              ? { duration: 0
              }
              : {
                  x: { type: 'spring', stiffness: 390, damping: 38, mass: 0.82
                  },
                  opacity: { duration: 0.14
                  },
                }
          }
        >
        <Panel className="menu-panel" padding="md" radius="lg">
          <Flex align="center" justify="between" gap="sm">
            <div>
              <Head level={1} size="md">
                Kawaikara
              </Head>
              <Text size="xs" tone="muted">
                {messages.chooseSite}
              </Text>
            </div>
            <Flex align="center" gap="xs">
              {(selectedSite?.pictureInPictureEnabled ?? true) ? (
                <PictureInPictureButton
                  active={pipMode !== undefined}
                  failureKey={pipFailureKey}
                  isLoading={pipLoading}
                  label={messages.pictureInPicture}
                  shortLabel="PiP"
                  onPress={() => void togglePictureInPicture()}
                />
              ) : null}
              <Button
                aria-label={messages.alwaysOnTop}
                aria-pressed={preferences?.alwaysOnTop ?? false}
                className={`overlay-icon-button always-on-top-button${
                  preferences?.alwaysOnTop ? ' is-active' : ''
                }`}
                size="icon"
                title={messages.alwaysOnTop}
                variant="ghost"
                onClick={() => void toggleAlwaysOnTop()}
              >
                <AlwaysOnTopIcon />
                <ActivityBorder running={preferences?.alwaysOnTop ?? false} />
              </Button>
              <Button
                className="overlay-icon-button"
                aria-label={messages.openPreferences}
                size="icon"
                variant="ghost"
                onClick={() => setOverlayView('preference')}
              >
                <GearIcon />
              </Button>
              <Button
                className="overlay-icon-button overlay-close-button"
                aria-label={messages.closeMenu}
                size="icon"
                variant="ghost"
                onClick={closeOverlay}
              >
                <span aria-hidden="true" className="overlay-button-glyph">×</span>
              </Button>
            </Flex>
          </Flex>

          <div
            aria-live="polite"
            className={`menu-notice-slot${error ? ' has-error' : ''}`}
            role="status"
          >
            {error ?? ''}
          </div>

          <AutoHideScrollArea
            className="site-list"
            forceScrollbarVisible={shortcutTargetCategory !== undefined}
            label="Available sites"
          >
            <Stack gap="md">
              {groups.map(([category, items], categoryIndex) => {
                const shortcut =
                  preferences?.shortcuts[getMenuCategoryShortcutId(category)] ??
                  getDefaultMenuCategoryShortcut(categoryIndex);
                return (
                <section
                  className={`menu-category${
                    shortcutTargetCategory === category ? ' is-shortcut-target' : ''
                  }`}
                  key={category}
                  ref={(element) => {
                    if (element) categoryElements.current.set(category, element);
                    else categoryElements.current.delete(category);
                  }}
                >
                  <Flex align="center" justify="between" gap="sm">
                    <Text
                      className="category-title"
                      size="xs"
                      tone="muted"
                      weight="semibold"
                    >
                      {messages.categoryLabels[category] ?? category}
                    </Text>
                    {shortcut ? (
                      <kbd className="category-shortcut-badge">{shortcut}</kbd>
                    ) : null}
                  </Flex>
                  <Stack gap="xs">
                    {items.map((site) => (
                      <SiteMenuButton
                        isSelected={selectedId === site.id}
                        key={site.id}
                        selectedLabel={messages.selected}
                        site={site}
                        onOpen={openSite}
                      />
                    ))}
                  </Stack>
                </section>
                );
              })}
            </Stack>
          </AutoHideScrollArea>

          <Text className="menu-hint" size="xs" tone="muted">
            {messages.menuHint}
          </Text>
        </Panel>
        </motion.div>
        <motion.div
          animate={{ opacity: 1
          }}
          className={`menu-context-area${
            selectedSite?.panels.length ? ' has-site-panel' : ''
          }`}
          exit={{ opacity: 0
          }}
          initial={
            skipMenuEntryAnimation || view === 'preference' || reduceMotion
              ? false
              : { opacity: 0
              }
          }
          key={selectedSite?.id ?? 'empty-site-panel'}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) beginMenuClose();
          }}
          transition={
            reduceMotion
              ? { duration: 0
              }
              : { duration: 0.28, delay: 0.07, ease: 'easeOut'
              }
          }
        >
          <section className="menu-address-section">
            <form
              className={`menu-address-form${addressError ? ' has-error' : ''}`}
              key={addressFailureKey}
              onSubmit={(event) => void openAddress(event)}
            >
              <div className="menu-address-navigation">
                <button
                  aria-label={messages.goBack}
                  title={messages.goBack}
                  type="button"
                  onClick={() => void navigateAddressHistory('back')}
                >
                  <span aria-hidden="true">←</span>
                </button>
                <button
                  aria-label={messages.goForward}
                  title={messages.goForward}
                  type="button"
                  onClick={() => void navigateAddressHistory('forward')}
                >
                  <span aria-hidden="true">→</span>
                </button>
              </div>
              <input
                aria-activedescendant={
                  addressSuggestionsVisible
                    ? `kawaikara-address-suggestion-${activeAddressSuggestion}`
                    : undefined
                }
                aria-autocomplete="list"
                aria-controls="kawaikara-address-suggestions"
                aria-expanded={addressSuggestionsVisible}
                aria-invalid={addressError}
                disabled={addressLoading}
                placeholder={messages.addressPlaceholder}
                ref={addressInputRef}
                role="combobox"
                spellCheck={false}
                type="text"
                value={addressFocused ? address : formatAddressForDisplay(address)}
                onChange={(event) => {
                  setAddress(event.currentTarget.value);
                  setAddressError(false);
                  setAddressCopied(false);
                  setAddressSuggestionsDismissed(false);
                  setActiveAddressSuggestion(0);
                }}
                onFocus={(event) => {
                  const input = event.currentTarget;
                  setAddressFocused(true);
                  setAddressSuggestionsDismissed(false);
                  setActiveAddressSuggestion(0);
                  window.requestAnimationFrame(() => input.select());
                }}
                onBlur={() => setAddressFocused(false)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    if (addressSuggestions.length === 0) return;
                    event.preventDefault();
                    setAddressSuggestionsDismissed(false);
                    setActiveAddressSuggestion((current) => {
                      const direction = event.key === 'ArrowDown' ? 1 : -1;
                      return (
                        current + direction + addressSuggestions.length
                      ) % addressSuggestions.length;
                    });
                    return;
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    setAddressSuggestionsDismissed(true);
                    const input = event.currentTarget;
                    if (
                      input.selectionStart === 0 &&
                      input.selectionEnd === input.value.length
                    ) {
                      const caret = input.value.length;
                      input.setSelectionRange(caret, caret);
                    }
                    return;
                  }
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  const suggestion = addressSuggestionsVisible
                    ? addressSuggestions[activeAddressSuggestion]
                    : undefined;
                  if (suggestion) {
                    setAddress(suggestion.host);
                    void openAddressValue(suggestion.host);
                  } else {
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                aria-label={messages.addressGo}
                disabled={addressLoading || !address.trim()}
                title={messages.addressGo}
                type="submit"
              >
                <span aria-hidden="true">↗</span>
              </button>
              <button
                aria-label={messages.copyAddress}
                className={addressCopied ? 'is-copied' : undefined}
                disabled={!address.trim()}
                title={messages.copyAddress}
                type="button"
                onClick={() => void copyAddress()}
              >
                {addressCopied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </form>
            <p className={addressError ? 'is-error' : ''}>
              {addressError
                ? messages.unsupportedAddress
                : addressCopied
                  ? messages.addressCopied
                  : addressHelp}
            </p>
            {addressSuggestionsVisible ? (
              <div
                aria-label={messages.addressPlaceholder}
                className="menu-address-suggestions"
                id="kawaikara-address-suggestions"
                role="listbox"
              >
                {addressSuggestions.map((suggestion, index) => (
                  <button
                    aria-selected={index === activeAddressSuggestion}
                    className={
                      index === activeAddressSuggestion ? 'is-active' : undefined
                    }
                    id={`kawaikara-address-suggestion-${index}`}
                    key={`${suggestion.site.id}:${suggestion.host}`}
                    role="option"
                    type="button"
                    onClick={() => chooseAddressSuggestion(suggestion)}
                    onMouseEnter={() => setActiveAddressSuggestion(index)}
                    onPointerDown={(event) => event.preventDefault()}
                  >
                    <SiteIcon site={suggestion.site} />
                    <span className="menu-address-suggestion-copy">
                      <strong>{suggestion.site.title}</strong>
                      <small>{suggestion.host}</small>
                    </span>
                    <span aria-hidden="true" className="menu-address-suggestion-arrow">
                      ↗
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
          <div
            className="menu-plugin-host"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) beginMenuClose();
            }}
          >
            {selectedSite?.panels.length && preferences ? (
              <PluginViewHost
                locale={localization.locale}
                panels={selectedSite.panels}
                refreshKey={sitePanelRefreshKey}
                videoLibraryLabels={localization.videoLibrary}
                onError={handleSitePanelError}
              />
            ) : null}
          </div>
        </motion.div>
        </div>
          </motion.main>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {view === 'preference' || manualUpdateVisible ? (
          <motion.div
            animate={{ opacity: 1, y: 0
            }}
            className="preference-motion-shell"
            inert={manualUpdateVisible ? true : undefined}
            exit={{ opacity: 1, y: reduceMotion ? 0 : '-100%'
            }}
            initial={{
              opacity: 1,
              y: reduceMotion ? 0 : '-100%',
            }}
            transition={
              reduceMotion
                ? { duration: 0
                }
                : {
                    y: { duration: 0.42, ease: [0.22, 1, 0.36, 1]
                    },
                    opacity: { duration: 0.32, ease: 'easeOut'
                    },
                  }
            }
          >
            <PreferenceView
              initialMessages={messages}
              sites={sites}
              onBackHandlerChange={(handler) => {
                preferenceBackHandler.current = handler;
              }}
              onBack={() => {
                setPreviewTheme(undefined);
                setOverlayView('menu');
              }}
              onMessagesChange={handlePreferenceMessagesChange}
              onPreferencesChange={setPreferences}
              onThemePreview={setPreviewTheme}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {view === 'update' && updateState ? (
          <motion.div
            animate={{ opacity: 1
            }}
            className={`kawai-theme ${
              (previewTheme ?? preferences?.appTheme ?? 'dark') === 'dark'
                ? 'kawai-theme-dark'
                : 'kawai-theme-light'
            } update-motion-shell`}
            exit={{ opacity: 0
            }}
            initial={{ opacity: 0
            }}
            transition={{ duration: reduceMotion ? 0 : 0.2
            }}
          >
            <UpdatePanel
              locale={localization.locale}
              state={updateState}
              view={updatePanelView}
              onDismiss={dismissUpdate}
              onDownload={async () => {
                await window.kawaikara.application.downloadUpdate();
              }}
              onInstall={() => window.kawaikara.application.installUpdate()}
              onRetry={retryUpdate}
              onViewChange={(nextView) => {
                setUpdatePanelView(nextView);
                updatePanelViewRef.current = nextView;
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </KawaiProvider>
  );
}

/** Returns the picture in picture error. */
function getPictureInPictureError(
  status: PictureInPictureStatus,
  messages: AppMessages,
): string {
  switch (status) {
    case 'no-video':
      return messages.pipNoVideo;
    case 'not-ready':
      return messages.pipNotReady;
    case 'disabled':
      return messages.pipDisabled;
    case 'unsupported':
      return messages.pipUnsupported;
    case 'failed':
      return messages.pipFailed;
    case 'entered':
    case 'exited':
      return '';
  }
}

/** Formats the address for display. */
function formatAddressForDisplay(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return value;
    const hostname = url.hostname.replace(/^www\./i, '');
    const path = url.pathname === '/' ? '' : url.pathname;
    return `${hostname}${url.port ? `:${url.port}` : ''}${path}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}

/** Describes the address suggestion contract. */
interface AddressSuggestion {
  /** The host value. */
  readonly host: string;
  /** The site value. */
  readonly site: SiteMenuItem;
}

/** Creates the address suggestions. */
function createAddressSuggestions(
  sites: readonly SiteMenuItem[],
  value: string,
): AddressSuggestion[] {
  const query = normalizeAddressSuggestionQuery(value);
  const seenHosts = new Set<string>();
  return sites
    .flatMap((site) => site.addressHosts.map((host) => ({
      host: host.toLowerCase(),
      site,
    })))
    .filter(({ host, site }) => {
      if (seenHosts.has(host)) return false;
      if (
        query &&
        !host.includes(query) &&
        !site.title.toLowerCase().includes(query)
      ) {
        return false;
      }
      seenHosts.add(host);
      return true;
    })
    .sort((left, right) => {
      const leftScore = addressSuggestionScore(left, query);
      const rightScore = addressSuggestionScore(right, query);
      return leftScore - rightScore || left.site.title.localeCompare(right.site.title);
    })
    .slice(0, 8);
}

/** Normalizes the address suggestion query. */
function normalizeAddressSuggestionQuery(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  try {
    const parsed = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (parsed.protocol === 'kawaikara:') {
      const nested = parsed.searchParams.get('url');
      return nested ? normalizeAddressSuggestionQuery(nested) : '';
    }
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return trimmed
      .replace(/^[a-z][a-z\d+.-]*:\/\//i, '')
      .replace(/^www\./, '')
      .split(/[/?#]/, 1)[0] ?? '';
  }
}

/** Performs the address suggestion score operation. */
function addressSuggestionScore(
  suggestion: AddressSuggestion,
  query: string,
): number {
  if (!query) return 4;
  if (suggestion.host === query) return 0;
  if (suggestion.host.startsWith(query)) return 1;
  if (suggestion.site.title.toLowerCase().startsWith(query)) return 2;
  return 3;
}

/** Determines whether the editable keyboard target condition applies. */
function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest([
    'input',
    'textarea',
    'select',
    '[contenteditable]:not([contenteditable="false"])',
    '[role="textbox"]',
    '[role="searchbox"]',
    '[role="combobox"]',
    '[role="spinbutton"]',
  ].join(',')));
}

/** Copies the icon. */
function CopyIcon() {
  return (
    <svg aria-hidden="true" className="menu-address-action-icon" viewBox="0 0 24 24">
      <rect height="11" rx="2" width="11" x="8" y="8" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

/** Performs the check icon operation. */
function CheckIcon() {
  return (
    <svg aria-hidden="true" className="menu-address-action-icon" viewBox="0 0 24 24">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

/** Performs the always on top icon operation. */
function AlwaysOnTopIcon() {
  return (
    <svg className="always-on-top-icon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 4h8l-1.2 5 2.7 2.7v1.8H6.5v-1.8L9.2 9 8 4Z" />
      <path d="M12 13.5V21" />
    </svg>
  );
}
