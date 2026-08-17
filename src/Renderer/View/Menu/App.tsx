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
import { SiteMenuButton } from '../../Component/SiteMenuButton';
import {
  createOrderedSiteGroups,
  getDefaultMenuCategoryShortcut,
  getMenuCategoryShortcutId,
  matchesKeyboardAccelerator,
} from '../../Domain/MenuOrder';
import { PreferenceView } from '../Preference/App';
import { VideoLibraryMenuPanel } from './VideoLibraryMenuPanel';

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
  const [addressError, setAddressError] = useState(false);
  const [addressFailureKey, setAddressFailureKey] = useState(0);
  const [addressLoading, setAddressLoading] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<AppTheme>();
  const addressInputRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const pipFailureTimer = useRef<number | undefined>(undefined);
  const shortcutHighlightTimer = useRef<number | undefined>(undefined);
  const categoryElements = useRef(new Map<string, HTMLElement>());
  const viewRef = useRef<OverlayView>('menu');
  const preferenceReturnPending = useRef(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

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
    },
    [],
  );

  useEffect(() => {
    void Promise.all([
      window.kawaikara.sites.list(),
      window.kawaikara.preferences.get(),
      window.kawaikara.application.getMessages(),
    ])
      .then(([nextSites, nextPreferences, nextLocalization]) => {
        setSites(nextSites);
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
        window.kawaikara.preferences.get(),
        window.kawaikara.application.getMessages(),
      ]).then(([nextSites, nextPreferences, nextLocalization]) => {
        setSites(nextSites);
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
    const removeCloseListener = window.kawaikara.overlay.onRequestClose(() => {
      if (viewRef.current !== 'menu') {
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
        ? { ...current, app: nextMessages }
        : current);
    },
    [],
  );

  useEffect(() => {
    if (!menuVisible || view !== 'menu' || !preferences) return;
    const handleCategoryShortcut = (event: KeyboardEvent) => {
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

  const closeOverlay = () => {
    if (view === 'menu') {
      beginMenuClose();
      return;
    }
    setView('menu');
    void window.kawaikara.overlay.close();
  };

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

  const toggleAlwaysOnTop = async () => {
    if (!preferences) return;
    setError(undefined);
    try {
      setPreferences(
        await window.kawaikara.preferences.update({
          alwaysOnTop: !preferences.alwaysOnTop,
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const openAddress = async (event: FormEvent) => {
    event.preventDefault();
    if (addressLoading) return;
    setAddressLoading(true);
    setAddressError(false);
    try {
      const result = await window.kawaikara.sites.openAddress(address);
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

  if (!localization) return null;

  return (
    <KawaiProvider>
      <AnimatePresence initial={false}>
        {menuVisible || view === 'preference' ? (
          <motion.main
            animate={{ opacity: 1 }}
            className={`kawai-theme ${
              (previewTheme ?? preferences?.appTheme ?? 'dark') === 'dark'
                ? 'kawai-theme-dark'
                : 'kawai-theme-light'
            } menu-shell${
              view === 'preference' ? ' is-preference-underlay' : ''
            }`}
            inert={view === 'preference' ? true : undefined}
            key="menu-shell"
            exit={{
              opacity: 0,
              transition: reduceMotion
                ? { duration: 0 }
                : { duration: 0.2, ease: [0.4, 0, 1, 1] },
            }}
            initial={false}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    opacity: { duration: 0.24, ease: 'easeOut' },
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
          animate={{ opacity: 1, x: 0 }}
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
              ? { duration: 0 }
              : {
                  x: { type: 'spring', stiffness: 390, damping: 38, mass: 0.82 },
                  opacity: { duration: 0.14 },
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
              <PictureInPictureButton
                active={pipMode !== undefined}
                failureKey={pipFailureKey}
                isLoading={pipLoading}
                label={messages.pictureInPicture}
                shortLabel="PiP"
                onPress={() => void togglePictureInPicture()}
              />
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
          animate={{ opacity: 1 }}
          className={`menu-context-area${
            selectedSite?.panelId ? ' has-site-panel' : ''
          }`}
          exit={{ opacity: 0 }}
          initial={
            skipMenuEntryAnimation || view === 'preference' || reduceMotion
              ? false
              : { opacity: 0 }
          }
          key={selectedSite?.panelId ?? 'empty-site-panel'}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) beginMenuClose();
          }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.28, delay: 0.07, ease: 'easeOut' }
          }
        >
          <section className="menu-address-section">
            <form
              className={`menu-address-form${addressError ? ' has-error' : ''}`}
              key={addressFailureKey}
              onSubmit={(event) => void openAddress(event)}
            >
              <input
                aria-invalid={addressError}
                disabled={addressLoading}
                placeholder={messages.addressPlaceholder}
                ref={addressInputRef}
                spellCheck={false}
                type="text"
                value={address}
                onChange={(event) => {
                  setAddress(event.currentTarget.value);
                  setAddressError(false);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }}
              />
              <button disabled={addressLoading || !address.trim()} type="submit">
                <span aria-hidden="true">→</span>
              </button>
            </form>
            <p className={addressError ? 'is-error' : ''}>
              {addressError ? messages.unsupportedAddress : messages.addressHelp}
            </p>
          </section>
          <div
            className="menu-plugin-host"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) beginMenuClose();
            }}
          >
            {selectedSite?.panelId === 'video-library' && preferences ? (
              <VideoLibraryMenuPanel
                labels={localization.videoLibrary}
                refreshKey={sitePanelRefreshKey}
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
        {view === 'preference' ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="preference-motion-shell"
            exit={{ opacity: 1, y: reduceMotion ? 0 : '-100%' }}
            initial={{
              opacity: 1,
              y: reduceMotion ? 0 : '-100%',
            }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    y: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.32, ease: 'easeOut' },
                  }
            }
          >
            <PreferenceView
              initialMessages={messages}
              sites={sites}
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
    </KawaiProvider>
  );
}

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

function AlwaysOnTopIcon() {
  return (
    <svg className="always-on-top-icon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 4h8l-1.2 5 2.7 2.7v1.8H6.5v-1.8L9.2 9 8 4Z" />
      <path d="M12 13.5V21" />
    </svg>
  );
}
