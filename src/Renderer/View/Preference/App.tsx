import {
  Button,
  Flex,
  Head,
  Text
} from '@kawaikara/kawai-ui';
import { AnimatePresence, motion } from 'motion/react';
import {
  useEffect,
  useMemo
} from 'react';
import { LogViewer } from '../LogViewer/App';
import { useBundleActions } from './Hooks/useBundleActions';
import { useDevelopmentActions } from './Hooks/useDevelopmentActions';
import { useGraphicsModeChange } from './Hooks/useGraphicsModeChange';
import { usePreferenceApplicationActions } from './Hooks/usePreferenceApplicationActions';
import { usePreferenceDataActions } from './Hooks/usePreferenceDataActions';
import { usePreferenceDraft } from './Hooks/usePreferenceDraft';
import { usePreferenceInitialization } from './Hooks/usePreferenceInitialization';
import { usePreferenceState } from './Hooks/usePreferenceState';
import { useShortcutItems } from './Hooks/useShortcutItems';
import { useShortcutOverrides } from './Hooks/useShortcutOverrides';
import { MenuOrderEditor } from './MenuOrder/MenuOrderEditor';
import { PreferenceTabs } from './PreferenceTabs';
import { PreferenceViewProps } from './Types';

export type { PreferenceViewProps } from './Types';
/** Performs the preference view operation. */
export function PreferenceView({
  initialLocale,
  initialMessages,
  initialLogViewerMessages,
  sites,
  onBack,
  onBackHandlerChange,
  onMessagesChange,
  onPreferencesChange,
  onThemePreview,
}: PreferenceViewProps) {

  const preferenceState = usePreferenceState({
    initialMessages,
    initialLogViewerMessages,
    initialLocale,
  });
  const {
    draftPreferences,
    dataNotice,
    saving,
    error,
    shortcutConflict,
    graphicsRestartRequest,
    setGraphicsRestartRequest,
    menuOrderEditorOpen,
    setMenuOrderEditorOpen,
    discardConfirmationOpen,
    setDiscardConfirmationOpen,
    messages,
    logViewerMessages,
    resolvedLocale,
    logViewerOpen,
    setLogViewerOpen,
  } = preferenceState;

  usePreferenceInitialization({
    ...preferenceState,
    onMessagesChange,
  });

  useEffect(() => {
    if (!menuOrderEditorOpen) return;
    /** Handles the key down. */
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMenuOrderEditorOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [menuOrderEditorOpen]);

  const siteOptions = useMemo(
    () => sites.map((site) => ({
      label: site.title, value: site.id
    })),
    [sites],
  );

  const shortcutItems = useShortcutItems({
    ...preferenceState,
    sites,
  });

  const preferenceDraft = usePreferenceDraft({
    ...preferenceState,
    onThemePreview,
    onBack,
    onBackHandlerChange,
    onPreferencesChange,
  });
  const {
    hasChanges,
    updateDraft,
    completeBack,
    requestBack,
    save,
  } = preferenceDraft;

  const graphicsModeChange = useGraphicsModeChange({
    ...preferenceState,
    onPreferencesChange,
  });
  const {
    applyGraphicsModeChange,
  } = graphicsModeChange;

  const preferenceApplicationActions = usePreferenceApplicationActions({
    ...preferenceDraft,
  });

  const bundleActions = useBundleActions({
    ...preferenceState,
  });

  const developmentActions = useDevelopmentActions({
    ...preferenceDraft,
    ...preferenceState,
    ...bundleActions,
  });

  const preferenceDataActions = usePreferenceDataActions({
    ...preferenceState,
  });

  const shortcutOverrides = useShortcutOverrides({
    ...preferenceState,
    ...shortcutItems,
    ...preferenceDraft,
  });
  const {
    cancelShortcutOverwrite,
    confirmShortcutOverwrite,
    conflictNames,
  } = shortcutOverrides;

  return (
    <main
      className={`kawai-theme preference-shell ${(draftPreferences?.appTheme ?? 'dark') === 'dark'
          ? 'kawai-theme-dark'
          : 'kawai-theme-light'
        }`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestBack();
      }}
    >
      <div className="preference-surface" inert={logViewerOpen ? true : undefined}>
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
            <PreferenceTabs
              {...preferenceState}
              {...preferenceDraft}
              {...preferenceDataActions}
              {...graphicsModeChange}
              {...shortcutItems}
              {...shortcutOverrides}
              {...bundleActions}
              {...developmentActions}
              {...preferenceApplicationActions}
              draftPreferences={draftPreferences}
              siteOptions={siteOptions}
              sites={sites}
            />
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

        {draftPreferences && dataNotice ? (
          <Text className="preference-data-notice" size="xs">
            {dataNotice}
          </Text>
        ) : null}

        <AnimatePresence>
          {hasChanges ? (
            <motion.div
              className="preference-save-bar"
              initial={{
                opacity: 0, y: 28
              }}
              animate={{
                opacity: 1, y: 0
              }}
              exit={{
                opacity: 0, y: 28
              }}
              transition={{
                type: 'spring', stiffness: 420, damping: 32
              }}
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
        {logViewerOpen ? (
          <motion.div
            animate={{
              opacity: 1, scale: 1, y: 0
            }}
            className="log-viewer-motion-shell"
            exit={{
              opacity: 0, scale: 0.985, y: 10
            }}
            initial={{
              opacity: 0, scale: 0.985, y: 10
            }}
            transition={{
              duration: 0.2, ease: [0.22, 1, 0.36, 1]
            }}
          >
            <LogViewer
              locale={resolvedLocale}
              messages={logViewerMessages}
              onClose={() => setLogViewerOpen(false)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

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
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            exit={{
              opacity: 0
            }}
          >
            <motion.div
              aria-describedby="graphics-restart-description"
              aria-labelledby="graphics-restart-title"
              aria-modal="true"
              className="preference-dialog"
              role="dialog"
              initial={{
                opacity: 0, scale: 0.96, y: 12
              }}
              animate={{
                opacity: 1, scale: 1, y: 0
              }}
              exit={{
                opacity: 0, scale: 0.96, y: 12
              }}
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
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            exit={{
              opacity: 0
            }}
          >
            <motion.div
              aria-describedby="shortcut-conflict-description"
              aria-labelledby="shortcut-conflict-title"
              aria-modal="true"
              className="preference-dialog"
              role="dialog"
              initial={{
                opacity: 0, scale: 0.96, y: 12
              }}
              animate={{
                opacity: 1, scale: 1, y: 0
              }}
              exit={{
                opacity: 0, scale: 0.96, y: 12
              }}
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
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            exit={{
              opacity: 0
            }}
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
              initial={{
                opacity: 0, scale: 0.96, y: 12
              }}
              animate={{
                opacity: 1, scale: 1, y: 0
              }}
              exit={{
                opacity: 0, scale: 0.96, y: 12
              }}
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
