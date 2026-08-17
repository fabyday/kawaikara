import {
  getSiteMetadata,
  type NewWindowPolicy,
  type AbstractSiteDescriptor,
  type SiteContext,
  type SiteDescriptorConstructor,
  type SiteLocaleContext,
  type SiteMetadata,
  type SitePluginDefinition,
  type SiteRequestDetails,
  type SiteRequestHeaders,
  type SiteRequestRedirect,
} from '@kawaikara/site-api';
import type {
  BrowserProfileInfo,
  PluginInfo,
  PreferenceState,
  SiteMenuItem,
} from '../../Common/IPC';

interface RegisteredSite {
  readonly pluginId: string;
  readonly constructor: SiteDescriptorConstructor;
  readonly metadata: SiteMetadata;
}

interface RegisteredPlugin {
  readonly definition: SitePluginDefinition;
  readonly browserProfiles: readonly BrowserProfileInfo[];
  readonly siteCount: number;
}

export interface SiteRuntimeProfile {
  readonly id: string;
  readonly name: string;
  readonly partition: string;
  readonly persistent: boolean;
  readonly siteId: string;
}

export interface ResolvedSiteAddress {
  readonly siteId: string;
  readonly url: string;
}

type SiteContextFactory = (
  runtime: SiteRuntimeProfile,
) => Promise<SiteContext>;

export class SiteManager {
  private readonly sites = new Map<string, RegisteredSite>();
  private readonly plugins = new Map<string, RegisteredPlugin>();
  private currentDescriptor?: AbstractSiteDescriptor;
  private currentSiteId?: string;
  private currentLocale?: SiteLocaleContext;
  private currentRuntime?: SiteRuntimeProfile;
  private readonly pluginBrowserProfiles = new Map<string, BrowserProfileInfo>();

  constructor(
    private readonly createContext: SiteContextFactory,
    private readonly getPreferences: () => PreferenceState,
  ) {}

