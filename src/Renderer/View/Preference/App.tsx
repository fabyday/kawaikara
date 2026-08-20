import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'motion/react';
import {
  Button,
  Flex,
  Head,
  Input,
  RadioButton,
  RadioGroup,
  Select,
  Stack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
} from '@kawaikara/kawai-ui';
import { APP_SHORTCUTS } from '../../../Common/AppShortcuts';
import {
  SHORT_FORM_VIDEO_SHORTCUTS,
} from '../../../Common/ShortFormVideo';
import type {
  ProviderLocalizedText,
  ProviderSettingListItem,
} from '@kawaikara/site-api';
import {
  MAX_VIDEO_SEEK_SECONDS,
  MIN_VIDEO_SEEK_SECONDS,
  VIDEO_SHORTCUTS,
} from '../../../Common/VideoControls';
import type {
  ApplicationLinkId,
  ApplicationInfo,
  ApplicationUpdateCheckResult,
  AppMessages,
  AppLocale,
  AppTheme,
  BrowserProfileInfo,
  BundleInfo,
  DeveloperYouTubeStatus,
  DevToolsMode,
  DisplayInfo,
  BundleRuntimeInfo,
  GraphicsMode,
  PreferencePatch,
  PreferenceState,
  SiteMenuItem,
  UserBrowserProfile,
} from '../../../Common/IPC';
import type { ReleaseChannel } from '../../../Common/BuildConfig';
import {
  PICTURE_IN_PICTURE_PORTRAIT_SIZE_LIMITS,
  PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS,
} from '../../../Common/PictureInPicture';
import { DeveloperLinks } from '../../Component/DeveloperLinks';
import { AutoHideScrollArea } from '../../Component/AutoHideScrollArea';
import { DescriptiveSelect } from '../../Component/DescriptiveSelect';
import { PictureInPictureSizeControl } from '../../Component/PictureInPictureSizeControl';
import { PictureInPicturePlacementControl } from '../../Component/PictureInPicturePlacementControl';
import { SiteIcon } from '../../Component/SiteIcon';
import {
  createOrderedSiteGroups,
  getDefaultMenuCategoryShortcut,
  getMenuCategoryShortcutId,
  moveOrderedItem,
} from '../../Domain/MenuOrder';
import kawaikaraIcon from '../../../../resources/icons/app-kawaikara.png';

export interface PreferenceViewProps {
  readonly initialMessages: AppMessages;
  readonly sites: readonly SiteMenuItem[];
  readonly onBack: () => void;
  readonly onBackHandlerChange?: (handler: (() => void) | undefined) => void;
  readonly onMessagesChange?: (messages: AppMessages) => void;
  readonly onPreferencesChange?: (preferences: PreferenceState) => void;
  readonly onThemePreview?: (theme: AppTheme) => void;
}

interface ShortcutItem {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly defaultKey: string;
}

interface ShortcutConflict {
  readonly targetId: string;
  readonly conflictingIds: readonly string[];
  readonly previousShortcuts: Readonly<Record<string, string>>;
}

