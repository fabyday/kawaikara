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

interface RegisteredProvider {
  readonly bundleId: string;
  readonly constructor: ProviderConstructor;
  readonly metadata: ProviderMetadata;
}

interface RegisteredBundle {
  readonly definition: BundleDefinition;
  readonly browserProfiles: readonly BrowserProfileInfo[];
  readonly providerCount: number;
  readonly pluginCount: number;
}

interface RegisteredRuntimePlugin {
  readonly bundleId: string;
  readonly constructor: PluginConstructor;
  readonly metadata: NonNullable<ReturnType<typeof getPluginMetadata>>;
  readonly scopedProviderId?: string;
}

export interface SiteRuntimeProfile {
  readonly id: string;
  readonly name: string;
  readonly partition: string;
  readonly persistent: boolean;
  readonly siteId: string;
}

export interface BrowserDataTarget {
  readonly id: string;
  readonly name: string;
  readonly partition: string;
}

export interface ResolvedSiteAddress {
  readonly siteId: string;
  readonly url: string;
}

type SiteContextFactory = (
  runtime: SiteRuntimeProfile,
  permissions: ReadonlySet<string>,
) => Promise<SiteContext>;

export class SiteManager {
  private readonly sites = new Map<string, RegisteredProvider>();
  private readonly bundles = new Map<string, RegisteredBundle>();
  private readonly runtimePlugins = new Map<string, RegisteredRuntimePlugin>();
  private currentProvider?: AbstractProvider;
  private readonly currentPlugins: AbstractPlugin[] = [];
  private currentSiteId?: string;
  private currentLocale?: SiteLocaleContext;
  private currentRuntime?: SiteRuntimeProfile;
  private readonly currentPagePolicyDisposables: Disposable[] = [];
  private readonly pluginBrowserProfiles = new Map<string, BrowserProfileInfo>();

  constructor(
    private readonly createContext: SiteContextFactory,
    private readonly getPreferences: () => PreferenceState,
  ) {}

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

