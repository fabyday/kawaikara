import {
  Tab,
  TabList,
  TabPanel,
  Tabs
} from '@kawaikara/kawai-ui';
import { type useBundleActions } from './Hooks/useBundleActions';
import { type useDevelopmentActions } from './Hooks/useDevelopmentActions';
import { type useGraphicsModeChange } from './Hooks/useGraphicsModeChange';
import { type usePreferenceApplicationActions } from './Hooks/usePreferenceApplicationActions';
import { type usePreferenceDataActions } from './Hooks/usePreferenceDataActions';
import { type usePreferenceDraft } from './Hooks/usePreferenceDraft';
import { type usePreferenceState } from './Hooks/usePreferenceState';
import { type useShortcutItems } from './Hooks/useShortcutItems';
import { type useShortcutOverrides } from './Hooks/useShortcutOverrides';
import { PreferenceTabScroll } from './PreferenceTabScroll';
import { ShortcutSection } from './Shortcuts/ShortcutSection';
import { AppInfoTab } from './Tabs/AppInfoTab';
import { AdvancedTab } from './Tabs/AdvancedTab';
import { BrowserProfilesTab } from './Tabs/BrowserProfilesTab';
import { BundlesTab } from './Tabs/BundlesTab';
import { DeveloperTab } from './Tabs/DeveloperTab';
import { GeneralTab } from './Tabs/GeneralTab';
import { VideoTab } from './Tabs/VideoTab';
import { PreferenceViewProps } from './Types';

/** Inputs for the PreferenceTabs section. */
type PreferenceTabsProps = Pick<ReturnType<typeof usePreferenceState>,
  | 'messages'
  | 'setBundleTabActivation'
  | 'dataActionId'
  | 'displays'
  | 'graphicsRestartRequest'
  | 'saving'
  | 'setMenuOrderEditorOpen'
  | 'runtimeBundles'
  | 'bundles'
  | 'bundleTabActivation'
  | 'installingBundle'
  | 'bundleActionId'
  | 'bundleNotice'
  | 'developmentActionId'
  | 'developmentState'
  | 'developmentNotice'
  | 'appInfo'
  | 'checkingUpdates'
  | 'developerYouTubeStatus'
  | 'updateCheckResult'
  | 'setLogViewerOpen'
> & Pick<ReturnType<typeof usePreferenceDraft>,
  | 'hasChanges'
  | 'updateDraft'
  | 'checkForUpdates'
  | 'openApplicationLink'
> & Pick<PreferenceViewProps,
  | 'sites'
> & Pick<ReturnType<typeof usePreferenceDataActions>,
  | 'clearApplicationCache'
  | 'resetApplication'
  | 'clearAllBrowserProfiles'
  | 'clearIsolatedSiteData'
  | 'clearBrowserProfileData'
> & Pick<ReturnType<typeof useGraphicsModeChange>,
  | 'requestGraphicsModeChange'
> & Pick<ReturnType<typeof useShortcutItems>,
  | 'duplicateShortcutIds'
  | 'categoryShortcutItems'
  | 'providerShortcutItems'
  | 'videoShortcutItems'
  | 'shortFormVideoShortcutItems'
  | 'appShortcutItems'
  | 'siteShortcutItems'
> & Pick<ReturnType<typeof useShortcutOverrides>,
  | 'updateShortcut'
> & Pick<ReturnType<typeof useBundleActions>,
  | 'installBundle'
  | 'removeBundle'
  | 'updateBundle'
> & Pick<ReturnType<typeof useDevelopmentActions>,
  | 'attachDevelopmentProject'
  | 'copyVsCodeConfiguration'
  | 'detachDevelopmentProject'
  | 'rebuildDevelopmentProject'
  | 'setDevelopmentHotReload'
> & Pick<ReturnType<typeof usePreferenceApplicationActions>,
  | 'openDevTools'
  | 'openLogDirectory'
> & {
  /** The draftPreferences value for this section. */
  readonly draftPreferences: NonNullable<ReturnType<typeof usePreferenceState>['draftPreferences']>;
  /** The siteOptions value for this section. */
  readonly siteOptions: {
    /** Site title shown in the selector. */
    label: string;
    /** Descriptor ID used when saving the default site. */
    value: string;
  }[];
};

