import { DisposableStore } from './Disposable';
import type { ProviderLocaleResource } from './Locale';
import type { SiteContext } from './SiteContext';
import type {
  PluginViewPanelContribution,
  ProviderConstructor,
  ProviderDecoratorMetadata,
  ProviderMetadata,
  SitePermission,
} from './Provider';

/** Defines the shared Kawaikara site API version constant. */
export const KAWAIKARA_SITE_API_VERSION = 1 as const;
/** Defines the shared Kawaikara manifest version constant. */
export const KAWAIKARA_MANIFEST_VERSION = 1 as const;

/** Describes the bundle locale contribution contract. */
export interface BundleLocaleContribution {
  /** The supported locales value. */
  readonly supportedLocales?: readonly string[];
  /** Falls back to the app locale when omitted or set to inherit. */
  readonly defaultLocale?: string;
}

/** A persistent browser profile contributed by one Bundle. */
export interface BundleBrowserProfileContribution {
  /** Profile id scoped to the containing Bundle. */
  readonly id: string;
  /** The name value. */
  readonly name: string;
  /** The description value. */
  readonly description?: string;
  /** Persistent profiles retain login state across app restarts. Defaults to true. */
  readonly persistent?: boolean;
}

/** Defines the bundle release channel type. */
export type BundleReleaseChannel = 'stable' | 'staging' | 'nightly';

/** Values provided to a trusted Bundle update resolver when Update is clicked. */
export interface BundleUpdateContext {
  /** The current version value. */
  readonly currentVersion: string;
  /** The channel value. */
  readonly channel: BundleReleaseChannel;
  /** The platform value. */
  readonly platform: string;
  /** The arch value. */
  readonly arch: string;
}

/** Defines the bundle update resolver type. */
export type BundleUpdateResolver = (
  context: BundleUpdateContext,
) => string | Promise<string>;

/** Update metadata stored in the top-level Bundle manifest. */
export type BundleUpdateManifest =
  | {
      /** The type value. */
      readonly type: 'archive';
      /** Credential-free HTTPS URL returning a ZIP-compatible .kawai archive. */
      readonly url: string;
    }
  | {
      /** The type value. */
      readonly type: 'resolver';
      /** Compiled CommonJS resolver entry relative to the Bundle root. */
      readonly main: string;
    };

/** Validated runtime form of Bundle update metadata. */
export type BundleUpdateDefinition =
  | {
      /** The type value. */
      readonly type: 'archive';
      /** The URL value. */
      readonly url: string;
    }
  | {
      /** The type value. */
      readonly type: 'resolver';
      /** The resolve value. */
      readonly resolve: BundleUpdateResolver;
    };

/** Describes the plugin metadata contract. */
export interface PluginMetadata {
  /** The ID value. */
  readonly id: string;
  /** The name value. */
  readonly name?: string;
  /** The description value. */
  readonly description?: string;
  /** Omit to activate a Bundle-level Plugin for every Provider. */
  readonly providerIds?: readonly string[];
  /** Sandboxed panels added to the selected Provider's shared PluginView area. */
  readonly panels?: readonly PluginViewPanelContribution[];
}

/** Describes the plugin context contract. */
export interface PluginContext {
  /** The provider value. */
  readonly provider: SiteContext & {
    /** The metadata value. */
    readonly metadata: ProviderMetadata;
  };
}

/** Represents the abstract plugin. */
export abstract class AbstractPlugin {
  /** The subscriptions value. */
  protected readonly subscriptions = new DisposableStore();

  /** Creates an instance of AbstractPlugin. */
  constructor(
    /** The context value. */
    protected readonly context: PluginContext,
  ) {}

  /** Performs the activate operation. */
  abstract activate(): Promise<void> | void;

  /** Performs the deactivate operation. */
  async deactivate(): Promise<void> {
    this.subscriptions.dispose();
  }
}

/** Defines the plugin function Object() { [native code] } type. */
export type PluginConstructor = new (context: PluginContext) => AbstractPlugin;