  /** Used only to roll back a Bundle that failed during its initial install. */
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
          metadata.pictureInPicture?.enabled !== false,
        isCurrent: metadata.id === this.currentSiteId,
      }))
      .sort(
        (left, right) =>
          left.category.localeCompare(right.category) ||
          left.order - right.order ||
          left.title.localeCompare(right.title),
      );
  }

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
                    ? { ...metadata.shortFormVideo.autoAdvance }
                    : undefined,
                  publisherBan: metadata.shortFormVideo.publisherBan
                    ? { ...metadata.shortFormVideo.publisherBan }
                    : undefined,
                }
              : undefined,
          }))
          .sort((left, right) => left.title.localeCompare(right.title)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  isCurrentSite(id: string): boolean {
    return this.currentSiteId === id;
  }

  async load(id: string): Promise<void> {
    const registration = this.sites.get(id);
    if (!registration) {
      throw new Error(`Unknown site: ${id}`);
    }

    await this.unloadCurrent();

    const locale = this.resolveLocales(registration);
    const runtime = this.resolveBrowserProfile(registration);
    const context = await this.createContext(
      runtime,
      new Set(registration.metadata.permissions ?? []),
    );
    const providerContext: SiteContext = {
      ...context,
      locale,
    };
    this.activeContext = providerContext;
    const provider = new registration.constructor(providerContext);
    this.currentProvider = provider;
    this.currentSiteId = id;
    this.currentLocale = locale;
    this.currentRuntime = runtime;
    const refreshPagePictureInPicturePolicy =
      this.installPagePictureInPicturePolicy(
        providerContext,
        registration.metadata,
      );
    try {
      await provider.onSettingsChanged(this.getProviderSettings(id));
      await this.activatePlugins(registration, providerContext);
      await provider.load();
      await refreshPagePictureInPicturePolicy();
    } catch (error) {
      this.disposeCurrentPagePolicy();
      await this.deactivateCurrentPlugins();
      await provider.unload();
      this.currentProvider = undefined;
      this.currentSiteId = undefined;
      this.currentLocale = undefined;
      this.currentRuntime = undefined;
      this.activeContext = undefined;
      throw error;
    }
  }

  async openUrl(id: string, url: string): Promise<void> {
    await this.load(id);
    try {
      await this.currentProviderContext().viewer.loadURL(url);
    } catch (error) {
      // Streaming SPAs commonly replace the initial navigation. Electron
      // reports that successful hand-off as ERR_ABORTED.
      if (!isNavigationAborted(error)) {
        throw error;
      }
    }
  }

  getCurrentSiteId(): string | undefined {
    return this.currentSiteId;
  }

  getCurrentShortFormVideoContribution():
    | ShortFormVideoContribution
    | undefined {
    const registration = this.currentSiteId
      ? this.sites.get(this.currentSiteId)
      : undefined;
    return registration?.metadata.shortFormVideo;
  }

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

  resolveBrowserProfileDataTarget(profileId: string): BrowserDataTarget | undefined {
    const profile = this.findBrowserProfile(profileId, this.getPreferences());
    if (!profile) return undefined;
    const runtime = createSharedRuntime('', profile);
    return {
      id: profile.id,
      name: profile.name,
      partition: runtime.partition,
    };
  }

  resolveIsolatedSiteDataTarget(siteId: string): BrowserDataTarget | undefined {
    const registration = this.sites.get(siteId);
    if (!registration) return undefined;
    const runtime = this.resolveBrowserProfile(registration);
    if (runtime.id !== `isolated:${siteId}`) return undefined;
    return {
      id: siteId,
      name: registration.metadata.title,
      partition: runtime.partition,
    };
  }

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

  async withPartitionSuspended<T>(
    partition: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const siteId = this.currentRuntime?.partition === partition
      ? this.currentSiteId
      : undefined;
    if (siteId) await this.unloadCurrent();
    try {
      return await operation();
    } finally {
      if (siteId) await this.load(siteId);
    }
  }

  resolveNewWindowPolicy(url: string): NewWindowPolicy {
    return this.currentProvider?.onNewWindow(url) ?? 'deny';
  }

  async handleAction(action: string): Promise<boolean> {
    return (await this.currentProvider?.onAction(action)) ?? false;
  }

  private getProviderSettings(providerId: string): ProviderSettings {
    return { ...(this.getPreferences().providerSettings[providerId] ?? {}) };
  }

  allowNavigation(url: string): boolean {
    return this.currentProvider?.allowNavigation(url) ?? false;
  }

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
      ? { siteId: match.registration.metadata.id, url: target.href }
      : undefined;
  }

  transformRequest(details: SiteRequestDetails): SiteRequestRedirect | undefined {
    return this.currentProvider?.onBeforeRequest(details);
  }

  allowPictureInPicture(url: string): boolean {
    const registration = this.currentSiteId
      ? this.sites.get(this.currentSiteId)
      : undefined;
    if (registration?.metadata.pictureInPicture?.enabled === false) return false;
    return this.currentProvider?.allowPictureInPicture(url) ?? false;
  }

  getPictureInPictureContentOverlaySelectors(): readonly string[] {
    if (!this.currentSiteId) return [];
    return (
      this.sites.get(this.currentSiteId)?.metadata.pictureInPicture
        ?.contentOverlaySelectors ?? []
    );
  }

  transformRequestHeaders(
    details: SiteRequestDetails,
  ): SiteRequestHeaders | undefined {
    const transformed = this.currentProvider?.onBeforeSendHeaders(details);
    const locale = this.currentLocale?.site;
    if (!locale || locale === 'system' || locale === 'inherit') {
      return transformed;
    }

    const headers = { ...(transformed ?? details.requestHeaders) };
    setHeader(headers, 'Accept-Language', createAcceptLanguage(locale));
    return headers;
  }

  has(id: string): boolean {
    return this.sites.has(id);
  }

  async dispose(): Promise<void> {
    await this.unloadCurrent();
  }

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
    const effectiveMetadata: ProviderMetadata = {
      ...metadata,
      ...contributions,
      id: manifest.id,
      title: manifest.name,
      description: manifest.description,
      menu: {
        ...metadata.menu,
        ...contributions.menu,
      },
      permissions: manifest.permissions,
    } as ProviderMetadata;
    const defaultProfile = effectiveMetadata.isolation?.defaultBrowserProfile;
    if (defaultProfile && !localProfileIds.has(defaultProfile)) {
      throw new Error(
        `Provider ${manifest.id} references unknown browser profile ${defaultProfile}.`,
      );
    }
    validateProviderContributions(effectiveMetadata);

    return { bundleId, constructor, metadata: effectiveMetadata };
  }

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
      : { ...metadata, providerIds: manifest.providerIds };
    validatePanelContributions(
      effectiveMetadata.panels ?? [],
      `Plugin ${manifest.id}`,
    );
    return { bundleId, constructor, metadata: effectiveMetadata, scopedProviderId };
  }

  private listPluginViewPanels(
    provider: ProviderMetadata,
  ): PluginViewPanelInfo[] {
    const panels: PluginViewPanelInfo[] = [];
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
            ? { kind: 'internal', viewId: contribution.content.viewId }
            : { kind: 'html', html: contribution.content.html },
        });
      }
    };

    append(`provider:${provider.id}`, provider.menu.panels ?? []);
    if (provider.menu.panel && !provider.menu.panels?.length) {
      append(`provider:${provider.id}`, [{
        id: provider.menu.panel,
        title: provider.title,
        content: { kind: 'internal', viewId: provider.menu.panel },
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

  private assertBundleIdAvailable(id: string): void {
    if (!id.trim()) throw new Error('A Bundle must have a non-empty id.');
    if (this.bundles.has(id)) {
      throw new Error(`Bundle ${id} is already registered.`);
    }
  }

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
        provider: { ...context, metadata: registration.metadata },
      });
      this.currentPlugins.push(instance);
      await instance.activate();
    }
  }

  private async deactivateCurrentPlugins(): Promise<void> {
    for (const plugin of this.currentPlugins.splice(0).reverse()) {
      try {
        await plugin.deactivate();
      } catch (error) {
        console.error('Plugin deactivation failed.', error);
      }
    }
  }

  private async unloadCurrent(): Promise<void> {
    await this.deactivateCurrentPlugins();
    this.disposeCurrentPagePolicy();
    await this.currentProvider?.unload();
    this.currentProvider = undefined;
    this.currentSiteId = undefined;
    this.currentLocale = undefined;
    this.currentRuntime = undefined;
    this.activeContext = undefined;
  }

  private installPagePictureInPicturePolicy(
    context: SiteContext,
    metadata: ProviderMetadata,
  ): () => Promise<void> {
    this.disposeCurrentPagePolicy();
    const contribution = metadata.pictureInPicture;
    if (!shouldSuppressPagePictureInPicture(contribution)) {
      return async () => undefined;
    }

    const script = createPagePictureInPicturePolicyScript({
      pageRequestPolicy: contribution?.pageRequestPolicy,
      providerSelectors: contribution?.pageControlSelectors,
    });
    const refresh = async (): Promise<void> => {
      try {
        await context.viewer.executeJavaScript(script);
      } catch (error) {
        context.logger.debug(
          'The page Picture in Picture controls could not be suppressed.',
          error,
        );
      }
    };
    this.currentPagePolicyDisposables.push(
      context.viewer.onDomReady(refresh),
      context.viewer.onDidFinishLoad(refresh),
    );
    return refresh;
  }

  private disposeCurrentPagePolicy(): void {
    for (const disposable of this.currentPagePolicyDisposables.splice(0)) {
      disposable.dispose();
    }
  }

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
          id,
          name: profile.name,
          persistent: profile.persistent,
          source: 'user',
        }
      : undefined;
  }

  private activeContext?: SiteContext;

  private currentProviderContext(): SiteContext {
    if (!this.activeContext) throw new Error('No active site context.');
    return this.activeContext;
  }

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
    return { app: appLocale, plugin: pluginLocale, site: siteLocale };
  }
}

