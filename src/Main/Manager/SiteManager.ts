import {
  getPluginMetadata,
  getProviderMetadata,
  type AbstractPlugin,
  type AbstractProvider,
  type BundleDefinition,
  type Disposable,
  type NewWindowPolicy,
  type PluginConstructor,
  type PluginDefinition,
  type PluginViewPanelContribution,
  type ProviderConstructor,
  type ProviderDefinition,
  type ProviderLocalizedText,
  type ProviderMetadata,
  type ProviderSettings,
  type ShortFormVideoContribution,
  type ShortFormVideoPublisher,
  type SiteContext,
  type SiteLocaleContext,
  type SitePagePipeline,
  type SitePermission,
  type SiteRequestDetails,
  type SiteRequestHeaders,
  type SiteRequestRedirect,
} from '@kawaikara/site-api';
import type {
  BrowserProfileInfo,
  BundleRuntimeInfo,
  PluginViewPanelInfo,
  PreferenceState,
  SiteMenuItem,
} from '../../Common/IPC';
import {
  createPagePictureInPicturePolicyScript,
  shouldSuppressPagePictureInPicture,
} from '../Functional/PagePictureInPicturePolicy';
import { resolvePictureInPictureOverlaySelectors } from '../Functional/PictureInPictureOverlays';
import {
  resolveGlobalLocale,
  resolveProviderLocaleContributions,
} from '../Functional/ProviderLocale';
import {
  cloneLocalizedText,
  createAcceptLanguage,
  createIsolatedRuntime,
  createPluginBrowserProfileId,
  createSharedRuntime,
  isNavigationAborted,
  normalizeAddressInput,
  setHeader,
  validatePanelContributions,
  validateProviderContributions,
  type BrowserDataTarget,
  type RegisteredBundle,
  type RegisteredProvider,
  type RegisteredRuntimePlugin,
  type ResolvedSiteAddress,
  type SiteContextFactory,
  type SiteRuntimeProfile,
} from '../Functional/SiteRuntime';

/** Coordinates site behavior. */
export class SiteManager {
  /** The sites value. */
  private readonly sites = new Map<string, RegisteredProvider>();
  /** The bundles value. */
  private readonly bundles = new Map<string, RegisteredBundle>();
  /** The runtime plugins value. */
  private readonly runtimePlugins = new Map<string, RegisteredRuntimePlugin>();
  /** The current provider value. */
  private currentProvider?: AbstractProvider;
  /** The current plugins value. */
  private readonly currentPlugins: AbstractPlugin[] = [];
  /** The current site ID value. */
  private currentSiteId?: string;
  /** The current locale value. */
  private currentLocale?: SiteLocaleContext;
  /** The current runtime value. */
  private currentRuntime?: SiteRuntimeProfile;
  /** The current page pipeline value. */
  private currentPagePipeline?: SitePagePipeline;
  /** The current runtime disposables value. */
  private readonly currentRuntimeDisposables: Disposable[] = [];
  /** The current page policy disposables value. */
  private readonly currentPagePolicyDisposables: Disposable[] = [];
  /** The plugin browser profiles value. */
  private readonly pluginBrowserProfiles = new Map<string, BrowserProfileInfo>();
  /** Serializes Provider teardown and activation across every caller. */
  private siteTransition: Promise<void> = Promise.resolve();

  /** Creates an instance of SiteManager. */
  constructor(
    /** The create context value. */
    private readonly createContext: SiteContextFactory,
    /** Callback used to handle get preferences. */
    private readonly getPreferences: () => PreferenceState,
    /** Callback used to handle get current address. */
    private readonly getCurrentAddress: () => string,
  ) {}