/** Filesystem metadata owned by one Plugin directory. */
export interface PluginManifest {
  /** The schema version value. */
  readonly schemaVersion: typeof KAWAIKARA_MANIFEST_VERSION;
  /** The ID value. */
  readonly id: string;
  /** The name value. */
  readonly name: string;
  /** The version value. */
  readonly version: string;
  /** The API version value. */
  readonly apiVersion: typeof KAWAIKARA_SITE_API_VERSION;
  /** Compiled JavaScript entry relative to the Plugin directory. */
  readonly main: string;
  /** Omit for a Bundle-global Plugin. */
  readonly providerIds?: readonly string[];
}

/** Describes the plugin definition contract. */
export interface PluginDefinition {
  /** The manifest value. */
  readonly manifest: PluginManifest;
  /** The plugin value. */
  readonly plugin: PluginConstructor;
}

/** Filesystem metadata owned by one Provider directory. */
export interface ProviderManifest {
  /** The schema version value. */
  readonly schemaVersion: typeof KAWAIKARA_MANIFEST_VERSION;
  /** The ID value. */
  readonly id: string;
  /** The name value. */
  readonly name: string;
  /** The description value. */
  readonly description?: string;
  /** The version value. */
  readonly version: string;
  /** The API version value. */
  readonly apiVersion: typeof KAWAIKARA_SITE_API_VERSION;
  /** Compiled JavaScript entry relative to the Provider directory. */
  readonly main: string;
  /** Provider capabilities; each entry must also be granted by the Bundle. */
  readonly permissions: readonly SitePermission[];
  /** Static Provider metadata kept out of the executable class. */
  readonly contributes: ProviderManifestContributions;
  /** Plugin directories relative to this Provider directory. */
  readonly plugins?: readonly string[];
}

/** Manifest-owned PiP switch. Site-specific behavior belongs in @provider(). */
export interface ProviderManifestPictureInPictureContribution {
  /** Whether the enabled option is enabled. */
  readonly enabled?: boolean;
}

/** Defines the provider manifest contributions type. */
export type ProviderManifestContributions =
  Partial<
    Omit<
      ProviderMetadata,
      | 'id'
      | 'title'
      | 'description'
      | 'permissions'
      | 'menu'
      | 'shortcut'
      | 'pictureInPicture'
      | 'settings'
    >
  > &
  {
    /** The menu value. */
    readonly menu: NonNullable<ProviderDecoratorMetadata['menu']>;
    /** The shortcut value. */
    readonly shortcut?: ProviderDecoratorMetadata['shortcut'];
    /** Enables the shared PiP action; selectors and policies are code-owned. */
    readonly pictureInPicture?: ProviderManifestPictureInPictureContribution;
  };

/** One Provider directory and the code loaded from its manifest entry. */
export interface ProviderDefinition {
  /** The manifest value. */
  readonly manifest: ProviderManifest;
  /** The provider value. */
  readonly provider: ProviderConstructor;
  /** Validated locale messages loaded from contributes.locale.resource. */
  readonly localization?: ProviderLocaleResource;
  /** Plugins physically owned by this Provider and scoped to it. */
  readonly plugins: readonly PluginDefinition[];
}

/** Filesystem metadata stored at the root of an installable Bundle. */
export interface BundleManifest {
  /** The schema version value. */
  readonly schemaVersion: typeof KAWAIKARA_MANIFEST_VERSION;
  /** The ID value. */
  readonly id: string;
  /** The name value. */
  readonly name: string;
  /** The description value. */
  readonly description?: string;
  /** The version value. */
  readonly version: string;
  /** Preferred top-level update declaration. */
  readonly update?: BundleUpdateManifest;
  /** @deprecated Use update: { type: 'archive', url } instead. */
  readonly updateUrl?: string;
  /** The API version value. */
  readonly apiVersion: typeof KAWAIKARA_SITE_API_VERSION;
  /** The permissions value. */
  readonly permissions?: readonly SitePermission[];
  /** Provider directories relative to the Bundle root. */
  readonly providers: readonly [string, ...string[]];
  /** Bundle-level Plugin directories relative to the Bundle root. */
  readonly plugins?: readonly string[];
  /** The locale value. */
  readonly locale?: BundleLocaleContribution;
  /** The browser profiles value. */
  readonly browserProfiles?: readonly BundleBrowserProfileContribution[];
}