function resolveGlobalLocale(
  appLocale: string,
  supportedLocales: readonly string[] | undefined,
  defaultLocale: string | undefined,
): string {
  if (appLocale === 'system' || !supportedLocales?.length) {
    return appLocale;
  }

  const exact = supportedLocales.find(
    (locale) => locale.toLowerCase() === appLocale.toLowerCase(),
  );
  if (exact) return exact;

  const language = appLocale.split('-')[0]?.toLowerCase();
  const languageMatch = supportedLocales.find(
    (locale) => locale.split('-')[0]?.toLowerCase() === language,
  );
  if (languageMatch) return languageMatch;

  return defaultLocale && defaultLocale !== 'inherit'
    ? defaultLocale
    : appLocale;
}

const CONTRIBUTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

function validateProviderContributions(metadata: ProviderMetadata): void {
  if (
    !metadata.menu ||
    typeof metadata.menu.category !== 'string' ||
    !metadata.menu.category.trim() ||
    metadata.menu.category.length > 80 ||
    (metadata.menu.order !== undefined && !Number.isFinite(metadata.menu.order)) ||
    (metadata.menu.icon !== undefined &&
      (typeof metadata.menu.icon !== 'string' || metadata.menu.icon.length > 262_144))
  ) {
    throw new Error(`Provider ${metadata.id} has invalid menu metadata.`);
  }
  if (metadata.menu.panels !== undefined && !Array.isArray(metadata.menu.panels)) {
    throw new Error(`Provider ${metadata.id} has invalid PluginView panels.`);
  }
  validatePanelContributions(metadata.menu.panels ?? [], `Provider ${metadata.id}`);
  if (
    metadata.menu.panels?.length &&
    !metadata.permissions?.includes('plugin-view')
  ) {
    throw new Error(`Provider ${metadata.id} must declare plugin-view permission.`);
  }
  if (
    metadata.address &&
    (!Array.isArray(metadata.address.hosts) ||
      metadata.address.hosts.length === 0 ||
      metadata.address.hosts.length > 40 ||
      metadata.address.hosts.some(
        (host) =>
          typeof host !== 'string' ||
          !/^[A-Za-z0-9.-]+$/.test(host) ||
          host.startsWith('.') ||
          host.endsWith('.'),
      ))
  ) {
    throw new Error(`Provider ${metadata.id} has invalid address hosts.`);
  }
  if (
    metadata.shortcut?.defaultKey !== undefined &&
    (typeof metadata.shortcut.defaultKey !== 'string' ||
      metadata.shortcut.defaultKey.length > 100)
  ) {
    throw new Error(`Provider ${metadata.id} has an invalid default shortcut.`);
  }
  if (
    metadata.shortcut?.actions !== undefined &&
    !Array.isArray(metadata.shortcut.actions)
  ) {
    throw new Error(`Provider ${metadata.id} has invalid action shortcuts.`);
  }
  if (
    metadata.locale &&
    ((metadata.locale.supportedLocales !== undefined &&
      (!Array.isArray(metadata.locale.supportedLocales) ||
        metadata.locale.supportedLocales.length > 40 ||
        metadata.locale.supportedLocales.some(
          (locale) => typeof locale !== 'string' || !locale.trim() || locale.length > 40,
        ))) ||
      (metadata.locale.defaultLocale !== undefined &&
        (typeof metadata.locale.defaultLocale !== 'string' ||
          !metadata.locale.defaultLocale.trim() ||
          metadata.locale.defaultLocale.length > 40)))
  ) {
    throw new Error(`Provider ${metadata.id} has invalid locale metadata.`);
  }
  if (
    metadata.isolation &&
    ((metadata.isolation.drm !== undefined &&
      typeof metadata.isolation.drm !== 'boolean') ||
      (metadata.isolation.defaultBrowserProfile !== undefined &&
        (typeof metadata.isolation.defaultBrowserProfile !== 'string' ||
          !metadata.isolation.defaultBrowserProfile.trim())))
  ) {
    throw new Error(`Provider ${metadata.id} has invalid isolation metadata.`);
  }
  const pip = metadata.pictureInPicture;
  if (
    pip &&
    ((pip.enabled !== undefined && typeof pip.enabled !== 'boolean') ||
      (pip.suppressPageControls !== undefined &&
        typeof pip.suppressPageControls !== 'boolean') ||
      (pip.pageRequestPolicy !== undefined &&
        !['block', 'transient', 'allow'].includes(pip.pageRequestPolicy)) ||
      !isOptionalBoundedStringArray(pip.pageControlSelectors, 100, 1_000) ||
      !isOptionalBoundedStringArray(pip.contentOverlaySelectors, 100, 1_000))
  ) {
    throw new Error(`Provider ${metadata.id} has invalid Picture in Picture metadata.`);
  }

  const settingTypes = new Map<string, 'boolean' | 'item-list'>();
  if (
    metadata.settings?.categories !== undefined &&
    !Array.isArray(metadata.settings.categories)
  ) {
    throw new Error(`Provider ${metadata.id} has invalid setting categories.`);
  }
  const categories = metadata.settings?.categories ?? [];
  if (categories.length > 32) {
    throw new Error(`Provider ${metadata.id} declares too many setting categories.`);
  }
  const categoryIds = new Set<string>();
  for (const category of categories) {
    if (
      !category ||
      typeof category !== 'object' ||
      typeof category.id !== 'string' ||
      !Array.isArray(category.settings) ||
      category.settings.length > 64
    ) {
      throw new Error(`Provider ${metadata.id} has an invalid setting category.`);
    }
    requireContributionId(category.id, `${metadata.id} setting category`);
    if (categoryIds.has(category.id)) {
      throw new Error(`Provider ${metadata.id} repeats setting category ${category.id}.`);
    }
    categoryIds.add(category.id);
    validateLocalizedText(category.title, `${metadata.id} setting category title`);
    if (category.description) {
      validateLocalizedText(category.description, `${metadata.id} setting category description`);
    }
    for (const setting of category.settings) {
      if (
        !setting ||
        typeof setting !== 'object' ||
        typeof setting.key !== 'string'
      ) {
        throw new Error(`Provider ${metadata.id} has an invalid setting.`);
      }
      requireContributionId(setting.key, `${metadata.id} setting`);
      if (settingTypes.has(setting.key)) {
        throw new Error(`Provider ${metadata.id} repeats setting key ${setting.key}.`);
      }
      if (setting.type !== 'boolean' && setting.type !== 'item-list') {
        throw new Error(`Provider ${metadata.id} uses an unsupported setting control.`);
      }
      if (setting.type === 'boolean' && typeof setting.defaultValue !== 'boolean') {
        throw new Error(`Provider ${metadata.id} setting ${setting.key} needs a boolean default.`);
      }
      validateLocalizedText(setting.title, `${metadata.id} setting title`);
      if (setting.description) {
        validateLocalizedText(setting.description, `${metadata.id} setting description`);
      }
      if (setting.type === 'item-list' && setting.emptyText) {
        validateLocalizedText(setting.emptyText, `${metadata.id} empty-list text`);
      }
      settingTypes.set(setting.key, setting.type);
    }
  }

  const shortForm = metadata.shortFormVideo;
  if (
    shortForm &&
    ((shortForm.previous !== undefined && typeof shortForm.previous !== 'boolean') ||
      (shortForm.next !== undefined && typeof shortForm.next !== 'boolean') ||
      (shortForm.autoAdvance !== undefined &&
        (!shortForm.autoAdvance ||
          typeof shortForm.autoAdvance !== 'object' ||
          typeof shortForm.autoAdvance.settingKey !== 'string' ||
          typeof shortForm.autoAdvance.defaultValue !== 'boolean')) ||
      (shortForm.publisherBan !== undefined &&
        (!shortForm.publisherBan ||
          typeof shortForm.publisherBan !== 'object' ||
          typeof shortForm.publisherBan.settingKey !== 'string')))
  ) {
    throw new Error(`Provider ${metadata.id} has invalid short-form metadata.`);
  }
  if (shortForm?.autoAdvance) {
    requireSettingType(
      metadata.id,
      shortForm.autoAdvance.settingKey,
      'boolean',
      settingTypes,
    );
  }
  if (shortForm?.publisherBan) {
    requireSettingType(
      metadata.id,
      shortForm.publisherBan.settingKey,
      'item-list',
      settingTypes,
    );
  }

  const localShortcutIds = new Set<string>();
  for (const shortcut of metadata.shortcut?.actions ?? []) {
    if (
      !shortcut ||
      typeof shortcut !== 'object' ||
      typeof shortcut.id !== 'string' ||
      typeof shortcut.defaultKey !== 'string' ||
      typeof shortcut.action !== 'string'
    ) {
      throw new Error(`Provider ${metadata.id} has an invalid action shortcut.`);
    }
    requireContributionId(shortcut.id, `${metadata.id} action shortcut`);
    if (localShortcutIds.has(shortcut.id)) {
      throw new Error(`Provider ${metadata.id} repeats action shortcut ${shortcut.id}.`);
    }
    localShortcutIds.add(shortcut.id);
    validateLocalizedText(shortcut.title, `${metadata.id} action shortcut title`);
    if (shortcut.description) {
      validateLocalizedText(shortcut.description, `${metadata.id} action shortcut description`);
    }
    if (!shortcut.defaultKey.trim() || !shortcut.action.trim()) {
      throw new Error(`Provider ${metadata.id} has an incomplete action shortcut.`);
    }
  }
}

