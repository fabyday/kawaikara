import { DisposableStore } from './Disposable';
import type { SiteContext } from './SiteContext';
import type {
  ProviderConstructor,
  ProviderMetadata,
  SitePermission,
} from './Provider';

export const KAWAIKARA_SITE_API_VERSION = 1 as const;
export const KAWAIKARA_MANIFEST_VERSION = 1 as const;

export interface BundleLocaleContribution {
  readonly supportedLocales?: readonly string[];
  /** Falls back to the app locale when omitted or set to inherit. */
  readonly defaultLocale?: string;
}

/** A persistent browser profile contributed by one Bundle. */
export interface BundleBrowserProfileContribution {
  /** Profile id scoped to the containing Bundle. */
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** Persistent profiles retain login state across app restarts. Defaults to true. */
  readonly persistent?: boolean;
}

export interface PluginMetadata {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  /** Omit to activate a Bundle-level Plugin for every Provider. */
  readonly providerIds?: readonly string[];
}

export interface PluginContext {
  readonly provider: SiteContext & {
    readonly metadata: ProviderMetadata;
  };
}

export abstract class AbstractPlugin {
  protected readonly subscriptions = new DisposableStore();

  constructor(protected readonly context: PluginContext) {}

  abstract activate(): Promise<void> | void;

  async deactivate(): Promise<void> {
    this.subscriptions.dispose();
  }
}

export type PluginConstructor = new (context: PluginContext) => AbstractPlugin;

/** Filesystem metadata owned by one Plugin directory. */
export interface PluginManifest {
  readonly schemaVersion: typeof KAWAIKARA_MANIFEST_VERSION;
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly apiVersion: typeof KAWAIKARA_SITE_API_VERSION;
  /** Compiled JavaScript entry relative to the Plugin directory. */
  readonly main: string;
  /** Omit for a Bundle-global Plugin. */
  readonly providerIds?: readonly string[];
}

export interface PluginDefinition {
  readonly manifest: PluginManifest;
  readonly plugin: PluginConstructor;
}

/** Filesystem metadata owned by one Provider directory. */
export interface ProviderManifest {
  readonly schemaVersion: typeof KAWAIKARA_MANIFEST_VERSION;
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  readonly apiVersion: typeof KAWAIKARA_SITE_API_VERSION;
  /** Compiled JavaScript entry relative to the Provider directory. */
  readonly main: string;
  /** @deprecated Put the install consent boundary in BundleManifest.permissions. */
  readonly permissions?: readonly SitePermission[];
  /** Plugin directories relative to this Provider directory. */
  readonly plugins?: readonly string[];
}

/** One Provider directory and the code loaded from its manifest entry. */
export interface ProviderDefinition {
  readonly manifest: ProviderManifest;
  readonly provider: ProviderConstructor;
  /** Plugins physically owned by this Provider and scoped to it. */
  readonly plugins: readonly PluginDefinition[];
}

/** Filesystem metadata stored at the root of an installable Bundle. */
export interface BundleManifest {
  readonly schemaVersion: typeof KAWAIKARA_MANIFEST_VERSION;
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  readonly apiVersion: typeof KAWAIKARA_SITE_API_VERSION;
  readonly permissions?: readonly SitePermission[];
  /** Provider directories relative to the Bundle root. */
  readonly providers: readonly [string, ...string[]];
  /** Bundle-level Plugin directories relative to the Bundle root. */
  readonly plugins?: readonly string[];
  readonly locale?: BundleLocaleContribution;
  readonly browserProfiles?: readonly BundleBrowserProfileContribution[];
}

/**
 * The only installable extension unit. A Bundle must contain one or more
 * Providers. Bundle-level Plugins may be global or filtered with providerIds.
 */
export interface BundleDefinition {
  readonly kind: 'bundle';
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly version: string;
  readonly apiVersion: typeof KAWAIKARA_SITE_API_VERSION;
  readonly permissions: readonly SitePermission[];
  readonly locale?: BundleLocaleContribution;
  readonly browserProfiles?: readonly BundleBrowserProfileContribution[];
  readonly providers: readonly [ProviderDefinition, ...ProviderDefinition[]];
  readonly plugins: readonly PluginDefinition[];
}

export function definePlugin(definition: PluginDefinition): PluginDefinition {
  return Object.freeze({
    ...definition,
    manifest: Object.freeze({
      ...definition.manifest,
      providerIds: Object.freeze([...(definition.manifest.providerIds ?? [])]),
    }),
  });
}

export function defineProvider(definition: {
  readonly manifest: ProviderManifest;
  readonly provider: ProviderConstructor;
  readonly plugins?: readonly PluginDefinition[];
}): ProviderDefinition {
  return Object.freeze({
    ...definition,
    manifest: Object.freeze({
      ...definition.manifest,
      permissions: Object.freeze([...(definition.manifest.permissions ?? [])]),
      plugins: Object.freeze([...(definition.manifest.plugins ?? [])]),
    }),
    plugins: Object.freeze([...(definition.plugins ?? [])]),
  });
}

export function defineBundle(
  definition: Omit<BundleDefinition, 'kind' | 'plugins'> & {
    readonly plugins?: readonly PluginDefinition[];
  },
): BundleDefinition {
  if (definition.providers.length === 0) {
    throw new Error('A Bundle must contain at least one Provider.');
  }
  return Object.freeze({
    ...definition,
    kind: 'bundle' as const,
    permissions: Object.freeze([...(definition.permissions ?? [])]),
    browserProfiles: Object.freeze([...(definition.browserProfiles ?? [])]),
    providers: Object.freeze([...definition.providers]) as unknown as BundleDefinition['providers'],
    plugins: Object.freeze([...(definition.plugins ?? [])]),
  });
}

export function isBundleDefinition(value: unknown): value is BundleDefinition {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BundleDefinition>;
  return (
    candidate.kind === 'bundle' &&
    Array.isArray(candidate.providers) &&
    candidate.providers.length > 0 &&
    Array.isArray(candidate.plugins)
  );
}
