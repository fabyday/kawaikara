import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Button,
  Flex,
  Head,
  KawaiProvider,
  Panel,
  ScrollArea,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';
import type {
  OverlayView,
  PictureInPictureMode,
  PictureInPictureStatus,
  PreferenceState,
  SiteMenuItem,
} from '../../../Common/IPC';
import { GearIcon } from '../../Component/GearIcon';
import { PictureInPictureButton } from '../../Component/PictureInPictureButton';
import { SiteMenuButton } from '../../Component/SiteMenuButton';
import { getAppMessages } from '../../Locale';
import {
  createOrderedSiteGroups,
  getDefaultMenuCategoryShortcut,
  getMenuCategoryShortcutId,
  matchesKeyboardAccelerator,
} from '../../MenuOrder';
import { PreferenceView } from '../Preference/App';

export function App() {
  const [sites, setSites] = useState<SiteMenuItem[]>([]);
  const [preferences, setPreferences] = useState<PreferenceState>();
  const [view, setView] = useState<OverlayView>('menu');
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState<string>();
  const [pipMode, setPipMode] = useState<PictureInPictureMode>();
  const [pipLoading, setPipLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [skipMenuEntryAnimation, setSkipMenuEntryAnimation] = useState(false);
  const [shortcutTargetCategory, setShortcutTargetCategory] = useState<string>();
  const closeTimer = useRef<number | undefined>(undefined);
  const shortcutHighlightTimer = useRef<number | undefined>(undefined);
  const categoryElements = useRef(new Map<string, HTMLElement>());
  const viewRef = useRef<OverlayView>('menu');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(
    () => () => {
      if (closeTimer.current !== undefined) {
        window.clearTimeout(closeTimer.current);
      }
      if (shortcutHighlightTimer.current !== undefined) {
        window.clearTimeout(shortcutHighlightTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    void Promise.all([
      window.kawaikara.sites.list(),
      window.kawaikara.preferences.get(),
    ])
      .then(([nextSites, nextPreferences]) => {
        setSites(nextSites);
        setSelectedId(nextSites.find((site) => site.isCurrent)?.id);
        setPreferences(nextPreferences);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  useEffect(() => {
    const removeMenuListener = window.kawaikara.overlay.onShowMenu(() => {
      setSkipMenuEntryAnimation(viewRef.current === 'preference');
      if (closeTimer.current !== undefined) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = undefined;
      }
      setView('menu');
      setMenuVisible(true);
      void Promise.all([
        window.kawaikara.sites.list(),
        window.kawaikara.preferences.get(),
      ]).then(([nextSites, nextPreferences]) => {
        setSites(nextSites);
        setSelectedId(nextSites.find((site) => site.isCurrent)?.id);
        setPreferences(nextPreferences);
      });
    });
    const removePreferenceListener =
      window.kawaikara.overlay.onShowPreferences(() => {
        setMenuVisible(false);
        setView('preference');
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
      setSkipMenuEntryAnimation(false);
      setView('menu');
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

  const messages = getAppMessages(preferences?.appLocale ?? 'system');

  const groups = useMemo(() => {
    return createOrderedSiteGroups(sites, preferences);
  }, [preferences, sites]);

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
      }, 850);
    };
    window.addEventListener('keydown', handleCategoryShortcut, true);
    return () => window.removeEventListener('keydown', handleCategoryShortcut, true);
  }, [groups, menuVisible, preferences, reduceMotion, view]);

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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : messages.pipFailed);
    } finally {
      setPipLoading(false);
    }
  };

  const setOverlayView = (nextView: OverlayView) => {
    if (nextView === 'menu' && viewRef.current === 'preference') {
      setSkipMenuEntryAnimation(true);
      setMenuVisible(true);
    }
    setView(nextView);
    void window.kawaikara.overlay.setView(nextView).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  };

  if (view === 'preference') {
    return (
      <KawaiProvider>
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="preference-motion-shell"
          initial={{
            opacity: reduceMotion ? 1 : 0,
            y: reduceMotion ? 0 : '-20%',
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
            sites={sites}
            onBack={() => setOverlayView('menu')}
            onPreferencesChange={setPreferences}
          />
        </motion.div>
      </KawaiProvider>
    );
  }

  return (
    <KawaiProvider>
      <AnimatePresence initial={false}>
        {menuVisible ? (
          <motion.main
            animate={{ opacity: 1, x: 0 }}
            className="kawai-theme-dark menu-shell"
            exit={{
              opacity: 0,
              x: reduceMotion ? 0 : '-104%',
              transition: reduceMotion
                ? { duration: 0 }
                : { duration: 0.17, ease: [0.4, 0, 1, 1] },
            }}
            initial={
              skipMenuEntryAnimation
                ? false
                : {
                    opacity: reduceMotion ? 1 : 0,
                    x: reduceMotion ? 0 : '-104%',
                  }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    x: { type: 'spring', stiffness: 390, damping: 38, mass: 0.82 },
                    opacity: { duration: 0.16 },
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

          <Flex className="overlay-media-actions" gap="xs">
            <PictureInPictureButton
              active={pipMode !== undefined}
              isLoading={pipLoading}
              label={messages.pictureInPicture}
              shortLabel="PiP"
              onPress={() => void togglePictureInPicture()}
            />
          </Flex>

          <ScrollArea
            className="site-list"
            label="Available sites"
            scrollbar="thin"
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
          </ScrollArea>

          {error ? (
            <Text className="menu-error" size="xs" tone="danger">
              {error}
            </Text>
          ) : null}
          <Text className="menu-hint" size="xs" tone="muted">
            {messages.menuHint}
          </Text>
        </Panel>
          </motion.main>
        ) : null}
      </AnimatePresence>
    </KawaiProvider>
  );
}

function getPictureInPictureError(
  status: PictureInPictureStatus,
  messages: ReturnType<typeof getAppMessages>,
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