function isOptionalBoundedStringArray(
  value: readonly string[] | undefined,
  maximumItems: number,
  maximumItemLength: number,
): boolean {
  return value === undefined || (
    Array.isArray(value) &&
    value.length <= maximumItems &&
    value.every(
      (item) =>
        typeof item === 'string' &&
        item.length > 0 &&
        item.length <= maximumItemLength,
    )
  );
}

function validatePanelContributions(
  panels: readonly PluginViewPanelContribution[],
  owner: string,
): void {
  if (panels.length > 16) throw new Error(`${owner} declares too many PluginView panels.`);
  const ids = new Set<string>();
  for (const panel of panels) {
    if (
      !panel ||
      typeof panel !== 'object' ||
      typeof panel.id !== 'string' ||
      !panel.content ||
      typeof panel.content !== 'object'
    ) {
      throw new Error(`${owner} has an invalid PluginView panel.`);
    }
    requireContributionId(panel.id, `${owner} PluginView panel`);
    if (ids.has(panel.id)) throw new Error(`${owner} repeats PluginView panel ${panel.id}.`);
    ids.add(panel.id);
    validateLocalizedText(panel.title, `${owner} PluginView panel title`);
    if (
      panel.content.kind === 'internal' &&
      typeof panel.content.viewId === 'string'
    ) {
      requireContributionId(panel.content.viewId, `${owner} internal view`);
    } else if (
      panel.content.kind !== 'html' ||
      typeof panel.content.html !== 'string' ||
      !panel.content.html.trim() ||
      panel.content.html.length > 262_144
    ) {
      throw new Error(`${owner} has an invalid sandboxed PluginView document.`);
    }
  }
}