export function PreferenceView({
  initialMessages,
  sites,
  onBack,
  onBackHandlerChange,
  onMessagesChange,
  onPreferencesChange,
  onThemePreview,
}: PreferenceViewProps) {
  const [savedPreferences, setSavedPreferences] = useState<PreferenceState>();
  const [draftPreferences, setDraftPreferences] = useState<PreferenceState>();
  const [runtimeBundles, setRuntimeBundles] = useState<BundleRuntimeInfo[]>([]);
  const [bundles, setBundles] = useState<BundleInfo[]>([]);
  const [appInfo, setAppInfo] = useState<ApplicationInfo>();
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [developerYouTubeStatus, setDeveloperYouTubeStatus] =
    useState<DeveloperYouTubeStatus>();
  const [updateCheckResult, setUpdateCheckResult] =
    useState<ApplicationUpdateCheckResult>();
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [installingBundle, setInstallingBundle] = useState(false);
  const [bundleNotice, setBundleNotice] = useState<string>();
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

  useEffect(() => {
    void Promise.all([
      window.kawaikara.preferences.get(),
      window.kawaikara.bundles.runtime(),
      window.kawaikara.bundles.list(),
      window.kawaikara.application.getInfo(),
      window.kawaikara.application.listDisplays(),
    ])
      .then(([
        nextPreferences,
        nextRuntimeBundles,
        nextBundles,
        nextAppInfo,
        nextDisplays,
      ]) => {
        setSavedPreferences(nextPreferences);
        setDraftPreferences(nextPreferences);
        setRuntimeBundles(nextRuntimeBundles);
        setBundles(nextBundles);
        setAppInfo(nextAppInfo);
        setDisplays(nextDisplays);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  useEffect(() => {
    const locale = draftPreferences?.appLocale;
    if (!locale) return;
    let active = true;
    void window.kawaikara.application
      .getMessages(locale)
      .then((next) => {
        if (!active) return;
        setMessages(next.app);
        onMessagesChange?.(next.app);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      active = false;
    };
  }, [draftPreferences?.appLocale, onMessagesChange]);

  useEffect(() => {
    if (!menuOrderEditorOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMenuOrderEditorOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [menuOrderEditorOpen]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void window.kawaikara.application
        .getDeveloperYouTubeStatus()
        .then((status) => {
          if (active) setDeveloperYouTubeStatus(status);
        })
        .catch((reason: unknown) => {
          if (!active) return;
          setDeveloperYouTubeStatus({
            isLive: false,
            checkedAt: new Date().toISOString(),
            error: reason instanceof Error ? reason.message : String(reason),
          });
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const siteOptions = useMemo(
    () => sites.map((site) => ({ label: site.title, value: site.id })),
    [sites],
  );
  const appShortcutItems = useMemo<ShortcutItem[]>(
    () =>
      APP_SHORTCUTS.map((shortcut) => ({
        ...shortcut,
        title: messages.shortcutNames[shortcut.id] ?? shortcut.title,
      })),
    [messages],
  );
  const videoShortcutItems = useMemo<ShortcutItem[]>(
    () =>
      VIDEO_SHORTCUTS.map((shortcut) => ({
        ...shortcut,
        title: messages.shortcutNames[shortcut.id] ?? shortcut.title,
      })),
    [messages],
  );
  const shortFormVideoShortcutItems = useMemo<ShortcutItem[]>(
    () =>
      SHORT_FORM_VIDEO_SHORTCUTS.map((shortcut) => ({
        ...shortcut,
        title: messages.shortcutNames[shortcut.id] ?? shortcut.title,
      })),
    [messages],
  );
  const siteShortcutItems = useMemo<ShortcutItem[]>(
    () =>
      sites.map((site) => ({
        id: `site:${site.id}`,
        title: site.title,
        defaultKey: site.defaultShortcut,
      })),
    [sites],
  );
  const providerShortcutItems = useMemo<ShortcutItem[]>(
    () => sites.flatMap((site) => site.actionShortcuts.map((shortcut) => ({
      id: shortcut.id,
      title: resolveProviderText(shortcut.title, draftPreferences?.appLocale ?? 'system'),
      description: shortcut.description
        ? resolveProviderText(shortcut.description, draftPreferences?.appLocale ?? 'system')
        : undefined,
      defaultKey: shortcut.defaultKey,
    }))),
    [draftPreferences?.appLocale, sites],
  );
  const categoryShortcutItems = useMemo<ShortcutItem[]>(
    () =>
      createOrderedSiteGroups(sites, draftPreferences).map(
        ([category], index) => ({
          id: getMenuCategoryShortcutId(category),
          title: messages.categoryPosition.replace(
            '{number}',
            String(index + 1),
          ),
          description: `${messages.currentCategory}: ${messages.categoryLabels[category] ?? category}`,
          defaultKey: getDefaultMenuCategoryShortcut(index),
        }),
      ),
    [draftPreferences, messages, sites],
  );
  const allShortcutItems = useMemo(
    () => [
      ...appShortcutItems,
      ...videoShortcutItems,
      ...shortFormVideoShortcutItems,
      ...providerShortcutItems,
      ...categoryShortcutItems,
      ...siteShortcutItems,
    ],
    [
      appShortcutItems,
      categoryShortcutItems,
      providerShortcutItems,
      siteShortcutItems,
      shortFormVideoShortcutItems,
      videoShortcutItems,
    ],
  );
  const shortcutItemsById = useMemo(
    () => new Map(allShortcutItems.map((item) => [item.id, item])),
    [allShortcutItems],
  );
  const duplicateShortcutIds = useMemo(
    () =>
      draftPreferences
        ? findDuplicateShortcutIds(allShortcutItems, draftPreferences.shortcuts)
        : new Set<string>(),
    [allShortcutItems, draftPreferences],
  );
  const hasChanges = Boolean(
    savedPreferences &&
      draftPreferences &&
      !preferencesEqual(savedPreferences, draftPreferences),
  );

  const updateDraft = (patch: PreferencePatch) => {
    if (patch.appTheme) {
      onThemePreview?.(patch.appTheme);
      void window.kawaikara.preferences.previewTheme(patch.appTheme).catch(
        (reason: unknown) => {
          setError(reason instanceof Error ? reason.message : String(reason));
        },
      );
    }
    setDraftPreferences((current) =>
      current ? { ...current, ...patch } : current,
    );
    setError(undefined);
  };

  const completeBack = useCallback(() => {
    if (savedPreferences) {
      onThemePreview?.(savedPreferences.appTheme);
      void window.kawaikara.preferences
        .previewTheme(savedPreferences.appTheme)
        .catch(() => undefined);
    }
    setDiscardConfirmationOpen(false);
    onBack();
  }, [onBack, onThemePreview, savedPreferences]);

  const requestBack = useCallback(() => {
    if (hasChanges) {
      setDiscardConfirmationOpen(true);
      return;
    }
    completeBack();
  }, [completeBack, hasChanges]);

  useEffect(() => {
    onBackHandlerChange?.(requestBack);
    return () => onBackHandlerChange?.(undefined);
  }, [onBackHandlerChange, requestBack]);

  const openApplicationLink = async (id: ApplicationLinkId) => {
    setError(undefined);
    try {
      await window.kawaikara.application.openLink(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateCheckResult(undefined);
    setError(undefined);
    try {
      setUpdateCheckResult(
        await window.kawaikara.application.checkForUpdates(),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setCheckingUpdates(false);
    }
  };

  const save = async (): Promise<PreferenceState | undefined> => {
    if (!draftPreferences) return undefined;
    if (!hasChanges) return draftPreferences;
    setSaving(true);
    setError(undefined);
    try {
      // Locale is global. Clear legacy per-plugin and per-site overrides when
      // saving so every integration follows the same app locale.
      const next = await window.kawaikara.preferences.update({
        ...draftPreferences,
        pluginLocales: {},
        siteLocales: {},
      });
      setSavedPreferences(next);
      setDraftPreferences(next);
      onPreferencesChange?.(next);
      return next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return undefined;
    } finally {
      setSaving(false);
    }
  };

  const requestGraphicsModeChange = (graphicsMode: GraphicsMode) => {
    if (!draftPreferences || graphicsMode === draftPreferences.graphicsMode) {
      return;
    }
    setGraphicsRestartRequest(graphicsMode);
    setError(undefined);
  };

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

  const openLogDirectory = async () => {
    setError(undefined);
    try {
      await window.kawaikara.application.openLogDirectory();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const openDevTools = async (mode: DevToolsMode) => {
    const saved = await save();
    if (!saved) return;
    setError(undefined);
    try {
      await window.kawaikara.application.openDevTools(mode);
      await window.kawaikara.overlay.close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

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

  const updateShortcut = (item: ShortcutItem, accelerator: string) => {
    if (!draftPreferences) return;
    const previousShortcuts = { ...draftPreferences.shortcuts };
    const shortcuts = writeShortcutOverride(
      previousShortcuts,
      item,
      accelerator,
    );
    const nextPreferences = { ...draftPreferences, shortcuts };
    setDraftPreferences(nextPreferences);
    setError(undefined);

    const conflictingIds = findShortcutConflicts(
      item.id,
      allShortcutItems,
      shortcuts,
    );
    if (conflictingIds.length) {
      setShortcutConflict({
        targetId: item.id,
        conflictingIds,
        previousShortcuts,
      });
    }
  };

  const cancelShortcutOverwrite = () => {
    if (!shortcutConflict) return;
    updateDraft({ shortcuts: shortcutConflict.previousShortcuts });
    setShortcutConflict(undefined);
  };

  const confirmShortcutOverwrite = () => {
    if (!shortcutConflict) return;
    setDraftPreferences((current) => {
      if (!current) return current;
      const shortcuts = { ...current.shortcuts };
      for (const id of shortcutConflict.conflictingIds) shortcuts[id] = '';
      return { ...current, shortcuts };
    });
    setShortcutConflict(undefined);
  };

  const conflictNames = shortcutConflict?.conflictingIds
    .map((id) => shortcutItemsById.get(id)?.title ?? id)
    .join(', ');

  return (
    <main
      className={`kawai-theme preference-shell ${
        (draftPreferences?.appTheme ?? 'dark') === 'dark'
          ? 'kawai-theme-dark'
          : 'kawai-theme-light'
      }`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestBack();
      }}
    >
      <div className="preference-surface">
        <Flex className="preference-header" align="center" justify="between" gap="md">
          <div>
            <Head level={1} size="md">
              {messages.preference}
            </Head>
            <Text size="xs" tone="muted">
              {messages.configureViewer}
            </Text>
          </div>
          <Button
            className="overlay-icon-button preference-nav-button"
            aria-label={messages.backToSites}
            size="icon"
            variant="ghost"
            onClick={requestBack}
          >
            <span aria-hidden="true" className="overlay-button-glyph">←</span>
          </Button>
        </Flex>

        <div className="preference-view">
          {draftPreferences ? (
            <Tabs
              className="preference-tabs"
              defaultValue="general"
              orientation="vertical"
              variant="pill"
            >
              <TabList className="preference-tab-list">
                <Tab value="general">{messages.general}</Tab>
                <Tab value="video">{messages.video}</Tab>
                <Tab value="profiles">{messages.browserProfiles}</Tab>
                <Tab value="shortcuts">{messages.shortcuts}</Tab>
                <Tab
                  value="bundles"
                  onClick={() => setBundleTabActivation((value) => value + 1)}
                >
                  {messages.bundles}
                </Tab>
                <Tab value="developer">{messages.developer}</Tab>
                <Tab value="app-info">{messages.appInfo}</Tab>
              </TabList>

              <TabPanel className="preference-tab-panel" value="general">
                <PreferenceTabScroll label={messages.general}>
                  <GeneralTab
                    displays={displays}
                    graphicsMode={
                      graphicsRestartRequest ?? draftPreferences.graphicsMode
                    }
                    messages={messages}
                    preferences={draftPreferences}
                    saving={saving}
                    siteOptions={siteOptions}
                    sites={sites}
                    onEditMenuOrder={() => setMenuOrderEditorOpen(true)}
                    onGraphicsModeChange={requestGraphicsModeChange}
                    onUpdate={updateDraft}
                  />
                </PreferenceTabScroll>
              </TabPanel>

              <TabPanel className="preference-tab-panel" value="video">
                <PreferenceTabScroll label={messages.video}>
                  <VideoTab
                    messages={messages}
                    preferences={draftPreferences}
                    saving={saving}
                    onUpdate={updateDraft}
                  />
                </PreferenceTabScroll>
              </TabPanel>

              <TabPanel className="preference-tab-panel" value="profiles">
                <PreferenceTabScroll label={messages.browserProfiles}>
                  <BrowserProfilesTab
                    messages={messages}
                    bundles={runtimeBundles}
                    preferences={draftPreferences}
                    saving={saving}
                    sites={sites}
                    onUpdate={updateDraft}
                  />
                </PreferenceTabScroll>
              </TabPanel>

              <TabPanel className="preference-tab-panel" value="shortcuts">
                <PreferenceTabScroll label={messages.shortcuts}>
                  <ShortcutSection
                    description={messages.menuCategoryShortcutsDescription}
                    duplicateIds={duplicateShortcutIds}
                    items={categoryShortcutItems}
                    messages={messages}
                    preferences={draftPreferences}
                    saving={saving}
                    title={messages.menuCategoryShortcuts}
                    onChange={updateShortcut}
                  />
                  {providerShortcutItems.length ? (
                    <ShortcutSection
                      duplicateIds={duplicateShortcutIds}
                      items={providerShortcutItems}
                      messages={messages}
                      preferences={draftPreferences}
                      saving={saving}
                      title={messages.providerShortcuts}
                      onChange={updateShortcut}
                    />
                  ) : null}
                  <ShortcutSection
                    description={messages.videoShortcutsDescription}
                    duplicateIds={duplicateShortcutIds}
                    items={videoShortcutItems}
                    messages={messages}
                    preferences={draftPreferences}
                    saving={saving}
                    title={messages.videoShortcuts}
                    onChange={updateShortcut}
                  />
                  <ShortcutSection
                    description={messages.shortFormVideoShortcutsDescription}
                    duplicateIds={duplicateShortcutIds}
                    items={shortFormVideoShortcutItems}
                    messages={messages}
                    preferences={draftPreferences}
                    saving={saving}
                    title={messages.shortFormVideoShortcuts}
                    onChange={updateShortcut}
                  />
                  <ShortcutSection
                    duplicateIds={duplicateShortcutIds}
                    items={appShortcutItems}
                    messages={messages}
                    preferences={draftPreferences}
                    saving={saving}
                    title={messages.appShortcuts}
                    onChange={updateShortcut}
                  />
                  <ShortcutSection
                    duplicateIds={duplicateShortcutIds}
                    items={siteShortcutItems}
                    messages={messages}
                    preferences={draftPreferences}
                    saving={saving}
                    title={messages.siteShortcuts}
                    onChange={updateShortcut}
                  />
                </PreferenceTabScroll>
              </TabPanel>

              <TabPanel className="preference-tab-panel" value="bundles">
                <PreferenceTabScroll label={messages.bundles}>
                  <BundlesTab
                    bundles={bundles}
                    activationToken={bundleTabActivation}
                    installing={installingBundle}
                    messages={messages}
                    notice={bundleNotice}
                    preferences={draftPreferences}
                    runtimeBundles={runtimeBundles}
                    saving={saving}
                    onInstall={installBundle}
                    onUpdate={updateDraft}
                  />
                </PreferenceTabScroll>
              </TabPanel>

              <TabPanel className="preference-tab-panel" value="developer">
                <PreferenceTabScroll label={messages.developer}>
                  <DeveloperTab
                    messages={messages}
                    preferences={draftPreferences}
                    saving={saving}
                    onOpenDevTools={openDevTools}
                    onUpdate={updateDraft}
                  />
                </PreferenceTabScroll>
              </TabPanel>

              <TabPanel className="preference-tab-panel" value="app-info">
                <PreferenceTabScroll label={messages.appInfo}>
                  <AppInfoTab
                    appInfo={appInfo}
                    checkingUpdates={checkingUpdates}
                    developerYouTubeStatus={developerYouTubeStatus}
                    messages={messages}
                    preferences={draftPreferences}
                    saving={saving}
                    updateCheckResult={updateCheckResult}
                    onCheckForUpdates={checkForUpdates}
                    onOpenLogDirectory={openLogDirectory}
                    onOpenLink={openApplicationLink}
                    onUpdate={updateDraft}
                  />
                </PreferenceTabScroll>
              </TabPanel>
            </Tabs>
          ) : (
            <Text className="preference-loading" size="sm" tone="muted">
              {error ?? messages.loading}
            </Text>
          )}
        </div>

        {draftPreferences && error ? (
          <Text className="menu-error preference-error" size="xs" tone="danger">
            {error}
          </Text>
        ) : null}

        <AnimatePresence>
          {hasChanges ? (
            <motion.div
              className="preference-save-bar"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 28 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              <div>
                <Text weight="semibold">{messages.unsavedChanges}</Text>
                <Text size="xs" tone="muted">
                  {messages.saveDescription}
                </Text>
              </div>
              <Button isLoading={saving} onClick={() => void save()}>
                {messages.saveChanges}
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {menuOrderEditorOpen && draftPreferences ? (
          <MenuOrderEditor
            messages={messages}
            preferences={draftPreferences}
            sites={sites}
            onClose={() => setMenuOrderEditorOpen(false)}
            onUpdate={updateDraft}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {graphicsRestartRequest !== undefined ? (
          <motion.div
            className="preference-dialog-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              aria-describedby="graphics-restart-description"
              aria-labelledby="graphics-restart-title"
              aria-modal="true"
              className="preference-dialog"
              role="dialog"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
            >
              <Head id="graphics-restart-title" level={2} size="sm">
                {messages.graphicsRestartTitle}
              </Head>
              <Text id="graphics-restart-description" size="sm" tone="muted">
                {messages.graphicsRestartDescription}
              </Text>
              <Flex justify="end" gap="sm">
                <Button
                  disabled={saving}
                  variant="ghost"
                  onClick={() => setGraphicsRestartRequest(undefined)}
                >
                  {messages.cancel}
                </Button>
                <Button
                  isLoading={saving}
                  onClick={() => void applyGraphicsModeChange()}
                >
                  {messages.applyAndRestart}
                </Button>
              </Flex>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {shortcutConflict ? (
          <motion.div
            className="preference-dialog-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              aria-describedby="shortcut-conflict-description"
              aria-labelledby="shortcut-conflict-title"
              aria-modal="true"
              className="preference-dialog"
              role="dialog"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
            >
              <Head id="shortcut-conflict-title" level={2} size="sm">
                {messages.shortcutConflict}
              </Head>
              <Text id="shortcut-conflict-description" size="sm" tone="muted">
                {messages.shortcutConflictDescription.replace(
                  '{shortcuts}',
                  conflictNames ?? '',
                )}
              </Text>
              <Flex justify="end" gap="sm">
                <Button variant="ghost" onClick={cancelShortcutOverwrite}>
                  {messages.cancel}
                </Button>
                <Button variant="danger" onClick={confirmShortcutOverwrite}>
                  {messages.overwrite}
                </Button>
              </Flex>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {discardConfirmationOpen ? (
          <motion.div
            className="preference-dialog-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                setDiscardConfirmationOpen(false);
              }
            }}
          >
            <motion.div
              aria-describedby="discard-changes-description"
              aria-labelledby="discard-changes-title"
              aria-modal="true"
              className="preference-dialog"
              role="dialog"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Head id="discard-changes-title" level={2} size="sm">
                {messages.discardChangesTitle}
              </Head>
              <Text id="discard-changes-description" size="sm" tone="muted">
                {messages.discardChangesDescription}
              </Text>
              <Flex justify="end" gap="sm">
                <Button
                  variant="ghost"
                  onClick={() => setDiscardConfirmationOpen(false)}
                >
                  {messages.keepEditing}
                </Button>
                <Button variant="danger" onClick={completeBack}>
                  {messages.discardAndLeave}
                </Button>
              </Flex>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function PreferenceTabScroll({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) {
  return (
    <AutoHideScrollArea className="preference-tab-scroll" label={label}>
      <div className="preference-tab-content">{children}</div>
    </AutoHideScrollArea>
  );
}

function DeveloperTab({
  messages,
  preferences,
  saving,
  onOpenDevTools,
  onUpdate,
}: {
  readonly messages: AppMessages;
  readonly preferences: PreferenceState;
  readonly saving: boolean;
  readonly onOpenDevTools: (mode: DevToolsMode) => Promise<void>;
  readonly onUpdate: (patch: PreferencePatch) => void;
}) {
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    try {
      await onOpenDevTools(preferences.devToolsMode);
    } finally {
      setOpening(false);
    }
  };

  return (
    <Stack gap="lg">
      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.developerTools}
        </Text>
        <div className="developer-tools-card">
          <Stack gap="md">
            <Text size="xs" tone="muted">
              {messages.developerToolsDescription}
            </Text>
            <Select
              disabled={saving || opening}
              label={messages.devToolsPlacement}
              options={devToolsModeOptions(messages)}
              value={preferences.devToolsMode}
              onValueChange={(devToolsMode) =>
                onUpdate({ devToolsMode: devToolsMode as DevToolsMode })
              }
            />
            <Flex justify="end">
              <Button
                disabled={saving}
                isLoading={opening}
                onClick={() => void open()}
              >
                {messages.openDevTools}
              </Button>
            </Flex>
          </Stack>
        </div>
      </section>
    </Stack>
  );
}

function VideoTab({
  messages,
  preferences,
  saving,
  onUpdate,
}: {
  readonly messages: AppMessages;
  readonly preferences: PreferenceState;
  readonly saving: boolean;
  readonly onUpdate: (patch: PreferencePatch) => void;
}) {
  return (
    <Stack gap="lg">
      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.video}
        </Text>
        <Stack gap="sm">
          <Text size="xs" tone="muted">
            {messages.videoSettingsDescription}
          </Text>
          <RadioGroup
            className="video-control-layout-options"
            disabled={saving}
            label={messages.videoControlsLayout}
            value={preferences.videoControlsLayout}
            onValueChange={(videoControlsLayout) =>
              onUpdate({
                videoControlsLayout:
                  videoControlsLayout === 'overlay' ? 'overlay' : 'inline',
              })
            }
          >
            <RadioButton
              description={messages.videoControlsInlineDescription}
              label={messages.videoControlsInline}
              value="inline"
            />
            <RadioButton
              description={messages.videoControlsOverlayDescription}
              label={messages.videoControlsOverlay}
              value="overlay"
            />
          </RadioGroup>
          <NumberPreferenceControl
            disabled={saving}
            label={messages.videoSeekSeconds}
            max={MAX_VIDEO_SEEK_SECONDS}
            min={MIN_VIDEO_SEEK_SECONDS}
            step={1}
            unit={messages.seconds}
            value={preferences.videoSeekSeconds}
            description={messages.videoSeekSecondsDescription}
            onChange={(videoSeekSeconds) => onUpdate({ videoSeekSeconds })}
          />
          <NumberPreferenceControl
            disabled={saving || preferences.videoControlsLayout !== 'overlay'}
            label={messages.videoOverlayHideSeconds}
            max={30}
            min={0.5}
            step={0.1}
            unit={messages.seconds}
            value={preferences.videoOverlayHideSeconds}
            description={messages.videoOverlayHideSecondsDescription}
            onChange={(videoOverlayHideSeconds) =>
              onUpdate({ videoOverlayHideSeconds })
            }
          />
        </Stack>
      </section>
    </Stack>
  );
}

function NumberPreferenceControl({
  description,
  disabled,
  label,
  max,
  min,
  step,
  unit,
  value,
  onChange,
}: {
  readonly description: string;
  readonly disabled: boolean;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly step: number;
  readonly unit: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = (candidate: number) => {
    const precision = Math.max(0, (String(step).split('.')[1] ?? '').length);
    const rounded = Math.round(candidate / step) * step;
    const next = Number.isFinite(candidate)
      ? Number(Math.min(max, Math.max(min, rounded)).toFixed(precision))
      : value;
    setDraft(String(next));
    onChange(next);
  };

  return (
    <label
      aria-disabled={disabled}
      className={`number-preference-control${disabled ? ' is-disabled' : ''}`}
    >
      <span className="number-preference-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="number-preference-field">
        <span className="number-preference-input-group">
          <input
            disabled={disabled}
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            type="text"
            value={draft}
            onBlur={() => commit(Number(draft))}
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (/^(?:\d+(?:\.\d*)?|\.\d*)?$/.test(next)) setDraft(next);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <span className="number-preference-steppers">
            <button
              aria-label={`${label} +`}
              disabled={disabled || value >= max}
              tabIndex={-1}
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => commit(value + step)}
            >
              +
            </button>
            <button
              aria-label={`${label} −`}
              disabled={disabled || value <= min}
              tabIndex={-1}
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => commit(value - step)}
            >
              −
            </button>
          </span>
        </span>
        <span className="number-preference-unit">{unit}</span>
      </span>
    </label>
  );
}

function GeneralTab({
  displays,
  graphicsMode,
  messages,
  preferences,
  saving,
  siteOptions,
  sites,
  onEditMenuOrder,
  onGraphicsModeChange,
  onUpdate,
}: {
  readonly displays: readonly DisplayInfo[];
  readonly graphicsMode: GraphicsMode;
  readonly messages: AppMessages;
  readonly preferences: PreferenceState;
  readonly saving: boolean;
  readonly siteOptions: readonly { label: string; value: string }[];
  readonly sites: readonly SiteMenuItem[];
  readonly onEditMenuOrder: () => void;
  readonly onGraphicsModeChange: (graphicsMode: GraphicsMode) => void;
  readonly onUpdate: (patch: PreferencePatch) => void;
}) {
  return (
    <Stack gap="lg">
      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.language}
        </Text>
        <Select
          disabled={saving}
          label={messages.appLanguage}
          options={appLocaleOptions(messages)}
          value={preferences.appLocale}
          description={messages.globalLanguageDescription}
          onValueChange={(appLocale) =>
            onUpdate({
              appLocale: appLocale as AppLocale,
              pluginLocales: {},
              siteLocales: {},
            })
          }
        />
      </section>

      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.appearance}
        </Text>
        <Select
          disabled={saving}
          label={messages.appTheme}
          options={appThemeOptions(messages)}
          value={preferences.appTheme}
          description={messages.appThemeDescription}
          onValueChange={(appTheme) =>
            onUpdate({ appTheme: appTheme as AppTheme })
          }
        />
      </section>

      <section>
        <Select
          disabled={saving}
          label={messages.defaultSite}
          options={siteOptions}
          value={preferences.defaultSiteId}
          description={messages.defaultSiteDescription}
          onValueChange={(defaultSiteId) => onUpdate({ defaultSiteId })}
        />
      </section>

      <section>
        <div className="menu-order-setting">
          <div>
            <Text weight="semibold">{messages.menuOrder}</Text>
            <Text size="xs" tone="muted">
              {messages.menuOrderDescription}
            </Text>
          </div>
          <Button disabled={saving || sites.length === 0} onClick={onEditMenuOrder}>
            {messages.editMenuOrder}
          </Button>
        </div>
      </section>

      <Stack gap="sm">
        <Text weight="semibold">
          {messages.pictureInPictureSettings}
        </Text>
        <div className="pip-preference-grid">
          <PictureInPictureSizeControl
            disabled={saving}
            messages={{
              compact: messages.pipSizeCompact,
              custom: messages.pipSizeCustom,
              description: messages.pictureInPictureSizeDescription,
              height: messages.pipHeight,
              large: messages.pipSizeLarge,
              medium: messages.pipSizeMedium,
              pixels: messages.pixels,
              size: messages.pictureInPictureSize,
              width: messages.pipWidth,
            }}
            value={preferences.pictureInPictureSize}
            onChange={(pictureInPictureSize) =>
              onUpdate({ pictureInPictureSize })
            }
          />
          <PictureInPictureSizeControl
            disabled={saving}
            limits={PICTURE_IN_PICTURE_PORTRAIT_SIZE_LIMITS}
            presets={PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS}
            messages={{
              compact: messages.pipSizeCompact,
              custom: messages.pipSizeCustom,
              description: messages.pictureInPicturePortraitSizeDescription,
              height: messages.pipHeight,
              large: messages.pipSizeLarge,
              medium: messages.pipSizeMedium,
              pixels: messages.pixels,
              size: messages.pictureInPicturePortraitSize,
              width: messages.pipWidth,
            }}
            value={preferences.pictureInPicturePortraitSize}
            onChange={(pictureInPicturePortraitSize) =>
              onUpdate({ pictureInPicturePortraitSize })
            }
          />
          <div className="pip-preference-placement">
            <PictureInPicturePlacementControl
              disabled={saving}
              displays={displays}
              messages={{
                bottomLeft: messages.pipPositionBottomLeft,
                bottomRight: messages.pipPositionBottomRight,
                currentDisplay: messages.pipMonitorCurrent,
                display: messages.pipMonitorDisplay,
                lastDisplay: messages.pipMonitorLast,
                lastPosition: messages.pipPositionLast,
                monitor: messages.pictureInPictureMonitor,
                monitorDescription: messages.pictureInPictureMonitorDescription,
                position: messages.pictureInPicturePosition,
                positionDescription: messages.pictureInPicturePositionDescription,
                primary: messages.primaryDisplay,
                topLeft: messages.pipPositionTopLeft,
                topRight: messages.pipPositionTopRight,
                unavailableDisplay: messages.unavailableDisplay,
                videoDisplay: messages.pipMonitorVideo,
              }}
              value={preferences.pictureInPicturePlacement}
              onChange={(pictureInPicturePlacement) =>
                onUpdate({ pictureInPicturePlacement })
              }
            />
          </div>
        </div>
      </Stack>

      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.logLevel}
        </Text>
        <DescriptiveSelect
          disabled={saving}
          label={messages.logLevel}
          options={[
            {
              label: messages.logLevelError,
              description: messages.logLevelErrorDescription,
              value: 'error',
            },
            {
              label: messages.logLevelWarn,
              description: messages.logLevelWarnDescription,
              value: 'warn',
            },
            {
              label: messages.logLevelInfo,
              description: messages.logLevelInfoDescription,
              value: 'info',
            },
            {
              label: messages.logLevelVerbose,
              description: messages.logLevelVerboseDescription,
              value: 'verbose',
            },
            {
              label: messages.logLevelDebug,
              description: messages.logLevelDebugDescription,
              value: 'debug',
            },
            {
              label: messages.logLevelNone,
              description: messages.logLevelNoneDescription,
              value: 'none',
            },
          ]}
          value={preferences.logLevel}
          description={messages.logLevelDescription}
          onValueChange={(logLevel) =>
            onUpdate({ logLevel: logLevel as PreferenceState['logLevel'] })
          }
        />
      </section>

      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.viewer}
        </Text>
        <Stack gap="md">
          <Switch
            checked={preferences.alwaysOnTop}
            disabled={saving}
            label={messages.alwaysOnTop}
            description={messages.alwaysOnTopDescription}
            onCheckedChange={(alwaysOnTop) => onUpdate({ alwaysOnTop })}
          />
          <Switch
            checked={preferences.openMenuOnStartup}
            disabled={saving}
            label={messages.openMenuOnStartup}
            description={messages.openMenuOnStartupDescription}
            onCheckedChange={(openMenuOnStartup) =>
              onUpdate({ openMenuOnStartup })
            }
          />
          <Switch
            checked={preferences.closeMenuOnEscape}
            disabled={saving}
            label={messages.closeMenuOnEscape}
            description={messages.closeMenuOnEscapeDescription}
            onCheckedChange={(closeMenuOnEscape) =>
              onUpdate({ closeMenuOnEscape })
            }
          />
          <Switch
            checked={preferences.closeMenuOnOutsideClick}
            disabled={saving}
            label={messages.closeMenuOnOutsideClick}
            description={messages.closeMenuOnOutsideClickDescription}
            onCheckedChange={(closeMenuOnOutsideClick) =>
              onUpdate({ closeMenuOnOutsideClick })
            }
          />
        </Stack>
      </section>

      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.performance}
        </Text>
        <GraphicsModeControl
          disabled={saving}
          messages={messages}
          value={graphicsMode}
          onChange={onGraphicsModeChange}
        />
      </section>
    </Stack>
  );
}

function GraphicsModeControl({
  disabled,
  messages,
  value,
  onChange,
}: {
  readonly disabled: boolean;
  readonly messages: AppMessages;
  readonly value: GraphicsMode;
  readonly onChange: (value: GraphicsMode) => void;
}) {
  const options: readonly {
    readonly label: string;
    readonly description: string;
    readonly value: GraphicsMode;
  }[] = [
    {
      label: messages.graphicsModeNative,
      description: messages.graphicsModeNativeDescription,
      value: 'native',
    },
    {
      label: messages.graphicsModeCompatible,
      description: messages.graphicsModeCompatibleDescription,
      value: 'capture',
    },
    {
      label: messages.graphicsModeSoftware,
      description: messages.graphicsModeSoftwareDescription,
      value: 'software',
    },
  ];
  const selected = options.find((option) => option.value === value) ?? options[1];

  return (
    <div className="graphics-mode-setting">
      <Text size="sm" weight="medium">
        {messages.graphicsMode}
      </Text>
      <Text size="xs" tone="muted">
        {messages.graphicsModeDescription}
      </Text>
      <div
        aria-label={messages.graphicsMode}
        className="graphics-mode-control"
        role="radiogroup"
      >
        {options.map((option) => (
          <button
            aria-checked={option.value === value}
            className={option.value === value ? 'is-active' : undefined}
            disabled={disabled}
            key={option.value}
            role="radio"
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <Text className="graphics-mode-selected-description" size="xs" tone="muted">
        {selected.description}
      </Text>
    </div>
  );
}

function MenuOrderEditor({
  messages,
  preferences,
  sites,
  onClose,
  onUpdate,
}: {
  readonly messages: AppMessages;
  readonly preferences: PreferenceState;
  readonly sites: readonly SiteMenuItem[];
  readonly onClose: () => void;
  readonly onUpdate: (patch: PreferencePatch) => void;
}) {
  const [mode, setMode] = useState<'categories' | 'sites'>('categories');
  const groups = createOrderedSiteGroups(sites, preferences);
  const categories = groups.map(([category]) => category);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moveCategory = (index: number, direction: -1 | 1) => {
    onUpdate({
      menuCategoryOrder: moveOrderedItem(categories, index, direction),
    });
  };

  const moveSite = (category: string, index: number, direction: -1 | 1) => {
    const group = groups.find(([candidate]) => candidate === category);
    if (!group) return;
    writeSiteOrder(category, moveOrderedItem(group[1], index, direction));
  };

  const writeSiteOrder = (
    category: string,
    orderedCategorySites: readonly SiteMenuItem[],
  ) => {
    const nextOrder = groups.flatMap(([groupCategory, groupSites]) => {
      const orderedSites = groupCategory === category
        ? orderedCategorySites
        : groupSites;
      return orderedSites.map((site) => site.id);
    });
    onUpdate({ menuSiteOrder: nextOrder });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (mode === 'categories') {
      const oldIndex = categories.indexOf(activeId);
      const newIndex = categories.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return;
      onUpdate({ menuCategoryOrder: arrayMove(categories, oldIndex, newIndex) });
      return;
    }

    const group = groups.find(([, groupSites]) =>
      groupSites.some((site) => site.id === activeId),
    );
    if (!group || !group[1].some((site) => site.id === overId)) return;
    const oldIndex = group[1].findIndex((site) => site.id === activeId);
    const newIndex = group[1].findIndex((site) => site.id === overId);
    writeSiteOrder(group[0], arrayMove(group[1], oldIndex, newIndex));
  };

  return (
    <motion.div
      className="preference-dialog-backdrop menu-order-editor-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        aria-describedby="menu-order-description"
        aria-labelledby="menu-order-title"
        aria-modal="true"
        className="menu-order-editor"
        layout
        role="dialog"
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 14 }}
      >
        <Flex align="center" justify="between" gap="md">
          <div>
            <Head id="menu-order-title" level={2} size="sm">
              {messages.menuOrder}
            </Head>
            <Text id="menu-order-description" size="xs" tone="muted">
              {messages.menuOrderEditorDescription}
            </Text>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onUpdate({ menuCategoryOrder: [], menuSiteOrder: [] })
            }
          >
            {messages.resetMenuOrder}
          </Button>
        </Flex>

        <Flex className="menu-order-mode-switch" gap="xs">
          <Button
            className={mode === 'categories' ? 'is-active' : undefined}
            size="sm"
            variant="ghost"
            onClick={() => setMode('categories')}
          >
            {messages.menuOrderCategories}
          </Button>
          <Button
            className={mode === 'sites' ? 'is-active' : undefined}
            size="sm"
            variant="ghost"
            onClick={() => setMode('sites')}
          >
            {messages.menuOrderSites}
          </Button>
        </Flex>

        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="menu-order-mode-content"
            exit={{ opacity: 0, y: mode === 'categories' ? -8 : 8 }}
            initial={{ opacity: 0, y: mode === 'categories' ? 8 : -8 }}
            key={mode}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
          <DndContext
            collisionDetection={closestCenter}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          >
            <AutoHideScrollArea
              className="menu-order-editor-list"
              label={messages.menuOrder}
            >
              {mode === 'categories' ? (
              <SortableContext
                items={categories}
                strategy={verticalListSortingStrategy}
              >
                <Stack gap="xs">
                  {groups.map(([category, categorySites], index) => (
                    <SortableCategoryRow
                      category={category}
                      count={categorySites.length}
                      index={index}
                      key={category}
                      length={groups.length}
                      messages={messages}
                      onMove={(direction) => moveCategory(index, direction)}
                    />
                  ))}
                </Stack>
              </SortableContext>
            ) : (
              <Stack gap="sm">
                {groups.map(([category, categorySites]) => (
                  <section className="menu-order-category" key={category}>
                    <Text size="xs" tone="muted" weight="semibold">
                      {messages.categoryLabels[category] ?? category}
                    </Text>
                    <SortableContext
                      items={categorySites.map((site) => site.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <Stack gap="xs">
                        {categorySites.map((site, index) => (
                          <SortableSiteRow
                            index={index}
                            key={site.id}
                            length={categorySites.length}
                            messages={messages}
                            site={site}
                            onMove={(direction) =>
                              moveSite(category, index, direction)
                            }
                          />
                        ))}
                      </Stack>
                    </SortableContext>
                  </section>
                ))}
              </Stack>
              )}
            </AutoHideScrollArea>
          </DndContext>
          </motion.div>
        </AnimatePresence>

        <Flex justify="end">
          <Button onClick={onClose}>{messages.done}</Button>
        </Flex>
      </motion.div>
    </motion.div>
  );
}

function SortableCategoryRow({
  category,
  count,
  index,
  length,
  messages,
  onMove,
}: {
  readonly category: string;
  readonly count: number;
  readonly index: number;
  readonly length: number;
  readonly messages: AppMessages;
  readonly onMove: (direction: -1 | 1) => void;
}) {
  const label = messages.categoryLabels[category] ?? category;
  const sortable = useSortable({ id: category });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <div
      className={`menu-order-category-row${sortable.isDragging ? ' is-dragging' : ''}`}
      ref={sortable.setNodeRef}
      style={style}
    >
      <DragHandle
        label={`${messages.dragToReorder}: ${label}`}
        sortable={sortable}
      />
      <div className="menu-order-row-copy">
        <Text weight="semibold">{label}</Text>
        <Text size="xs" tone="muted">{count} {messages.sites}</Text>
      </div>
      <OrderButtons
        index={index}
        itemLabel={label}
        length={length}
        messages={messages}
        onMove={onMove}
      />
    </div>
  );
}

function SortableSiteRow({
  index,
  length,
  messages,
  site,
  onMove,
}: {
  readonly index: number;
  readonly length: number;
  readonly messages: AppMessages;
  readonly site: SiteMenuItem;
  readonly onMove: (direction: -1 | 1) => void;
}) {
  const sortable = useSortable({ id: site.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <div
      className={`menu-order-site${sortable.isDragging ? ' is-dragging' : ''}`}
      ref={sortable.setNodeRef}
      style={style}
    >
      <DragHandle
        label={`${messages.dragToReorder}: ${site.title}`}
        sortable={sortable}
      />
      <Flex className="menu-order-row-copy" align="center" gap="sm">
        <SiteIcon site={site} />
        <Text size="sm" weight="semibold">{site.title}</Text>
      </Flex>
      <OrderButtons
        index={index}
        itemLabel={site.title}
        length={length}
        messages={messages}
        onMove={onMove}
      />
    </div>
  );
}

function DragHandle({
  label,
  sortable,
}: {
  readonly label: string;
  readonly sortable: ReturnType<typeof useSortable>;
}) {
  return (
    <button
      aria-label={label}
      className="menu-order-drag-handle"
      ref={sortable.setActivatorNodeRef}
      type="button"
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <span aria-hidden="true">⠿</span>
    </button>
  );
}

function OrderButtons({
  index,
  itemLabel,
  length,
  messages,
  onMove,
}: {
  readonly index: number;
  readonly itemLabel: string;
  readonly length: number;
  readonly messages: AppMessages;
  readonly onMove: (direction: -1 | 1) => void;
}) {
  return (
    <Flex className="menu-order-actions" gap="xs">
      <Button
        aria-label={`${messages.moveUp}: ${itemLabel}`}
        disabled={index === 0}
        size="icon"
        variant="ghost"
        onClick={() => onMove(-1)}
      >
        <span aria-hidden="true">↑</span>
      </Button>
      <Button
        aria-label={`${messages.moveDown}: ${itemLabel}`}
        disabled={index === length - 1}
        size="icon"
        variant="ghost"
        onClick={() => onMove(1)}
      >
        <span aria-hidden="true">↓</span>
      </Button>
    </Flex>
  );
}

function BrowserProfilesTab({
  bundles,
  messages,
  preferences,
  saving,
  sites,
  onUpdate,
}: {
  readonly bundles: readonly BundleRuntimeInfo[];
  readonly messages: AppMessages;
  readonly preferences: PreferenceState;
  readonly saving: boolean;
  readonly sites: readonly SiteMenuItem[];
  readonly onUpdate: (patch: PreferencePatch) => void;
}) {
  const [newProfileName, setNewProfileName] = useState('');
  const pluginProfiles = bundles.flatMap((bundle) => bundle.browserProfiles);
  const userProfiles: BrowserProfileInfo[] = preferences.browserProfiles.map(
    (profile) => ({
      id: `user:${profile.id}`,
      name: profile.name,
      persistent: profile.persistent,
      source: 'user',
    }),
  );
  const allProfiles = [...pluginProfiles, ...userProfiles];

  const addProfile = () => {
    const name = newProfileName.trim();
    if (!name) return;
    const profile: UserBrowserProfile = {
      id: createUserBrowserProfileId(),
      name,
      persistent: true,
    };
    onUpdate({ browserProfiles: [...preferences.browserProfiles, profile] });
    setNewProfileName('');
  };

  const removeProfile = (profile: UserBrowserProfile) => {
    const removedId = `user:${profile.id}`;
    onUpdate({
      browserProfiles: preferences.browserProfiles.filter(
        (candidate) => candidate.id !== profile.id,
      ),
      siteBrowserProfiles: Object.fromEntries(
        Object.entries(preferences.siteBrowserProfiles).filter(
          ([, assigned]) => assigned !== removedId,
        ),
      ),
    });
  };

  return (
    <Stack gap="lg">
      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.browserProfiles}
        </Text>
        <Text size="xs" tone="muted">
          {messages.browserProfilesDescription}
        </Text>
        <Flex className="profile-create-row" align="end" gap="sm">
          <Input
            disabled={saving}
            label={messages.profileName}
            placeholder={messages.profileNamePlaceholder}
            value={newProfileName}
            onChange={(event) => setNewProfileName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addProfile();
            }}
          />
          <Button disabled={saving || !newProfileName.trim()} onClick={addProfile}>
            {messages.addProfile}
          </Button>
        </Flex>
      </section>

      {pluginProfiles.length ? (
        <section>
          <Text className="preference-section-title" weight="semibold">
            {messages.pluginProfiles}
          </Text>
          <Stack gap="sm">
            {pluginProfiles.map((profile) => (
              <BrowserProfileCard
                key={profile.id}
                messages={messages}
                profile={profile}
              />
            ))}
          </Stack>
        </section>
      ) : null}

      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.userProfiles}
        </Text>
        {preferences.browserProfiles.length ? (
          <Stack gap="sm">
            {preferences.browserProfiles.map((profile) => (
              <BrowserProfileCard
                key={profile.id}
                messages={messages}
                profile={{
                  id: `user:${profile.id}`,
                  name: profile.name,
                  persistent: profile.persistent,
                  source: 'user',
                }}
                removeDisabled={saving}
                onRemove={() => removeProfile(profile)}
              />
            ))}
          </Stack>
        ) : (
          <Text size="sm" tone="muted">{messages.noUserProfiles}</Text>
        )}
      </section>

      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.siteProfileAssignments}
        </Text>
        <Text size="xs" tone="muted">
          {messages.siteProfileAssignmentsDescription}
        </Text>
        <Stack className="profile-site-list" gap="sm">
          {sites.map((site) => {
            const explicit = preferences.siteBrowserProfiles[site.id];
            const effective =
              explicit ?? site.defaultBrowserProfileId ?? 'isolated';
            const sharedDrm = site.drm && effective !== 'isolated';
            return (
              <div className="profile-site-row" key={site.id}>
                <div className="profile-site-copy">
                  <Text weight="semibold">{site.title}</Text>
                  <Text size="xs" tone={sharedDrm ? 'danger' : 'muted'}>
                    {sharedDrm
                      ? messages.drmProfileWarning
                      : profileAssignmentDescription(
                          messages,
                          effective,
                          allProfiles,
                        )}
                  </Text>
                </div>
                <Select
                  disabled={saving}
                  label={messages.browserProfile}
                  options={profileOptions(messages, allProfiles)}
                  value={effective}
                  onValueChange={(browserProfileId) => {
                    const assignments = { ...preferences.siteBrowserProfiles };
                    const defaultValue = site.defaultBrowserProfileId ?? 'isolated';
                    if (browserProfileId === defaultValue) delete assignments[site.id];
                    else assignments[site.id] = browserProfileId;
                    onUpdate({ siteBrowserProfiles: assignments });
                  }}
                />
              </div>
            );
          })}
        </Stack>
      </section>
    </Stack>
  );
}

function BrowserProfileCard({
  messages,
  profile,
  removeDisabled,
  onRemove,
}: {
  readonly messages: AppMessages;
  readonly profile: BrowserProfileInfo;
  readonly removeDisabled?: boolean;
  readonly onRemove?: () => void;
}) {
  return (
    <div className="browser-profile-card">
      <div>
        <Flex align="center" gap="sm">
          <Text weight="semibold">{profile.name}</Text>
          <span className={`profile-source-badge is-${profile.source}`}>
            {profile.source === 'plugin'
              ? messages.pluginProfile
              : messages.userProfile}
          </span>
        </Flex>
        <Text size="xs" tone="muted">
          {profile.description ?? profile.pluginName ?? messages.persistentProfile}
        </Text>
      </div>
      {onRemove ? (
        <Button disabled={removeDisabled} size="sm" variant="danger" onClick={onRemove}>
          {messages.removeProfile}
        </Button>
      ) : null}
    </div>
  );
}

function profileOptions(
  messages: AppMessages,
  profiles: readonly BrowserProfileInfo[],
) {
  return [
    { label: messages.isolatedProfile, value: 'isolated' },
    ...profiles.map((profile) => ({
      label: `${profile.name} · ${
        profile.source === 'plugin' ? messages.pluginProfile : messages.userProfile
      }`,
      value: profile.id,
    })),
  ];
}

function profileAssignmentDescription(
  messages: AppMessages,
  profileId: string,
  profiles: readonly BrowserProfileInfo[],
): string {
  if (profileId === 'isolated') return messages.isolatedProfileDescription;
  const profile = profiles.find((item) => item.id === profileId);
  return profile
    ? messages.sharedProfileDescription.replace('{profile}', profile.name)
    : messages.isolatedProfileDescription;
}

function createUserBrowserProfileId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function ShortcutSection({
  description,
  duplicateIds,
  items,
  messages,
  preferences,
  saving,
  title,
  onChange,
}: {
  readonly description?: string;
  readonly duplicateIds: ReadonlySet<string>;
  readonly items: readonly ShortcutItem[];
  readonly messages: AppMessages;
  readonly preferences: PreferenceState;
  readonly saving: boolean;
  readonly title: string;
  readonly onChange: (item: ShortcutItem, value: string) => void;
}) {
  return (
    <section className="shortcut-section">
      <Text className="preference-section-title" weight="semibold">
        {title}
      </Text>
      {description ? (
        <Text className="shortcut-section-description" size="xs" tone="muted">
          {description}
        </Text>
      ) : null}
      <Stack gap="sm">
        {items.map((item) => {
          const value = getEffectiveShortcut(item, preferences.shortcuts);
          const isDuplicate = duplicateIds.has(item.id);
          return (
            <div
              className={`shortcut-row${isDuplicate ? ' is-duplicate' : ''}`}
              key={item.id}
            >
              <div className="shortcut-label">
                <Text weight="semibold">{item.title}</Text>
                {item.description ? (
                  <Text className="shortcut-current-category" size="xs" tone="muted">
                    {item.description}
                  </Text>
                ) : null}
                <Text className="shortcut-default" size="xs" tone="muted">
                  {messages.defaultValue}:{' '}
                  {item.defaultKey
                    ? formatAccelerator(item.defaultKey).join(' + ')
                    : messages.empty}
                </Text>
              </div>
              <ShortcutRecorder
                disabled={saving}
                emptyLabel={messages.empty}
                label={item.title}
                value={value}
                onChange={(accelerator) => onChange(item, accelerator)}
              />
              <Button
                disabled={saving || value === item.defaultKey}
                size="sm"
                variant="ghost"
                onClick={() => onChange(item, item.defaultKey)}
              >
                {messages.reset}
              </Button>
              {isDuplicate ? (
                <Text className="shortcut-duplicate" size="xs" tone="danger">
                  {messages.duplicateShortcut}
                </Text>
              ) : null}
            </div>
          );
        })}
      </Stack>
      <Text className="shortcut-capture-hint" size="xs" tone="muted">
        {messages.shortcutCapture}
      </Text>
    </section>
  );
}

function ShortcutRecorder({
  disabled,
  emptyLabel,
  label,
  value,
  onChange,
}: {
  readonly disabled: boolean;
  readonly emptyLabel: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const [preview, setPreview] = useState<string>();
  const displayValue = preview ?? value;
  const parts = formatAccelerator(displayValue);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      (event.key === 'Backspace' || event.key === 'Delete') &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey
    ) {
      setPreview('');
      onChange('');
      return;
    }

    const accelerator = createAccelerator(event);
    setPreview(accelerator);
    if (!isModifierKey(event.key) && accelerator) onChange(accelerator);
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isModifierKey(event.key)) {
      const modifierPreview = createAccelerator(event);
      setPreview(modifierPreview || undefined);
    }
  };

  return (
    <div className="shortcut-recorder">
      <input
        aria-label={label}
        disabled={disabled}
        readOnly
        value={displayValue}
        onBlur={() => setPreview(undefined)}
        onFocus={() => setPreview(value)}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      />
      <div aria-hidden="true" className="shortcut-key-group">
        {parts.length ? (
          parts.map((part, index) => (
            <span className="shortcut-key-part" key={`${part}-${String(index)}`}>
              <kbd>{part}</kbd>
              {index < parts.length - 1 ? <i>+</i> : null}
            </span>
          ))
        ) : (
          <span className="shortcut-empty">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}

function BundlesTab({
  activationToken,
  bundles,
  installing,
  messages,
  notice,
  preferences,
  runtimeBundles,
  saving,
  onInstall,
  onUpdate,
}: {
  readonly activationToken: number;
  readonly bundles: readonly BundleInfo[];
  readonly installing: boolean;
  readonly messages: AppMessages;
  readonly notice?: string;
  readonly preferences: PreferenceState;
  readonly runtimeBundles: readonly BundleRuntimeInfo[];
  readonly saving: boolean;
  readonly onInstall: () => void | Promise<void>;
  readonly onUpdate: (patch: PreferencePatch) => void;
}) {
  const [selectedBundleId, setSelectedBundleId] = useState<string>();
  const selectedBundle = bundles.find(({ id }) => id === selectedBundleId);
  const selectedRuntime = runtimeBundles.find(({ id }) => id === selectedBundleId);

  useEffect(() => {
    setSelectedBundleId(undefined);
  }, [activationToken]);

  if (selectedBundle) {
    return (
      <Stack className="bundle-detail" gap="lg">
        <Flex align="center" gap="sm">
          <Button
            aria-label={messages.backToBundles}
            size="icon"
            variant="ghost"
            onClick={() => setSelectedBundleId(undefined)}
          >
            <span aria-hidden="true">←</span>
          </Button>
          <div className="bundle-heading-copy">
            <Text className="preference-section-title" weight="semibold">
              {selectedBundle.name}
            </Text>
            <Text size="xs" tone="muted">
              {selectedBundle.description ?? selectedBundle.id} · v{selectedBundle.version}
            </Text>
          </div>
        </Flex>

        {selectedBundle.permissions.length ? (
          <section>
            <Text className="preference-section-title" weight="semibold">
              {messages.permissions}
            </Text>
            <div className="bundle-permission-list">
              {selectedBundle.permissions.map((permission) => (
                <span key={permission}>{permission}</span>
              ))}
            </div>
          </section>
        ) : null}

        {selectedRuntime?.providers.length ? selectedRuntime.providers.map((provider) => (
          <section className="bundle-provider-settings" key={provider.id}>
            <div className="bundle-provider-heading">
              <Text className="preference-section-title" weight="semibold">
                {provider.title}
              </Text>
              {provider.description ? (
                <Text size="xs" tone="muted">{provider.description}</Text>
              ) : null}
            </div>
            {provider.settings.length ? provider.settings.map((category) => (
              <div className="bundle-setting-category" key={category.id}>
                <Text weight="semibold">
                  {resolveProviderText(category.title, preferences.appLocale)}
                </Text>
                {category.description ? (
                  <Text size="xs" tone="muted">
                    {resolveProviderText(category.description, preferences.appLocale)}
                  </Text>
                ) : null}
                <Stack gap="md">
                  {category.settings.map((setting) => {
                    const title = resolveProviderText(setting.title, preferences.appLocale);
                    const description = setting.description
                      ? resolveProviderText(setting.description, preferences.appLocale)
                      : undefined;
                    if (setting.type === 'boolean') {
                      return (
                        <Switch
                          checked={getProviderBooleanSetting(
                            preferences,
                            provider.id,
                            setting.key,
                            setting.defaultValue,
                          )}
                          description={description}
                          disabled={saving}
                          key={setting.key}
                          label={title}
                          onCheckedChange={(value) =>
                            onUpdateProviderSetting(
                              preferences,
                              provider.id,
                              setting.key,
                              value,
                              onUpdate,
                            )
                          }
                        />
                      );
                    }
                    const value = preferences.providerSettings[provider.id]?.[setting.key];
                    const items = Array.isArray(value) ? value : [];
                    return (
                      <ProviderItemListSetting
                        description={description}
                        disabled={saving}
                        emptyText={setting.emptyText
                          ? resolveProviderText(setting.emptyText, preferences.appLocale)
                          : messages.empty}
                        items={items}
                        key={setting.key}
                        messages={messages}
                        theme={preferences.appTheme}
                        title={title}
                        onChange={(nextItems) =>
                          onUpdateProviderSetting(
                            preferences,
                            provider.id,
                            setting.key,
                            nextItems,
                            onUpdate,
                          )
                        }
                      />
                    );
                  })}
                </Stack>
              </div>
            )) : (
              <Text size="sm" tone="muted">{messages.noProviderSettings}</Text>
            )}
          </section>
        )) : (
          <Text size="sm" tone="muted">{messages.noProviderSettings}</Text>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <section>
        <Flex align="start" justify="between" gap="lg">
          <div className="bundle-heading-copy">
            <Text className="preference-section-title" weight="semibold">
              {messages.bundleManagement}
            </Text>
            <Text size="xs" tone="muted">
              {messages.bundlesDescription}
            </Text>
          </div>
          <Button
            isLoading={installing}
            variant="secondary"
            onClick={() => void onInstall()}
          >
            {messages.addBundle}
          </Button>
        </Flex>
        <div className="bundle-trust-warning">
          <Text size="xs" tone="danger">
            {messages.bundleTrustWarning}
          </Text>
        </div>
        {notice ? (
          <Text className="bundle-install-notice" size="xs">
            {notice}
          </Text>
        ) : null}
      </section>

      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.installedBundles}
        </Text>
        {bundles.length ? (
          <Stack gap="sm">
            {bundles.map((bundle) => (
              <button
                className={`bundle-info-row is-${bundle.status}`}
                key={bundle.id}
                type="button"
                onClick={() => setSelectedBundleId(bundle.id)}
              >
                <Flex align="start" justify="between" gap="md">
                  <div className="bundle-info-copy">
                    <Flex align="center" gap="sm">
                      <Text weight="semibold">{bundle.name}</Text>
                      <span className={`bundle-source-badge is-${bundle.source}`}>
                        {bundle.source === 'built-in'
                          ? messages.builtInBundle
                          : messages.userBundle}
                      </span>
                    </Flex>
                    <Text size="xs" tone="muted">
                      {bundle.description ?? bundle.id}
                    </Text>
                  </div>
                  <Stack className="bundle-version-copy" gap="xs">
                    <Text size="xs" tone="muted">v{bundle.version}</Text>
                    <Text
                      size="xs"
                      tone={bundle.status === 'failed' ? 'danger' : 'muted'}
                    >
                      {getBundleStatusLabel(messages, bundle)}
                    </Text>
                  </Stack>
                </Flex>
                {bundle.status === 'active' ? (
                  <Text className="bundle-contributions" size="xs" tone="muted">
                    {formatBundleContributions(messages, bundle)}
                  </Text>
                ) : null}
                {bundle.permissions.length ? (
                  <div className="bundle-permission-list" aria-label={messages.permissions}>
                    {bundle.permissions.map((permission) => (
                      <span key={permission}>{permission}</span>
                    ))}
                  </div>
                ) : null}
                {bundle.error ? (
                  <Text className="bundle-error" size="xs" tone="danger">
                    {bundle.error}
                  </Text>
                ) : null}
              </button>
            ))}
          </Stack>
        ) : (
          <Text size="sm" tone="muted">{messages.noBundles}</Text>
        )}
      </section>
    </Stack>
  );
}

function ProviderItemListSetting({
  description,
  disabled,
  emptyText,
  items,
  messages,
  theme,
  title,
  onChange,
}: {
  readonly description?: string;
  readonly disabled: boolean;
  readonly emptyText: string;
  readonly items: readonly ProviderSettingListItem[];
  readonly messages: AppMessages;
  readonly theme: AppTheme;
  readonly title: string;
  readonly onChange: (items: readonly ProviderSettingListItem[]) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const visibleItems = items.slice(0, 5);
  const selected = new Set(selectedIds);
  const removeIds = (ids: ReadonlySet<string>) => {
    onChange(items.filter((item) => !ids.has(item.id)));
    setSelectedIds([]);
    if (ids.size === items.length) setDialogOpen(false);
  };

  const dialog = dialogOpen ? createPortal(
    <div
      className={`kawai-theme preference-dialog-backdrop bundle-list-dialog-backdrop ${
        theme === 'dark' ? 'kawai-theme-dark' : 'kawai-theme-light'
      }`}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        setSelectedIds([]);
        setDialogOpen(false);
      }}
    >
      <div
        aria-label={title}
        aria-modal="true"
        className="preference-dialog bundle-list-dialog"
        role="dialog"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Flex align="center" justify="between" gap="md">
          <Stack gap="xs">
            <Text weight="semibold">{title}</Text>
            <Text size="xs" tone="muted">
              {messages.bundleListCount.replace('{count}', String(items.length))}
            </Text>
          </Stack>
          <Button size="sm" variant="ghost" onClick={() => {
            setSelectedIds([]);
            setDialogOpen(false);
          }}>
            {messages.done}
          </Button>
        </Flex>
        <Flex className="bundle-list-actions" align="center" justify="between" gap="sm">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSelectedIds(
              selectedIds.length === items.length ? [] : items.map(({ id }) => id),
            )}
          >
            {selectedIds.length === items.length
              ? messages.clearSelection
              : messages.selectAll}
          </Button>
          <Button
            disabled={disabled || selectedIds.length === 0}
            size="sm"
            variant="secondary"
            onClick={() => removeIds(selected)}
          >
            {messages.removeSelected.replace('{count}', String(selectedIds.length))}
          </Button>
        </Flex>
        <div className="bundle-list-dialog-content">
          {items.map((item) => (
            <div
              className={`bundle-item-list-row is-dialog${selected.has(item.id) ? ' is-selected' : ''}`}
              key={item.id}
            >
              <input
                aria-label={item.label}
                checked={selected.has(item.id)}
                disabled={disabled}
                type="checkbox"
                onChange={() => setSelectedIds((current) =>
                  current.includes(item.id)
                    ? current.filter((id) => id !== item.id)
                    : [...current, item.id],
                )}
              />
              <ProviderListItemIdentity item={item} />
              {selectedIds.length === 0 ? (
                <Button
                  disabled={disabled}
                  size="sm"
                  variant="ghost"
                  onClick={() => removeIds(new Set([item.id]))}
                >
                  {messages.remove}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="bundle-item-list-setting">
      <Stack gap="xs">
        <Text size="sm" weight="semibold">{title}</Text>
        {description ? <Text size="xs" tone="muted">{description}</Text> : null}
      </Stack>
      {items.length ? (
        <div className="bundle-item-list-compact">
          {visibleItems.map((item) => (
            <div className="bundle-item-list-row" key={item.id}>
              <ProviderListItemIdentity item={item} />
              <Button
                disabled={disabled}
                size="sm"
                variant="ghost"
                onClick={() => removeIds(new Set([item.id]))}
              >
                {messages.remove}
              </Button>
            </div>
          ))}
          {items.length > 5 ? (
            <button
              className="bundle-item-list-more"
              type="button"
              onClick={() => setDialogOpen(true)}
            >
              <span>{messages.showMore}</span>
              <span aria-hidden="true" className="bundle-more-chevron">⌄</span>
            </button>
          ) : null}
        </div>
      ) : <Text size="xs" tone="muted">{emptyText}</Text>}
      {dialog}
    </div>
  );
}

function ProviderListItemIdentity({ item }: {
  readonly item: ProviderSettingListItem;
}) {
  const secondary = item.description ?? (item.label !== item.id ? item.id : undefined);
  return (
    <div className="bundle-list-identity">
      {item.imageUrl ? (
        <img alt="" className="bundle-list-avatar" src={item.imageUrl} />
      ) : (
        <span aria-hidden="true" className="bundle-list-avatar is-placeholder">
          {item.label.slice(0, 1).toUpperCase()}
        </span>
      )}
      <Stack gap="xs">
        <Text size="sm" weight="semibold">{item.label}</Text>
        {secondary ? <Text size="xs" tone="muted">{secondary}</Text> : null}
      </Stack>
    </div>
  );
}

function getBundleStatusLabel(
  messages: AppMessages,
  bundle: BundleInfo,
): string {
  if (bundle.status === 'active') return messages.bundleActive;
  if (bundle.status === 'restart-required') {
    return messages.bundleRestartRequired;
  }
  return messages.bundleFailed;
}

function formatBundleContributions(
  messages: AppMessages,
  bundle: BundleInfo,
): string {
  const contributions: string[] = [];
  if (bundle.providerCount) {
    contributions.push(`${String(bundle.providerCount)} ${messages.sites}`);
  }
  if (bundle.pluginCount) {
    contributions.push(`${String(bundle.pluginCount)} ${messages.plugins}`);
  }
  return contributions.join(' · ') || messages.emptyBundle;
}

function AppInfoTab({
  appInfo,
  checkingUpdates,
  developerYouTubeStatus,
  messages,
  preferences,
  saving,
  updateCheckResult,
  onCheckForUpdates,
  onOpenLogDirectory,
  onOpenLink,
  onUpdate,
}: {
  readonly appInfo?: ApplicationInfo;
  readonly checkingUpdates: boolean;
  readonly developerYouTubeStatus?: DeveloperYouTubeStatus;
  readonly messages: AppMessages;
  readonly preferences: PreferenceState;
  readonly saving: boolean;
  readonly updateCheckResult?: ApplicationUpdateCheckResult;
  readonly onCheckForUpdates: () => void | Promise<void>;
  readonly onOpenLogDirectory: () => void | Promise<void>;
  readonly onOpenLink: (id: ApplicationLinkId) => void | Promise<void>;
  readonly onUpdate: (patch: PreferencePatch) => void;
}) {
  const updateStatus = getUpdateStatusMessage(messages, updateCheckResult);
  return (
    <Stack gap="lg">
      <div className="app-info-links">
        <DeveloperLinks
          messages={messages}
          youtubeStatus={developerYouTubeStatus}
          onOpen={onOpenLink}
        />
      </div>
      {appInfo ? (
        <div className="app-info-card">
          <Flex className="app-info-title" align="start" justify="between" gap="lg">
            <Flex className="app-info-identity" align="center" gap="sm">
              <img alt="" className="app-info-icon" src={kawaikaraIcon} />
              <Stack gap="xs">
                <Head level={2} size="sm">
                  {appInfo.name}
                </Head>
                <Text size="xs" tone="muted">
                  {messages.appDescription}
                </Text>
              </Stack>
            </Flex>
            <Switch
              className="app-info-auto-update"
              checked={preferences.automaticUpdates}
              controlClassName="app-info-auto-update-control"
              controlSize="sm"
              disabled={saving}
              label={messages.automaticUpdates}
              title={messages.automaticUpdatesDescription}
              onCheckedChange={(automaticUpdates) =>
                onUpdate({ automaticUpdates })
              }
            />
          </Flex>
          <div className="app-release-panel">
            <div className="app-release-row">
              <Text size="xs" tone="muted">{messages.channel}</Text>
              <div className="app-release-value">
                <Text className="app-channel-fixed" weight="semibold">
                  {getChannelLabel(messages, appInfo.buildChannel)}
                </Text>
              </div>
            </div>
            <div className="app-release-row">
              <Text size="xs" tone="muted">{messages.version}</Text>
              <Flex className="app-release-value" align="center" justify="between" gap="sm">
                <Text className="app-version-value" weight="semibold">
                  {appInfo.version}
                </Text>
                <Button
                  isLoading={checkingUpdates}
                  size="sm"
                  variant="secondary"
                  onClick={() => void onCheckForUpdates()}
                >
                  {messages.checkForUpdates}
                </Button>
              </Flex>
            </div>
          </div>
          {checkingUpdates || updateStatus ? (
            <Text
              className={`app-update-status${updateCheckResult?.status === 'error' ? ' is-error' : ''}`}
              size="xs"
              tone={updateCheckResult?.status === 'error' ? 'danger' : 'muted'}
            >
              {checkingUpdates ? messages.checkingForUpdates : updateStatus}
            </Text>
          ) : null}
          <InfoRow label="Site API" value={`v${String(appInfo.siteApiVersion)}`} />
          <InfoRow
            label={messages.runtime}
            value={`Electron ${appInfo.electronVersion} · Chrome ${appInfo.chromeVersion}`}
          />
          <InfoRow
            label={messages.platform}
            value={`${appInfo.platform} · ${appInfo.arch}`}
          />
          <Flex className="app-log-row" align="center" justify="between" gap="md">
            <Stack gap="xs">
              <Text size="sm">{messages.diagnosticLogs}</Text>
              <Text size="xs" tone="muted">
                {messages.diagnosticLogsDescription}
              </Text>
            </Stack>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void onOpenLogDirectory()}
            >
              {messages.openLogDirectory}
            </Button>
          </Flex>
        </div>
      ) : null}
    </Stack>
  );
}

function getChannelLabel(messages: AppMessages, channel: ReleaseChannel): string {
  return {
    stable: messages.stableChannel,
    staging: messages.stagingChannel,
    nightly: messages.nightlyChannel,
  }[channel];
}

function getUpdateStatusMessage(
  messages: AppMessages,
  result?: ApplicationUpdateCheckResult,
): string | undefined {
  if (!result) return undefined;
  if (result.status === 'up-to-date') return messages.latestVersion;
  if (result.status === 'unsupported') return messages.updateUnavailable;
  if (result.status === 'error') return messages.updateCheckFailed;
  return messages.updateAvailable.replace(
    '{version}',
    result.latestVersion ?? '',
  );
}

function InfoRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Flex className="app-info-row" align="center" justify="between" gap="md">
      <Text size="sm" tone="muted">{label}</Text>
      <Text size="sm">{value}</Text>
    </Flex>
  );
}

function appLocaleOptions(messages: AppMessages) {
  return [
    { label: messages.system, value: 'system' },
    { label: messages.korean, value: 'ko-KR' },
    { label: messages.english, value: 'en-US' },
    { label: messages.japanese, value: 'ja-JP' },
  ];
}

function appThemeOptions(messages: AppMessages) {
  return [
    { label: messages.darkTheme, value: 'dark' },
    { label: messages.lightTheme, value: 'light' },
  ];
}

function devToolsModeOptions(messages: AppMessages) {
  return [
    { label: messages.devToolsPlacementDetach, value: 'detach' },
    { label: messages.devToolsPlacementUndocked, value: 'undocked' },
    { label: messages.devToolsPlacementRight, value: 'right' },
    { label: messages.devToolsPlacementBottom, value: 'bottom' },
    { label: messages.devToolsPlacementLeft, value: 'left' },
  ];
}

function preferencesEqual(
  left: PreferenceState,
  right: PreferenceState,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getEffectiveShortcut(
  item: ShortcutItem,
  shortcuts: Readonly<Record<string, string>>,
): string {
  return Object.prototype.hasOwnProperty.call(shortcuts, item.id)
    ? shortcuts[item.id] ?? ''
    : item.defaultKey;
}

function getProviderBooleanSetting(
  preferences: PreferenceState,
  providerId: string,
  key: string,
  fallback: boolean,
): boolean {
  const value = preferences.providerSettings[providerId]?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

function onUpdateProviderSetting(
  preferences: PreferenceState,
  providerId: string,
  key: string,
  value: boolean | readonly ProviderSettingListItem[],
  onUpdate: (patch: PreferencePatch) => void,
): void {
  onUpdate({
    providerSettings: {
      ...preferences.providerSettings,
      [providerId]: {
        ...(preferences.providerSettings[providerId] ?? {}),
        [key]: value,
      },
    },
  });
}

function resolveProviderText(
  value: ProviderLocalizedText,
  locale: AppLocale,
): string {
  if (typeof value === 'string') return value;
  const requested = locale === 'system' ? navigator.language : locale;
  const language = requested.split('-')[0]?.toLowerCase();
  const match = Object.entries(value).find(([key]) =>
    key.toLowerCase() === requested.toLowerCase(),
  )?.[1] ?? Object.entries(value).find(([key]) =>
    key.split('-')[0]?.toLowerCase() === language,
  )?.[1];
  return match ?? value.default ?? value['en-US'] ?? Object.values(value)[0] ?? '';
}

function writeShortcutOverride(
  current: Readonly<Record<string, string>>,
  item: ShortcutItem,
  accelerator: string,
): Record<string, string> {
  const shortcuts = { ...current };
  if (accelerator === item.defaultKey) delete shortcuts[item.id];
  else shortcuts[item.id] = accelerator;
  return shortcuts;
}

function findShortcutConflicts(
  targetId: string,
  items: readonly ShortcutItem[],
  shortcuts: Readonly<Record<string, string>>,
): string[] {
  const target = items.find((item) => item.id === targetId);
  if (!target) return [];
  const value = normalizeAccelerator(getEffectiveShortcut(target, shortcuts));
  if (!value) return [];
  return items
    .filter(
      (item) =>
        item.id !== targetId &&
        normalizeAccelerator(getEffectiveShortcut(item, shortcuts)) === value,
    )
    .map((item) => item.id);
}

function findDuplicateShortcutIds(
  items: readonly ShortcutItem[],
  shortcuts: Readonly<Record<string, string>>,
): Set<string> {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const accelerator = normalizeAccelerator(
      getEffectiveShortcut(item, shortcuts),
    );
    if (!accelerator) continue;
    const ids = groups.get(accelerator) ?? [];
    ids.push(item.id);
    groups.set(accelerator, ids);
  }
  return new Set(
    [...groups.values()].filter((ids) => ids.length > 1).flat(),
  );
}

function normalizeAccelerator(accelerator: string): string {
  const isMac = isMacPlatform();
  const parts = accelerator
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .map((part) => {
      const aliases: Record<string, string> = {
        commandorcontrol: isMac ? 'command' : 'control',
        cmdorctrl: isMac ? 'command' : 'control',
        cmd: 'command',
        ctrl: 'control',
        option: 'alt',
        super: isMac ? 'command' : 'super',
        arrowleft: 'left',
        arrowright: 'right',
        arrowup: 'up',
        arrowdown: 'down',
        return: 'enter',
        esc: 'escape',
        comma: ',',
        space: ' ',
        spacebar: ' ',
      };
      return aliases[part] ?? part;
    });
  const key = parts.pop();
  if (!key) return '';
  const modifierOrder = ['command', 'control', 'alt', 'shift', 'super'];
  const modifiers = parts.sort(
    (left, right) =>
      modifierOrder.indexOf(left) - modifierOrder.indexOf(right),
  );
  return [...modifiers, key].join('+');
}

function createAccelerator(event: KeyboardEvent<HTMLInputElement>): string {
  const isMac = isMacPlatform();
  const modifiers: string[] = [];
  if (event.metaKey) modifiers.push(isMac ? 'Command' : 'Super');
  if (event.ctrlKey) modifiers.push('Control');
  if (event.altKey) modifiers.push(isMac ? 'Option' : 'Alt');
  if (event.shiftKey) modifiers.push('Shift');

  if (isModifierKey(event.key)) return modifiers.join('+');

  let key = event.key;
  if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
  else if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
  else {
    const aliases: Record<string, string> = {
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ' ': 'Space',
      ',': 'Comma',
    };
    key = aliases[key] ?? key;
  }
  return [...modifiers, key].join('+');
}

function formatAccelerator(accelerator: string): string[] {
  const isMac = isMacPlatform();
  return accelerator
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const normalized = part.toLowerCase();
      const labels: Record<string, string> = isMac
        ? {
            commandorcontrol: '⌘',
            cmdorctrl: '⌘',
            command: '⌘',
            cmd: '⌘',
            control: '⌃',
            ctrl: '⌃',
            alt: '⌥',
            option: '⌥',
            shift: '⇧',
            super: '⌘',
          }
        : {
            commandorcontrol: 'Ctrl',
            cmdorctrl: 'Ctrl',
            command: 'Win',
            cmd: 'Win',
            control: 'Ctrl',
            ctrl: 'Ctrl',
            alt: 'Alt',
            option: 'Alt',
            shift: 'Shift',
            super: 'Win',
          };
      if (labels[normalized]) return labels[normalized];
      if (normalized === 'comma') return ',';
      if (normalized === 'space' || normalized === 'spacebar') return 'Space';
      if (part.length === 1) return part.toUpperCase();
      return part;
    });
}

function isModifierKey(key: string): boolean {
  return ['Meta', 'Control', 'Alt', 'Shift'].includes(key);
}

function isMacPlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}
