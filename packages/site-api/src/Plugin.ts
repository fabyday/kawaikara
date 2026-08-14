import type { SiteDescriptorConstructor } from './SiteDescriptor';

export const KAWAIKARA_SITE_API_VERSION = 1 as const;

export interface PluginLocaleContribution {
  readonly supportedLocales?: readonly string[];
  /** Falls back to the app locale when omitted or set to inherit. */
  readonly defaultLocale?: string;
}

/**
 * A persistent browser profile contributed by a plugin. Sites assigned to the
 * same profile share an Electron Session, while keeping separate WebContents.
 */
export interface PluginBrowserProfileContribution {
  /** Profile id scoped to the containing plugin. */
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** Persistent profiles retain login state across app restarts. Defaults to true. */
  readonly persistent?: boolean;
}

export interface SitePluginDefinition {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly version: string;
  readonly apiVersion: typeof KAWAIKARA_SITE_API_VERSION;
  readonly locale?: PluginLocaleContribution;
  readonly browserProfiles?: readonly PluginBrowserProfileContribution[];
  readonly sites: readonly SiteDescriptorConstructor[];
}

export function definePlugin(
  definition: SitePluginDefinition,
): SitePluginDefinition {
  return Object.freeze({
    ...definition,
    browserProfiles: Object.freeze([...(definition.browserProfiles ?? [])]),
    sites: Object.freeze([...definition.sites]),
  });
}