/**
 * The only installable extension unit. A Bundle must contain one or more
 * Providers. Bundle-level Plugins may be global or filtered with providerIds.
 */
export interface BundleDefinition {
  /** The kind value. */
  readonly kind: 'bundle';
  /** The ID value. */
  readonly id: string;
  /** The name value. */
  readonly name?: string;
  /** The description value. */
  readonly description?: string;
  /** The version value. */
  readonly version: string;
  /** The update value. */
  readonly update?: BundleUpdateDefinition;
  /** @deprecated Use update instead. */
  readonly updateUrl?: string;
  /** The API version value. */
  readonly apiVersion: typeof KAWAIKARA_SITE_API_VERSION;
  /** The permissions value. */
  readonly permissions: readonly SitePermission[];
  /** The locale value. */
  readonly locale?: BundleLocaleContribution;
  /** The browser profiles value. */
  readonly browserProfiles?: readonly BundleBrowserProfileContribution[];
  /** The providers value. */
  readonly providers: readonly [ProviderDefinition, ...ProviderDefinition[]];
  /** The plugins value. */
  readonly plugins: readonly PluginDefinition[];
}

/** Performs the define plugin operation. */
export function definePlugin(definition: PluginDefinition): PluginDefinition {
  return Object.freeze({
    ...definition,
    /** The manifest value. */
    manifest: Object.freeze({
      ...definition.manifest,
      /** The provider IDs value. */
      providerIds: Object.freeze([...(definition.manifest.providerIds ?? [])]),
    }),
  });
}

/** Performs the define provider operation. */
export function defineProvider(definition: {
  /** The manifest value. */
  readonly manifest: ProviderManifest;
  /** The provider value. */
  readonly provider: ProviderConstructor;
  /** The localization value. */
  readonly localization?: ProviderLocaleResource;
  /** The plugins value. */
  readonly plugins?: readonly PluginDefinition[];
}
): ProviderDefinition {
  return Object.freeze({
    ...definition,
    /** The manifest value. */
    manifest: Object.freeze({
      ...definition.manifest,
      /** The permissions value. */
      permissions: Object.freeze([...definition.manifest.permissions]),
      /** The contributes value. */
      contributes: Object.freeze({ ...definition.manifest.contributes
      }),
      /** The plugins value. */
      plugins: Object.freeze([...(definition.manifest.plugins ?? [])]),
    }),
    /** The plugins value. */
    plugins: Object.freeze([...(definition.plugins ?? [])]),
    /** The localization value. */
    localization: definition.localization
      ? Object.freeze(Object.fromEntries(
          Object.entries(definition.localization).map(([locale, messages]) => [
            locale,
            Object.freeze({ ...messages
            }),
          ]),
        ))
      : undefined,
  });
}

/** Performs the define bundle operation. */
export function defineBundle(
  definition: Omit<BundleDefinition, 'kind' | 'plugins'> & {
    /** The plugins value. */
    readonly plugins?: readonly PluginDefinition[];
  },
): BundleDefinition {
  if (definition.providers.length === 0) {
    throw new Error('A Bundle must contain at least one Provider.');
  }
  return Object.freeze({
    ...definition,
    /** The kind value. */
    kind: 'bundle' as const,
    /** The update value. */
    update: definition.update
      ? Object.freeze({ ...definition.update
      })
      : undefined,
    /** The permissions value. */
    permissions: Object.freeze([...(definition.permissions ?? [])]),
    /** The browser profiles value. */
    browserProfiles: Object.freeze([...(definition.browserProfiles ?? [])]),
    /** The providers value. */
    providers: Object.freeze([...definition.providers]) as unknown as BundleDefinition['providers'],
    /** The plugins value. */
    plugins: Object.freeze([...(definition.plugins ?? [])]),
  });
}

/** Determines whether the bundle definition condition applies. */
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