  /** Registers the bundle. */
  registerBundle(bundle: BundleDefinition): void {
    this.assertBundleIdAvailable(bundle.id);
    if (bundle.providers.length === 0) {
      throw new Error(`Bundle ${bundle.id} must contain at least one Provider.`);
    }
    const browserProfiles = this.createBundleBrowserProfiles(bundle);
    const localProfileIds = new Set(
      (bundle.browserProfiles ?? []).map((profile) => profile.id),
    );
    const grantedPermissions = new Set(bundle.permissions);
    const stagedProviders = bundle.providers.map((definition) =>
      this.createRegistration(
        bundle.id,
        definition,
        localProfileIds,
        grantedPermissions,
      ),
    );
    const stagedPlugins = [
      ...bundle.plugins.map((definition) =>
        this.createPluginRegistration(bundle.id, definition),
      ),
      ...bundle.providers.flatMap((definition) =>
        definition.plugins.map((pluginDefinition) =>
          this.createPluginRegistration(
            bundle.id,
            pluginDefinition,
            definition.manifest.id,
          ),
        ),
      ),
    ];
    if (
      stagedPlugins.some(({ metadata }) => metadata.panels?.length) &&
      !grantedPermissions.has('plugin-view')
    ) {
      throw new Error(`Bundle ${bundle.id} requires Bundle permission plugin-view.`);
    }

    const stagedIds = new Set<string>();
    for (const registration of stagedProviders) {
      const id = registration.metadata.id;
      if (this.sites.has(id) || stagedIds.has(id)) {
        throw new Error(`Provider id ${id} is already registered.`);
      }
      stagedIds.add(id);
    }
    const stagedPluginIds = new Set<string>();
    for (const registration of stagedPlugins) {
      const id = registration.metadata.id;
      if (this.runtimePlugins.has(id) || stagedPluginIds.has(id)) {
        throw new Error(`Plugin id ${id} is already registered.`);
      }
      stagedPluginIds.add(id);
    }
    const actionShortcutIds = new Set(
      [...this.sites.values()].flatMap(({ metadata }) =>
        (metadata.shortcut?.actions ?? []).map(({ id }) => id),
      ),
    );
    for (const registration of stagedProviders) {
      for (const shortcut of registration.metadata.shortcut?.actions ?? []) {
        if (actionShortcutIds.has(shortcut.id)) {
          throw new Error(`Provider action shortcut id ${shortcut.id} is already registered.`);
        }
        actionShortcutIds.add(shortcut.id);
      }
    }
    for (const profile of browserProfiles) {
      if (this.pluginBrowserProfiles.has(profile.id)) {
        throw new Error(`Browser profile ${profile.id} is already registered.`);
      }
    }

    for (const registration of stagedProviders) {
      this.sites.set(registration.metadata.id, registration);
    }
    for (const registration of stagedPlugins) {
      this.runtimePlugins.set(registration.metadata.id, registration);
    }
    for (const profile of browserProfiles) {
      this.pluginBrowserProfiles.set(profile.id, profile);
    }
    this.bundles.set(bundle.id, {
      browserProfiles,
      definition: bundle,
      providerCount: stagedProviders.length,
      pluginCount: stagedPlugins.length,
    });
  }

  /** Removes staged registrations after an install failure or safe unload. */
  rollbackBundleRegistration(bundleId: string): void {
    const registered = this.bundles.get(bundleId);
    if (!registered) return;
    for (const [siteId, site] of this.sites) {
      if (site.bundleId === bundleId) this.sites.delete(siteId);
    }
    for (const [pluginId, plugin] of this.runtimePlugins) {
      if (plugin.bundleId === bundleId) this.runtimePlugins.delete(pluginId);
    }
    for (const profile of registered.browserProfiles) {
      this.pluginBrowserProfiles.delete(profile.id);
    }
    this.bundles.delete(bundleId);
  }

  /**
   * Removes a registered Bundle and tears down its active Provider first.
   * Browser Session data is intentionally preserved across development reloads.
   */
  async unregisterBundle(bundleId: string): Promise<{
    /** Whether the active site ID option is enabled. */
    activeSiteId?: string;
    /** Whether the active URL option is enabled. */
    activeUrl?: string;
  }> {
    return this.runSiteTransition(async () => {
      const activeSiteId = this.currentSiteId;
      const activeRegistration = activeSiteId
        ? this.sites.get(activeSiteId)
        : undefined;
      const ownedActiveSiteId = activeRegistration?.bundleId === bundleId
        ? activeSiteId
        : undefined;
      const activeUrl = ownedActiveSiteId
        ? this.getCurrentAddress() || undefined
        : undefined;
      if (ownedActiveSiteId) await this.unloadCurrent();
      this.rollbackBundleRegistration(bundleId);
      return {
        /** Whether the active site ID option is enabled. */
        activeSiteId: ownedActiveSiteId,
        /** Whether the active URL option is enabled. */
        activeUrl,
      };
    });
  }