  registerPlugin(plugin: SitePluginDefinition): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already registered.`);
    }
    const browserProfiles = this.createPluginBrowserProfiles(plugin);
    const localProfileIds = new Set(
      (plugin.browserProfiles ?? []).map((profile) => profile.id),
    );
    const staged = plugin.sites.map((constructor) =>
      this.createRegistration(plugin.id, constructor, localProfileIds),
    );

    const stagedIds = new Set<string>();
    for (const registration of staged) {
      const id = registration.metadata.id;
      if (this.sites.has(id) || stagedIds.has(id)) {
        throw new Error(`Site id ${id} is already registered.`);
      }
      stagedIds.add(id);
    }

    for (const registration of staged) {
      this.sites.set(registration.metadata.id, registration);
    }
    for (const profile of browserProfiles) {
      if (this.pluginBrowserProfiles.has(profile.id)) {
        throw new Error(`Browser profile ${profile.id} is already registered.`);
      }
      this.pluginBrowserProfiles.set(profile.id, profile);
    }
    this.plugins.set(plugin.id, {
      browserProfiles,
      definition: plugin,
      siteCount: staged.length,
    });
  }

  listMenuItems(): SiteMenuItem[] {
    return [...this.sites.values()]
      .map(({ metadata, pluginId }) => ({
        id: metadata.id,
        pluginId,
        title: metadata.title,
        category: metadata.menu.category,
        icon: metadata.menu.icon,
        panelId: metadata.menu.panel,
        order: metadata.menu.order ?? 0,
        defaultShortcut: metadata.shortcut?.defaultKey ?? '',
        supportedLocales: metadata.locale?.supportedLocales ?? [],
        defaultLocale: metadata.locale?.defaultLocale ?? 'inherit',
        defaultBrowserProfileId: metadata.isolation?.defaultBrowserProfile
          ? createPluginBrowserProfileId(
              pluginId,
              metadata.isolation.defaultBrowserProfile,
            )
          : undefined,
        drm: metadata.isolation?.drm === true,
        isCurrent: metadata.id === this.currentSiteId,
      }))
      .sort(
        (left, right) =>
          left.category.localeCompare(right.category) ||
          left.order - right.order ||
          left.title.localeCompare(right.title),
      );
  }

  listPlugins(): PluginInfo[] {
    return [...this.plugins.values()]
      .map(({ browserProfiles, definition, siteCount }) => ({
        id: definition.id,
        name: definition.name ?? definition.id,
        description: definition.description,
        version: definition.version,
        siteCount,
        supportedLocales: definition.locale?.supportedLocales ?? [],
        defaultLocale: definition.locale?.defaultLocale ?? 'inherit',
        browserProfiles,
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

    if (this.currentDescriptor) {
      await this.currentDescriptor.unload();
      this.currentDescriptor = undefined;
      this.currentSiteId = undefined;
      this.currentLocale = undefined;
      this.currentRuntime = undefined;
      this.activeContext = undefined;
    }

    const locale = this.resolveLocales(registration);
    const runtime = this.resolveBrowserProfile(registration);
    const context = await this.createContext(runtime);
    this.activeContext = context;
    const descriptor = new registration.constructor({
      ...context,
      locale,
    });
    this.currentDescriptor = descriptor;
    this.currentSiteId = id;
    this.currentLocale = locale;
    this.currentRuntime = runtime;
    try {
      await descriptor.load();
    } catch (error) {
      await descriptor.unload();
      this.currentDescriptor = undefined;
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
      await this.currentDescriptorContext().viewer.loadURL(url);
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

  resolveNewWindowPolicy(url: string): NewWindowPolicy {
    return this.currentDescriptor?.onNewWindow(url) ?? 'deny';
  }

  async handleAction(action: string): Promise<boolean> {
    return (await this.currentDescriptor?.onAction(action)) ?? false;
  }

  allowNavigation(url: string): boolean {
    return this.currentDescriptor?.allowNavigation(url) ?? false;
  }

  resolveAddress(value: string): ResolvedSiteAddress | undefined {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 16_384) return undefined;

    let target: URL;
    try {
      const parsed = new URL(trimmed);
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
        target = new URL(nested);
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
    return this.currentDescriptor?.onBeforeRequest(details);
  }

  allowPictureInPicture(url: string): boolean {
    return this.currentDescriptor?.allowPictureInPicture(url) ?? false;
  }

  transformRequestHeaders(
    details: SiteRequestDetails,
  ): SiteRequestHeaders | undefined {
    const transformed = this.currentDescriptor?.onBeforeSendHeaders(details);
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
    await this.currentDescriptor?.unload();
    this.currentDescriptor = undefined;
    this.currentSiteId = undefined;
    this.currentLocale = undefined;
    this.currentRuntime = undefined;
    this.activeContext = undefined;
  }

  private createRegistration(
    pluginId: string,
    constructor: SiteDescriptorConstructor,
    localProfileIds: ReadonlySet<string>,
  ): RegisteredSite {
    const metadata = getSiteMetadata(constructor);
    if (!metadata) {
      throw new Error(
        `Plugin ${pluginId} exported a site without @site metadata.`,
      );
    }
    const defaultProfile = metadata.isolation?.defaultBrowserProfile;
    if (defaultProfile && !localProfileIds.has(defaultProfile)) {
      throw new Error(
        `Site ${metadata.id} references unknown browser profile ${defaultProfile}.`,
      );
    }

    return { pluginId, constructor, metadata };
  }

  private createPluginBrowserProfiles(
    plugin: SitePluginDefinition,
  ): BrowserProfileInfo[] {
    const localIds = new Set<string>();
    return (plugin.browserProfiles ?? []).map((profile) => {
      const id = profile.id.trim();
      const name = profile.name.trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) {
        throw new Error(`Plugin ${plugin.id} has invalid browser profile id ${id}.`);
      }
      if (!name || name.length > 80 || localIds.has(id)) {
        throw new Error(`Plugin ${plugin.id} has an invalid or duplicate profile ${id}.`);
      }
      localIds.add(id);
      return {
        id: createPluginBrowserProfileId(plugin.id, id),
        name,
        description: profile.description,
        persistent: profile.persistent !== false,
        source: 'plugin',
        pluginId: plugin.id,
        pluginName: plugin.name ?? plugin.id,
      };
    });
  }

  private resolveBrowserProfile(
    registration: RegisteredSite,
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
        createPluginBrowserProfileId(registration.pluginId, defaultProfile),
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

  private currentDescriptorContext(): SiteContext {
    if (!this.activeContext) throw new Error('No active site context.');
    return this.activeContext;
  }

  private resolveLocales(registration: RegisteredSite): SiteLocaleContext {
    const preferences = this.getPreferences();
    const plugin = this.plugins.get(registration.pluginId)?.definition;
    const appLocale = preferences.appLocale;
    const pluginLocale = resolveGlobalLocale(
      appLocale,
      plugin?.locale?.supportedLocales,
      plugin?.locale?.defaultLocale,
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