/** Renders the PreferenceTabs section of this View. */
export function PreferenceTabs({
  messages,
  setBundleTabActivation,
  dataActionId,
  hasChanges,
  displays,
  graphicsRestartRequest,
  draftPreferences,
  saving,
  siteOptions,
  sites,
  setMenuOrderEditorOpen,
  clearApplicationCache,
  requestGraphicsModeChange,
  resetApplication,
  updateDraft,
  runtimeBundles,
  clearAllBrowserProfiles,
  clearIsolatedSiteData,
  clearBrowserProfileData,
  duplicateShortcutIds,
  categoryShortcutItems,
  updateShortcut,
  providerShortcutItems,
  videoShortcutItems,
  shortFormVideoShortcutItems,
  appShortcutItems,
  siteShortcutItems,
  bundles,
  bundleTabActivation,
  installingBundle,
  bundleActionId,
  bundleNotice,
  installBundle,
  removeBundle,
  updateBundle,
  developmentActionId,
  developmentState,
  developmentNotice,
  attachDevelopmentProject,
  copyVsCodeConfiguration,
  detachDevelopmentProject,
  openDevTools,
  rebuildDevelopmentProject,
  setDevelopmentHotReload,
  appInfo,
  checkingUpdates,
  developerYouTubeStatus,
  updateCheckResult,
  checkForUpdates,
  openLogDirectory,
  setLogViewerOpen,
  openApplicationLink,
}: PreferenceTabsProps) {
  return (
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
        <Tab value="advanced">{messages.advanced}</Tab>
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
            dataActionId={dataActionId}
            dataActionsDisabled={hasChanges}
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
            onClearApplicationCache={clearApplicationCache}
            onGraphicsModeChange={requestGraphicsModeChange}
            onResetApplication={resetApplication}
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
            dataActionId={dataActionId}
            dataActionsDisabled={hasChanges}
            messages={messages}
            bundles={runtimeBundles}
            preferences={draftPreferences}
            saving={saving}
            sites={sites}
            onClearAllBrowserProfiles={clearAllBrowserProfiles}
            onClearIsolatedSiteData={clearIsolatedSiteData}
            onClearProfileData={clearBrowserProfileData}
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

      <TabPanel className="preference-tab-panel" value="advanced">
        <PreferenceTabScroll label={messages.advanced}>
          <AdvancedTab
            messages={messages}
            preferences={draftPreferences}
            saving={saving}
            onUpdate={updateDraft}
          />
        </PreferenceTabScroll>
      </TabPanel>

      <TabPanel className="preference-tab-panel" value="bundles">
        <PreferenceTabScroll label={messages.bundles}>
          <BundlesTab
            bundles={bundles}
            activationToken={bundleTabActivation}
            installing={installingBundle}
            actionBundleId={bundleActionId}
            messages={messages}
            notice={bundleNotice}
            preferences={draftPreferences}
            runtimeBundles={runtimeBundles}
            saving={saving}
            onInstall={installBundle}
            onRemoveBundle={removeBundle}
            onUpdateBundle={updateBundle}
            onUpdate={updateDraft}
          />
        </PreferenceTabScroll>
      </TabPanel>

      <TabPanel className="preference-tab-panel" value="developer">
        <PreferenceTabScroll label={messages.developer}>
          <DeveloperTab
            actionId={developmentActionId}
            developmentState={developmentState}
            messages={messages}
            notice={developmentNotice}
            preferences={draftPreferences}
            saving={saving}
            onAddProject={attachDevelopmentProject}
            onCopyVsCodeConfiguration={copyVsCodeConfiguration}
            onDetachProject={detachDevelopmentProject}
            onOpenDevTools={openDevTools}
            onRebuildProject={rebuildDevelopmentProject}
            onSetHotReload={setDevelopmentHotReload}
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
            onOpenLogViewer={() => setLogViewerOpen(true)}
            onOpenLink={openApplicationLink}
            onUpdate={updateDraft}
          />
        </PreferenceTabScroll>
      </TabPanel>
    </Tabs>
  );
}