function requireSettingType(
  providerId: string,
  key: string,
  expected: 'boolean' | 'item-list',
  settingTypes: ReadonlyMap<string, 'boolean' | 'item-list'>,
): void {
  if (settingTypes.get(key) !== expected) {
    throw new Error(
      `Provider ${providerId} short-form capability requires ${expected} setting ${key}.`,
    );
  }
}

function requireContributionId(value: string, label: string): void {
  if (typeof value !== 'string' || !CONTRIBUTION_ID_PATTERN.test(value)) {
    throw new Error(`${label} has invalid id ${value}.`);
  }
}

function validateLocalizedText(value: ProviderLocalizedText, label: string): void {
  if (typeof value === 'string') {
    if (!value.trim() || value.length > 500) throw new Error(`${label} is invalid.`);
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is invalid.`);
  }
  const entries = Object.entries(value);
  if (
    entries.length === 0 ||
    entries.length > 20 ||
    entries.some(([locale, text]) =>
      !locale.trim() ||
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > 500,
    )
  ) {
    throw new Error(`${label} is invalid.`);
  }
}

function cloneLocalizedText(value: ProviderLocalizedText): ProviderLocalizedText {
  return typeof value === 'string' ? value : { ...value };
}

function createAcceptLanguage(locale: string): string {
  const language = locale.split('-')[0];
  return language && language !== locale
    ? `${locale},${language};q=0.9`
    : locale;
}

function setHeader(
  headers: Record<string, string>,
  name: string,
  value: string,
): void {
  const existing = Object.keys(headers).find(
    (header) => header.toLowerCase() === name.toLowerCase(),
  );
  headers[existing ?? name] = value;
}

function isNavigationAborted(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ERR_ABORTED'
  );
}

function normalizeAddressInput(value: string): string {
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `https://${value}`;
}

function createPluginBrowserProfileId(pluginId: string, profileId: string): string {
  return `plugin:${pluginId}:${profileId}`;
}

function createIsolatedRuntime(siteId: string): SiteRuntimeProfile {
  return {
    id: `isolated:${siteId}`,
    name: siteId,
    partition: createPartition(`site.${siteId}`, true),
    persistent: true,
    siteId,
  };
}

function createSharedRuntime(
  siteId: string,
  profile: BrowserProfileInfo,
): SiteRuntimeProfile {
  return {
    id: profile.id,
    name: profile.name,
    partition: createPartition(`profile.${profile.id}`, profile.persistent),
    persistent: profile.persistent,
    siteId,
  };
}

function createPartition(key: string, persistent: boolean): string {
  const safeKey = key.replace(/[^A-Za-z0-9._-]+/g, '_');
  return `${persistent ? 'persist:' : ''}kawaikara.${safeKey}`;
}