  /** Lists the menu items. */
  listMenuItems(): SiteMenuItem[] {
    return [...this.sites.values()]
      .map(({ metadata, bundleId }) => ({
        id: metadata.id,
        bundleId,
        title: metadata.title,
        addressHosts: [...(metadata.address?.hosts ?? [])],
        category: metadata.menu.category,
        icon: metadata.menu.icon,
        panels: this.listPluginViewPanels(metadata),
        order: metadata.menu.order ?? 0,
        defaultShortcut: metadata.shortcut?.defaultKey ?? '',
        actionShortcuts: (metadata.shortcut?.actions ?? []).map((shortcut) => ({
          id: shortcut.id,
          title: cloneLocalizedText(shortcut.title),
          description: shortcut.description
            ? cloneLocalizedText(shortcut.description)
            : undefined,
          defaultKey: shortcut.defaultKey,
          action: shortcut.action,
        })),
        supportedLocales: metadata.locale?.supportedLocales ?? [],
        defaultLocale: metadata.locale?.defaultLocale ?? 'inherit',
        defaultBrowserProfileId: metadata.isolation?.defaultBrowserProfile
          ? createPluginBrowserProfileId(
              bundleId,
              metadata.isolation.defaultBrowserProfile,
            )
          : undefined,
        drm: metadata.isolation?.drm === true,
        pictureInPictureEnabled:
          metadata.pictureInPicture?.enabled === true,
        isCurrent: metadata.id === this.currentSiteId,
      }))
      .sort(
        (left, right) =>
          left.category.localeCompare(right.category) ||
          left.order - right.order ||
          left.title.localeCompare(right.title),
      );
  }

