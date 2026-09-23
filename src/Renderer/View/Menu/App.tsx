import {
  KawaiProvider
} from '@kawaikara/kawai-ui';
import { AnimatePresence, motion } from 'motion/react';
import {
  useCallback,
  useEffect,
  useMemo
} from 'react';
import type {
  AppMessages
} from '../../../Common/IPC';
import { SiteIconCache } from '../../Component/SiteIcon';
import {
  createOrderedSiteGroups,
  isApplePlatform
} from '../../Domain/MenuOrder';
import { PreferenceView } from '../Preference/App';
import { UpdatePanel } from '../Update/UpdatePanel';
import { useAddressNavigation } from './Hooks/useAddressNavigation';
import { useMenuShortcuts } from './Hooks/useMenuShortcuts';
import { useMenuState } from './Hooks/useMenuState';
import { useMenuWindowActions } from './Hooks/useMenuWindowActions';
import { useOverlayEvents } from './Hooks/useOverlayEvents';
import { useOverlayNavigation } from './Hooks/useOverlayNavigation';
import { createAddressSuggestions } from './Logic/AddressSuggestions';
import { MenuAddressBar } from './MenuAddressBar';
import { MenuRail } from './MenuRail';
import { PluginViewHost } from './PluginViewHost';

/** Performs the app operation. */
export function App() {

  const menuState = useMenuState();
  const {
    sites,
    preferences,
    setPreferences,
    localization,
    setLocalization,
    view,
    selectedId,
    setError,
    pipFailureKey,
    setPipFailureKey,
    menuVisible,
    skipMenuEntryAnimation,
    menuEntrySequence,
    sitePanelRefreshKey,
    address,
    addressFocused,
    addressSuggestionsDismissed,
    previewTheme,
    setPreviewTheme,
    updateState,
    updatePanelView,
    setUpdatePanelView,
    pipFailureTimer,
    preferenceBackHandler,
    updatePanelViewRef,
    reduceMotion,
  } = menuState;

  const messages = localization?.app as AppMessages;

  const menuWindowActions = useMenuWindowActions({
    ...menuState,
    messages,
  });
  const {
    beginMenuClose,
  } = menuWindowActions;

  useOverlayEvents({
    ...menuState,
    ...menuWindowActions,
  });

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
        ? {
          ...current, app: nextMessages
        }
        : current);
    },
    [],
  );

  const {
    moveKawaiShortcutPage,
  } = useMenuShortcuts({
    ...menuState,
    groups,
    openSite: menuWindowActions.openSite,
  });

  const addressNavigation = useAddressNavigation({
    ...menuState,
  });

  const overlayNavigation = useOverlayNavigation({
    ...menuState,
  });
  const {
    setOverlayView,
    dismissUpdate,
    retryUpdate,
  } = overlayNavigation;

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
            animate={{
              opacity: 1
            }}
            className={`kawai-theme ${(previewTheme ?? preferences?.appTheme ?? 'dark') === 'dark'
                ? 'kawai-theme-dark'
                : 'kawai-theme-light'
              } menu-shell${view === 'preference' || manualUpdateVisible
                ? ' is-preference-underlay'
                : ''
              }`}
            inert={view === 'preference' || manualUpdateVisible ? true : undefined}
            key="menu-shell"
            exit={{
              opacity: 0,
              transition: reduceMotion
                ? {
                  duration: 0
                }
                : {
                  duration: 0.2, ease: [0.4, 0, 1, 1]
                },
            }}
            initial={false}
            transition={
              reduceMotion
                ? {
                  duration: 0
                }
                : {
                  opacity: {
                    duration: 0.24, ease: 'easeOut'
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
                animate={{
                  opacity: 1, x: 0
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
                key={`menu-rail-${String(menuEntrySequence)}`}
                transition={
                  reduceMotion
                    ? {
                      duration: 0
                    }
                    : {
                      x: {
                        type: 'spring', stiffness: 390, damping: 38, mass: 0.82
                      },
                      opacity: {
                        duration: 0.14
                      },
                    }
                }
              >
                <MenuRail
                  {...menuState}
                  {...menuWindowActions}
                  {...overlayNavigation}
                  messages={messages}
                  selectedSite={selectedSite}
                  groups={groups}
                  moveKawaiShortcutPage={moveKawaiShortcutPage}
                />
              </motion.div>
              <motion.div
                animate={{
                  opacity: 1
                }}
                className={`menu-context-area${selectedSite?.panels.length ? ' has-site-panel' : ''
                  }`}
                exit={{
                  opacity: 0
                }}
                initial={
                  skipMenuEntryAnimation || view === 'preference' || reduceMotion
                    ? false
                    : {
                      opacity: 0
                    }
                }
                key={`${selectedSite?.id ?? 'empty-site-panel'}-${String(menuEntrySequence)}`}
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) beginMenuClose();
                }}
                transition={
                  reduceMotion
                    ? {
                      duration: 0
                    }
                    : {
                      duration: 0.28, delay: 0.07, ease: 'easeOut'
                    }
                }
              >
                <MenuAddressBar
                  {...menuState}
                  {...addressNavigation}
                  messages={messages}
                  addressSuggestionsVisible={addressSuggestionsVisible}
                  addressSuggestions={addressSuggestions}
                  addressHelp={addressHelp}
                />
                <div
                  className="menu-plugin-host"
                  onPointerDown={(event) => {
                    if (event.target === event.currentTarget) beginMenuClose();
                  }}
                >
                  {selectedSite?.panels.length && preferences ? (
                    <PluginViewHost
                      messages={localization.app}
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
            animate={{
              opacity: 1, y: 0
            }}
            className="preference-motion-shell"
            inert={manualUpdateVisible ? true : undefined}
            exit={{
              opacity: 1, y: reduceMotion ? 0 : '-100%'
            }}
            initial={{
              opacity: 1,
              y: reduceMotion ? 0 : '-100%',
            }}
            transition={
              reduceMotion
                ? {
                  duration: 0
                }
                : {
                  y: {
                    duration: 0.42, ease: [0.22, 1, 0.36, 1]
                  },
                  opacity: {
                    duration: 0.32, ease: 'easeOut'
                  },
                }
            }
          >
            <PreferenceView
              initialLocale={localization.locale}
              initialLogViewerMessages={localization.logViewer}
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
            animate={{
              opacity: 1
            }}
            className={`kawai-theme ${(previewTheme ?? preferences?.appTheme ?? 'dark') === 'dark'
                ? 'kawai-theme-dark'
                : 'kawai-theme-light'
              } update-motion-shell`}
            exit={{
              opacity: 0
            }}
            initial={{
              opacity: 0
            }}
            transition={{
              duration: reduceMotion ? 0 : 0.2
            }}
          >
            <UpdatePanel
              labels={localization.update}
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