  /** Lists the bundles. */
  listBundles(): BundleRuntimeInfo[] {
    return [...this.bundles.values()]
      .map(({ browserProfiles, definition, pluginCount, providerCount }) => ({
        kind: 'bundle' as const,
        id: definition.id,
        name: definition.name ?? definition.id,
        description: definition.description,
        version: definition.version,
        providerCount,
        pluginCount,
        supportedLocales: definition.locale?.supportedLocales ?? [],
        defaultLocale: definition.locale?.defaultLocale ?? 'inherit',
        browserProfiles,
        providers: [...this.sites.values()]
          .filter((provider) => provider.bundleId === definition.id)
          .map(({ metadata }) => ({
            id: metadata.id,
            title: metadata.title,
            description: metadata.description,
            settings: (metadata.settings?.categories ?? []).map((category) => ({
              id: category.id,
              title: cloneLocalizedText(category.title),
              description: category.description
                ? cloneLocalizedText(category.description)
                : undefined,
              settings: category.settings.map((setting) => setting.type === 'boolean'
                ? {
                    type: setting.type,
                    key: setting.key,
                    title: cloneLocalizedText(setting.title),
                    description: setting.description
                      ? cloneLocalizedText(setting.description)
                      : undefined,
                    defaultValue: setting.defaultValue,
                  }
                : {
                    type: setting.type,
                    key: setting.key,
                    title: cloneLocalizedText(setting.title),
                    description: setting.description
                      ? cloneLocalizedText(setting.description)
                      : undefined,
                    emptyText: setting.emptyText
                      ? cloneLocalizedText(setting.emptyText)
                      : undefined,
                  }),
            })),
            shortFormVideo: metadata.shortFormVideo
              ? {
                  previous: metadata.shortFormVideo.previous === true,
                  next: metadata.shortFormVideo.next === true,
                  autoAdvance: metadata.shortFormVideo.autoAdvance
                    ? { ...metadata.shortFormVideo.autoAdvance
                    }
                    : undefined,
                  publisherBan: metadata.shortFormVideo.publisherBan
                    ? { ...metadata.shortFormVideo.publisherBan
                    }
                    : undefined,
                }
              : undefined,
          }))
          .sort((left, right) => left.title.localeCompare(right.title)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  /** Determines whether the current site condition applies. */
  isCurrentSite(id: string): boolean {
    return this.currentSiteId === id;
  }

  /** Loads the operation. */
  async load(id: string): Promise<void> {
    await this.runSiteTransition(() => this.loadSite(id));
  }

  /** Loads one Provider while the site transition queue is held. */
  private async loadSite(id: string): Promise<void> {
    const registration = this.sites.get(id);
    if (!registration) {
      throw new Error(`Unknown site: ${id}`);
    }

    await this.unloadCurrent();

    const locale = this.resolveLocales(registration);
    const runtime = this.resolveBrowserProfile(registration);
    const permissions = new Set(registration.metadata.permissions ?? []);
    const context = await this.createContext(
      runtime,
      permissions,
    );
    const providerContext: SiteContext = {
      ...context,
      page: permissions.has('script-injection') ? context.page : undefined,
      locale,
    };
    this.currentPagePipeline = context.page;
    this.activeContext = providerContext;
    const provider = new registration.constructor(providerContext);
    this.currentProvider = provider;
    this.currentSiteId = id;
    this.currentLocale = locale;
    this.currentRuntime = runtime;
    // Internal views have no navigable page to patch. Executing a page-world
    // policy in their detached, initial about:blank WebContents makes Electron
    // wait forever for did-stop-loading and leaves the site-open IPC pending.
    const refreshPagePictureInPicturePolicy = permissions.has('navigation')
      ? this.installPagePictureInPicturePolicy(
          context,
          registration.metadata,
        )
      : async () => undefined;
    try {
      this.installBrowserIdentity(providerContext, registration.metadata);
      await provider.onSettingsChanged(this.getProviderSettings(id));
      await this.activatePlugins(registration, providerContext);
      await provider.load();
      await refreshPagePictureInPicturePolicy();
    } catch (error) {
      this.disposeCurrentPagePolicy();
      await this.deactivateCurrentPlugins();
      await provider.unload();
      await providerContext.externalBrowser.close();
      this.currentPagePipeline?.dispose();
      this.currentPagePipeline = undefined;
      this.disposeCurrentRuntimeServices();
      this.currentProvider = undefined;
      this.currentSiteId = undefined;
      this.currentLocale = undefined;
      this.currentRuntime = undefined;
      this.activeContext = undefined;
      throw error;
    }
  }

  /** Opens the URL. */
  async openUrl(id: string, url: string): Promise<void> {
    await this.runSiteTransition(async () => {
      await this.loadSite(id);
      try {
        await this.currentProviderContext().viewer.loadURL(url);
      } catch (error) {
        // Streaming SPAs commonly replace the initial navigation. Electron
        // reports that successful hand-off as ERR_ABORTED.
        if (!isNavigationAborted(error)) {
          throw error;
        }
      }
    });
  }

  /** Returns the current site ID. */
  getCurrentSiteId(): string | undefined {
    return this.currentSiteId;
  }

  /** Returns the current short form video contribution. */
  getCurrentShortFormVideoContribution():
    | ShortFormVideoContribution
    | undefined {
    const registration = this.currentSiteId
      ? this.sites.get(this.currentSiteId)
      : undefined;
    return registration?.metadata.shortFormVideo;
  }

  /** Returns the current short form video publisher. */
  async getCurrentShortFormVideoPublisher(): Promise<
    ShortFormVideoPublisher | undefined
  > {
    return this.currentProvider?.getShortFormVideoPublisher();
  }

  /** Push the latest app-persisted values into the active Provider. */
  async applyCurrentProviderSettings(): Promise<void> {
    const provider = this.currentProvider;
    const siteId = this.currentSiteId;
    if (!provider || !siteId) return;
    await provider.onSettingsChanged(this.getProviderSettings(siteId));
  }

  /** Performs the refresh current browser profile operation. */
  async refreshCurrentBrowserProfile(): Promise<boolean> {
    const siteId = this.currentSiteId;
    if (!siteId) return false;
    const registration = this.sites.get(siteId);
    if (!registration) return false;
    const next = this.resolveBrowserProfile(registration);
    if (next.partition === this.currentRuntime?.partition) return false;
    await this.load(siteId);
    return true;
  }

  /** Resolves the browser profile data target. */
  resolveBrowserProfileDataTarget(profileId: string): BrowserDataTarget | undefined {
    const profile = this.findBrowserProfile(profileId, this.getPreferences());
    if (!profile) return undefined;
    const runtime = createSharedRuntime('', profile);
    return {
      /** The ID value. */
      id: profile.id,
      /** The name value. */
      name: profile.name,
      /** The partition value. */
      partition: runtime.partition,
    };
  }

  /** Resolves the isolated site data target. */
  resolveIsolatedSiteDataTarget(siteId: string): BrowserDataTarget | undefined {
    const registration = this.sites.get(siteId);
    if (!registration) return undefined;
    const runtime = this.resolveBrowserProfile(registration);
    if (runtime.id !== `isolated:${siteId}`) return undefined;
    return {
      /** The ID value. */
      id: siteId,
      /** The name value. */
      name: registration.metadata.title,
      /** The partition value. */
      partition: runtime.partition,
    };
  }

  /** Lists the browser data partitions. */
  listBrowserDataPartitions(): string[] {
    const preferences = this.getPreferences();
    const partitions = new Set<string>();
    for (const registration of this.sites.values()) {
      partitions.add(this.resolveBrowserProfile(registration).partition);
      partitions.add(createIsolatedRuntime(registration.metadata.id).partition);
    }
    for (const profile of this.pluginBrowserProfiles.values()) {
      partitions.add(createSharedRuntime('', profile).partition);
    }
    for (const profile of preferences.browserProfiles) {
      const resolved = this.findBrowserProfile(`user:${profile.id}`, preferences);
      if (resolved) partitions.add(createSharedRuntime('', resolved).partition);
    }
    return [...partitions];
  }

  /** Performs the with partition suspended operation. */
  async withPartitionSuspended<T>(
    partition: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.runSiteTransition(async () => {
      const siteId = this.currentRuntime?.partition === partition
        ? this.currentSiteId
        : undefined;
      if (siteId) await this.unloadCurrent();
      try {
        return await operation();
      } finally {
        if (siteId) await this.loadSite(siteId);
      }
    });
  }

  /** Resolves the new window policy. */
  resolveNewWindowPolicy(url: string): NewWindowPolicy {
    if (!this.currentProviderHasPermission('navigation')) return 'deny';
    return this.currentProvider?.onNewWindow(url) ?? 'deny';
  }

  /** Handles the action. */
  async handleAction(action: string): Promise<boolean> {
    return (await this.currentProvider?.onAction(action)) ?? false;
  }

  /** Returns the provider settings. */
  private getProviderSettings(providerId: string): ProviderSettings {
    return { ...(this.getPreferences().providerSettings[providerId] ?? {})
    };
  }

  /** Performs the allow navigation operation. */
  allowNavigation(url: string): boolean {
    if (!this.currentProviderHasPermission('navigation')) return false;
    return this.currentProvider?.allowNavigation(url) ?? false;
  }

  /** Resolves the address. */
  resolveAddress(value: string): ResolvedSiteAddress | undefined {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 16_384) return undefined;

    let target: URL;
    try {
      const parsed = new URL(normalizeAddressInput(trimmed));
      if (parsed.protocol === 'kawaikara:') {
        if (
          parsed.hostname !== 'open' ||
          (parsed.pathname !== '' && parsed.pathname !== '/') ||
          parsed.searchParams.getAll('url').length !== 1
        ) {
          return undefined;
        }
        const nested = parsed.searchParams.get('url');
        if (!nested) return undefined;
        target = new URL(normalizeAddressInput(nested));
      } else {
        target = parsed;
      }
    } catch {
      return undefined;
    }

    if (
      target.protocol !== 'https:' ||
      target.username ||
      target.password ||
      target.port
    ) {
      return undefined;
    }
    const hostname = target.hostname.toLowerCase();
    const match = [...this.sites.values()]
      .flatMap((registration) =>
        (registration.metadata.address?.hosts ?? []).map((host) => ({
          registration,
          host: host.toLowerCase(),
        })),
      )
      .filter(({ host }) =>
        hostname === host || hostname.endsWith(`.${host}`),
      )
      .sort((left, right) => right.host.length - left.host.length)[0];
    return match
      ? {
        /** The site ID value. */
        siteId: match.registration.metadata.id,
        /** The URL value. */
        url: target.href,
      }
      : undefined;
  }

  /** Performs the transform request operation. */
  transformRequest(details: SiteRequestDetails): SiteRequestRedirect | undefined {
    if (!this.currentProviderHasPermission('network-interception')) return undefined;
    return this.currentProvider?.onBeforeRequest(details);
  }

  /** Performs the allow picture in picture operation. */
  allowPictureInPicture(url: string): boolean {
    const registration = this.currentSiteId
      ? this.sites.get(this.currentSiteId)
      : undefined;
    if (registration?.metadata.pictureInPicture?.enabled !== true) return false;
    return this.currentProvider?.allowPictureInPicture(url) ?? false;
  }

  /** Returns the picture in picture content overlay selectors. */
  getPictureInPictureContentOverlaySelectors(): readonly string[] {
    if (!this.currentSiteId) return [];
    return resolvePictureInPictureOverlaySelectors(
      this.sites.get(this.currentSiteId)?.metadata.pictureInPicture
        ?.contentOverlaySelectors ?? []
    );
  }

  /** Performs the transform request headers operation. */
  transformRequestHeaders(
    details: SiteRequestDetails,
  ): SiteRequestHeaders | undefined {
    const transformed = this.currentProviderHasPermission('network-interception')
      ? this.currentProvider?.onBeforeSendHeaders(details)
      : undefined;
    const locale = this.currentLocale?.site;
    if (!locale || locale === 'system' || locale === 'inherit') {
      return transformed;
    }

    const headers = { ...(transformed ?? details.requestHeaders)
    };
    setHeader(headers, 'Accept-Language', createAcceptLanguage(locale));
    return headers;
  }

  /** Determines whether the unnamed declaration condition applies. */
  has(id: string): boolean {
    return this.sites.has(id);
  }

  /** Performs the current provider has permission operation. */
  private currentProviderHasPermission(permission: SitePermission): boolean {
    if (!this.currentSiteId) return false;
    return this.sites.get(this.currentSiteId)?.metadata.permissions
      ?.includes(permission) === true;
  }

  /** Releases the operation. */
  async dispose(): Promise<void> {
    await this.runSiteTransition(() => this.unloadCurrent());
  }

  /** Runs a site transition after every previously requested transition. */
  private runSiteTransition<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.siteTransition.then(operation, operation);
    this.siteTransition = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Creates the registration. */
  private createRegistration(
    bundleId: string,
    definition: ProviderDefinition,
    localProfileIds: ReadonlySet<string>,
    grantedPermissions: ReadonlySet<string>,
  ): RegisteredProvider {
    const { manifest, provider: constructor } = definition;
    const metadata = getProviderMetadata(constructor);
    if (!metadata) {
      throw new Error(
        `Bundle ${bundleId} exported a Provider without @provider metadata.`,
      );
    }
    if (manifest.apiVersion !== 1 || manifest.schemaVersion !== 1) {
      throw new Error(`Provider ${manifest.id} uses an unsupported manifest or API version.`);
    }
    for (const permission of manifest.permissions) {
      if (!grantedPermissions.has(permission)) {
        throw new Error(
          `Provider ${manifest.id} requires Bundle permission ${permission}.`,
        );
      }
    }
    const contributions = manifest.contributes;
    const unresolvedMetadata = {
      ...metadata,
      ...contributions,
      id: manifest.id,
      title: manifest.name,
      description: manifest.description,
      menu: {
        ...metadata.menu,
        ...contributions.menu,
      },
      pictureInPicture:
        metadata.pictureInPicture || contributions.pictureInPicture
          ? {
              ...metadata.pictureInPicture,
              ...contributions.pictureInPicture,
            }
          : undefined,
      permissions: manifest.permissions,
    };
    const effectiveMetadata = resolveProviderLocaleContributions(
      unresolvedMetadata,
      definition.localization,
      manifest.id,
    );
    const defaultProfile = effectiveMetadata.isolation?.defaultBrowserProfile;
    if (defaultProfile && !localProfileIds.has(defaultProfile)) {
      throw new Error(
        `Provider ${manifest.id} references unknown browser profile ${defaultProfile}.`,
      );
    }
    validateProviderContributions(effectiveMetadata);

    return {
      /** The bundle ID value. */
      bundleId,
      /** The function Object() { [native code] } value. */
      constructor,
      /** The metadata value. */
      metadata: effectiveMetadata,
    };
  }

  /** Creates the plugin registration. */
  private createPluginRegistration(
    bundleId: string,
    definition: PluginDefinition,
    scopedProviderId?: string,
  ): RegisteredRuntimePlugin {
    const { manifest, plugin: constructor } = definition;
    const metadata = getPluginMetadata(constructor);
    if (!metadata) {
      throw new Error(
        `Bundle ${bundleId} exported a Plugin without @plugin metadata.`,
      );
    }
    if (manifest.id !== metadata.id) {
      throw new Error(
        `Plugin manifest id ${manifest.id} does not match @plugin id ${metadata.id}.`,
      );
    }
    if (manifest.apiVersion !== 1 || manifest.schemaVersion !== 1) {
      throw new Error(`Plugin ${manifest.id} uses an unsupported manifest or API version.`);
    }
    if (
      !scopedProviderId &&
      metadata.providerIds?.length &&
      (metadata.providerIds.length !== (manifest.providerIds?.length ?? 0) ||
        metadata.providerIds.some((id) => !manifest.providerIds?.includes(id)))
    ) {
      throw new Error(`Plugin ${manifest.id} manifest scope does not match @plugin metadata.`);
    }
    if (
      scopedProviderId &&
      metadata.providerIds?.length &&
      !metadata.providerIds.includes(scopedProviderId)
    ) {
      throw new Error(
        `Provider-owned Plugin ${metadata.id} excludes its owner ${scopedProviderId}.`,
      );
    }
    const effectiveMetadata = scopedProviderId
      ? metadata
      : { ...metadata, providerIds: manifest.providerIds
      };
    validatePanelContributions(
      effectiveMetadata.panels ?? [],
      `Plugin ${manifest.id}`,
    );
    return {
      /** The bundle ID value. */
      bundleId,
      /** The function Object() { [native code] } value. */
      constructor,
      /** The metadata value. */
      metadata: effectiveMetadata,
      /** The scoped provider ID value. */
      scopedProviderId,
    };
  }

  /** Lists the plugin view panels. */
  private listPluginViewPanels(
    provider: ProviderMetadata,
  ): PluginViewPanelInfo[] {
    const panels: PluginViewPanelInfo[] = [];
    /** Performs the append operation. */
    const append = (
      ownerId: string,
      contributions: readonly PluginViewPanelContribution[],
    ) => {
      for (const contribution of contributions) {
        panels.push({
          id: `${ownerId}:${contribution.id}`,
          title: cloneLocalizedText(contribution.title),
          order: contribution.order ?? 0,
          content: contribution.content.kind === 'internal'
            ? { kind: 'internal', viewId: contribution.content.viewId
            }
            : { kind: 'html', html: contribution.content.html
            },
        });
      }
    };

    append(`provider:${provider.id}`, provider.menu.panels ?? []);
    if (provider.menu.panel && !provider.menu.panels?.length) {
      append(`provider:${provider.id}`, [{
        id: provider.menu.panel,
        title: provider.title,
        content: { kind: 'internal', viewId: provider.menu.panel
        },
      }]);
    }
    for (const plugin of this.runtimePlugins.values()) {
      if (plugin.scopedProviderId && plugin.scopedProviderId !== provider.id) continue;
      if (
        plugin.metadata.providerIds?.length &&
        !plugin.metadata.providerIds.includes(provider.id)
      ) {
        continue;
      }
      append(`plugin:${plugin.metadata.id}`, plugin.metadata.panels ?? []);
    }
    return panels.sort((left, right) =>
      left.order - right.order || left.id.localeCompare(right.id));
  }

  /** Creates the bundle browser profiles. */
  private createBundleBrowserProfiles(
    bundle: BundleDefinition,
  ): BrowserProfileInfo[] {
    const localIds = new Set<string>();
    return (bundle.browserProfiles ?? []).map((profile) => {
      const id = profile.id.trim();
      const name = profile.name.trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) {
        throw new Error(`Bundle ${bundle.id} has invalid browser profile id ${id}.`);
      }
      if (!name || name.length > 80 || localIds.has(id)) {
        throw new Error(`Bundle ${bundle.id} has an invalid or duplicate profile ${id}.`);
      }
      localIds.add(id);
      return {
        id: createPluginBrowserProfileId(bundle.id, id),
        name,
        description: profile.description,
        persistent: profile.persistent !== false,
        source: 'plugin',
        pluginId: bundle.id,
        pluginName: bundle.name ?? bundle.id,
      };
    });
  }

  /** Asserts the bundle ID available. */
  private assertBundleIdAvailable(id: string): void {
    if (!id.trim()) throw new Error('A Bundle must have a non-empty id.');
    if (this.bundles.has(id)) {
      throw new Error(`Bundle ${id} is already registered.`);
    }
  }

  /** Performs the activate plugins operation. */
  private async activatePlugins(
    registration: RegisteredProvider,
    context: SiteContext,
  ): Promise<void> {
    for (const plugin of this.runtimePlugins.values()) {
      if (
        plugin.scopedProviderId &&
        plugin.scopedProviderId !== registration.metadata.id
      ) {
        continue;
      }
      const providerIds = plugin.metadata.providerIds;
      if (providerIds?.length && !providerIds.includes(registration.metadata.id)) {
        continue;
      }
      const instance = new plugin.constructor({
        provider: { ...context, metadata: registration.metadata
        },
      });
      this.currentPlugins.push(instance);
      await instance.activate();
    }
  }

  /** Performs the deactivate current plugins operation. */
  private async deactivateCurrentPlugins(): Promise<void> {
    for (const plugin of this.currentPlugins.splice(0).reverse()) {
      try {
        await plugin.deactivate();
      } catch (error) {
        console.error('Plugin deactivation failed.', error);
      }
    }
  }

  /** Performs the unload current operation. */
  private async unloadCurrent(): Promise<void> {
    await this.deactivateCurrentPlugins();
    this.disposeCurrentPagePolicy();
    await this.currentProvider?.unload();
    await this.activeContext?.externalBrowser.close();
    this.disposeCurrentRuntimeServices();
    this.currentPagePipeline?.dispose();
    this.currentPagePipeline = undefined;
    this.currentProvider = undefined;
    this.currentSiteId = undefined;
    this.currentLocale = undefined;
    this.currentRuntime = undefined;
    this.activeContext = undefined;
  }

  /** Installs the browser identity. */
  private installBrowserIdentity(
    context: SiteContext,
    metadata: ProviderMetadata,
  ): void {
    const identity = metadata.browserIdentity;
    if (!identity) return;
    if (!context.browser) {
      throw new Error(
        `Provider ${metadata.id} browserIdentity requires network-interception.`,
      );
    }
    this.currentRuntimeDisposables.push(context.browser.useIdentity(identity));
  }

  /** Releases the current runtime services. */
  private disposeCurrentRuntimeServices(): void {
    for (const disposable of this.currentRuntimeDisposables.splice(0).reverse()) {
      disposable.dispose();
    }
  }

  /** Installs the page picture in picture policy. */
  private installPagePictureInPicturePolicy(
    context: SiteContext,
    metadata: ProviderMetadata,
  ): () => Promise<void> {
    this.disposeCurrentPagePolicy();
    const contribution = metadata.pictureInPicture;
    if (!shouldSuppressPagePictureInPicture(contribution)) {
      return async () => undefined;
    }

    const page = context.page;
    if (!page) {
      context.logger.warn(
        'The application page pipeline is unavailable for the PiP policy.',
      );
      return async () => undefined;
    }
    const script = createPagePictureInPicturePolicyScript({
      pageRequestPolicy: contribution?.pageRequestPolicy,
      providerSelectors: contribution?.pageControlSelectors,
    });
    this.currentPagePolicyDisposables.push(page.register({
      id: 'kawaikara.core.picture-in-picture-policy',
      source: script,
    }));
    return () => page.refresh('kawaikara.core.picture-in-picture-policy');
  }

  /** Releases the current page policy. */
  private disposeCurrentPagePolicy(): void {
    for (const disposable of this.currentPagePolicyDisposables.splice(0)) {
      disposable.dispose();
    }
  }

  /** Resolves the browser profile. */
  private resolveBrowserProfile(
    registration: RegisteredProvider,
  ): SiteRuntimeProfile {
    const preferences = this.getPreferences();
    const assigned = preferences.siteBrowserProfiles[registration.metadata.id];
    if (assigned === 'isolated') return createIsolatedRuntime(registration.metadata.id);

    const selected = assigned
      ? this.findBrowserProfile(assigned, preferences)
      : undefined;
    if (selected) return createSharedRuntime(registration.metadata.id, selected);

    const defaultProfile = registration.metadata.isolation?.defaultBrowserProfile;
    if (defaultProfile) {
      const profile = this.pluginBrowserProfiles.get(
        createPluginBrowserProfileId(registration.bundleId, defaultProfile),
      );
      if (profile) return createSharedRuntime(registration.metadata.id, profile);
    }
    return createIsolatedRuntime(registration.metadata.id);
  }

  /** Finds the browser profile. */
  private findBrowserProfile(
    id: string,
    preferences: PreferenceState,
  ): BrowserProfileInfo | undefined {
    if (id.startsWith('plugin:')) return this.pluginBrowserProfiles.get(id);
    if (!id.startsWith('user:')) return undefined;
    const userId = id.slice('user:'.length);
    const profile = preferences.browserProfiles.find((item) => item.id === userId);
    return profile
      ? {
          /** The ID value. */
          id,
          /** The name value. */
          name: profile.name,
          /** The persistent value. */
          persistent: profile.persistent,
          /** The source value. */
          source: 'user',
        }
      : undefined;
  }

  /** Whether the active context option is enabled. */
  private activeContext?: SiteContext;

  /** Performs the current provider context operation. */
  private currentProviderContext(): SiteContext {
    if (!this.activeContext) throw new Error('No active site context.');
    return this.activeContext;
  }

  /** Resolves the locales. */
  private resolveLocales(registration: RegisteredProvider): SiteLocaleContext {
    const preferences = this.getPreferences();
    const bundle = this.bundles.get(registration.bundleId)?.definition;
    const appLocale = preferences.appLocale;
    const pluginLocale = resolveGlobalLocale(
      appLocale,
      bundle?.locale?.supportedLocales,
      bundle?.locale?.defaultLocale,
    );
    const siteLocale = resolveGlobalLocale(
      appLocale,
      registration.metadata.locale?.supportedLocales,
      registration.metadata.locale?.defaultLocale,
    );
    return {
      /** The app value. */
      app: appLocale,
      /** The plugin value. */
      plugin: pluginLocale,
      /** The site value. */
      site: siteLocale,
    };
  }
}
