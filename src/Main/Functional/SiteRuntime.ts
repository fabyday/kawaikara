import {
  getPluginMetadata,
  type BundleDefinition,
  type PluginConstructor,
  type PluginViewPanelContribution,
  type ProviderConstructor,
  type ProviderLocalizedText,
  type ProviderMetadata,
  type SiteContext,
} from '@kawaikara/site-api';
import type { BrowserProfileInfo } from '../../Common/IPC';

/** Describes the registered provider contract. */
export interface RegisteredProvider {
  /** The bundle ID value. */
  readonly bundleId: string;
  /** The function Object() { [native code] } value. */
  readonly constructor: ProviderConstructor;
  /** The metadata value. */
  readonly metadata: ProviderMetadata;
}

/** Describes the registered bundle contract. */
export interface RegisteredBundle {
  /** The definition value. */
  readonly definition: BundleDefinition;
  /** The browser profiles value. */
  readonly browserProfiles: readonly BrowserProfileInfo[];
  /** The provider count value. */
  readonly providerCount: number;
  /** The plugin count value. */
  readonly pluginCount: number;
}

/** Describes the registered runtime plugin contract. */
export interface RegisteredRuntimePlugin {
  /** The bundle ID value. */
  readonly bundleId: string;
  /** The function Object() { [native code] } value. */
  readonly constructor: PluginConstructor;
  /** The metadata value. */
  readonly metadata: NonNullable<ReturnType<typeof getPluginMetadata>>;
  /** The scoped provider ID value. */
  readonly scopedProviderId?: string;
}

/** Describes the site runtime profile contract. */
export interface SiteRuntimeProfile {
  /** The ID value. */
  readonly id: string;
  /** The name value. */
  readonly name: string;
  /** The partition value. */
  readonly partition: string;
  /** Whether the persistent option is enabled. */
  readonly persistent: boolean;
  /** The site ID value. */
  readonly siteId: string;
}

/** Describes the browser data target contract. */
export interface BrowserDataTarget {
  /** The ID value. */
  readonly id: string;
  /** The name value. */
  readonly name: string;
  /** The partition value. */
  readonly partition: string;
}

/** Describes the resolved site address contract. */
export interface ResolvedSiteAddress {
  /** The site ID value. */
  readonly siteId: string;
  /** The URL value. */
  readonly url: string;
}

/** Defines the site context factory type. */
export type SiteContextFactory = (
  runtime: SiteRuntimeProfile,
  permissions: ReadonlySet<string>,
) => Promise<SiteContext>;

/** Defines the shared contribution ID pattern constant. */
const CONTRIBUTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

/** Validates the provider contributions. */
export function validateProviderContributions(metadata: ProviderMetadata): void {
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
  const identity = metadata.browserIdentity;
  if (
    identity &&
    ((typeof identity.userAgent !== 'string' ||
      !identity.userAgent.trim() || identity.userAgent.length > 1_000) ||
      (identity.clientHints !== undefined &&
        (typeof identity.clientHints !== 'string' ||
          !identity.clientHints.trim() || identity.clientHints.length > 1_000)) ||
      !isOptionalBoundedStringArray(identity.requestHosts, 100, 253))
  ) {
    throw new Error(`Provider ${metadata.id} has invalid browser identity metadata.`);
  }
  if (identity && !metadata.permissions?.includes('network-interception')) {
    throw new Error(
      `Provider ${metadata.id} browserIdentity requires network-interception.`,
    );
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

/** Determines whether the optional bounded string array condition applies. */
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

/** Validates the panel contributions. */
export function validatePanelContributions(
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

/** Performs the require setting type operation. */
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

/** Performs the require contribution ID operation. */
function requireContributionId(value: string, label: string): void {
  if (typeof value !== 'string' || !CONTRIBUTION_ID_PATTERN.test(value)) {
    throw new Error(`${label} has invalid id ${value}.`);
  }
}

/** Validates the localized text. */
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

/** Performs the clone localized text operation. */
export function cloneLocalizedText(value: ProviderLocalizedText): ProviderLocalizedText {
  return typeof value === 'string' ? value : { ...value
  };
}

/** Creates the accept language. */
export function createAcceptLanguage(locale: string): string {
  const language = locale.split('-')[0];
  return language && language !== locale
    ? `${locale},${language};q=0.9`
    : locale;
}

/** Sets the header. */
export function setHeader(
  headers: Record<string, string>,
  name: string,
  value: string,
): void {
  const existing = Object.keys(headers).find(
    (header) => header.toLowerCase() === name.toLowerCase(),
  );
  headers[existing ?? name] = value;
}

/** Determines whether the navigation aborted condition applies. */
export function isNavigationAborted(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown
    }).code === 'ERR_ABORTED'
  );
}

/** Normalizes the address input. */
export function normalizeAddressInput(value: string): string {
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `https://${value}`;
}

/** Creates the plugin browser profile ID. */
export function createPluginBrowserProfileId(pluginId: string, profileId: string): string {
  return `plugin:${pluginId}:${profileId}`;
}

/** Creates the isolated runtime. */
export function createIsolatedRuntime(siteId: string): SiteRuntimeProfile {
  return {
    /** The ID value. */
    id: `isolated:${siteId}`,
    /** The name value. */
    name: siteId,
    /** The partition value. */
    partition: createPartition(`site.${siteId}`, true),
    /** The persistent value. */
    persistent: true,
    /** The site ID value. */
    siteId,
  };
}

/** Creates the shared runtime. */
export function createSharedRuntime(
  siteId: string,
  profile: BrowserProfileInfo,
): SiteRuntimeProfile {
  return {
    /** The ID value. */
    id: profile.id,
    /** The name value. */
    name: profile.name,
    /** The partition value. */
    partition: createPartition(`profile.${profile.id}`, profile.persistent),
    /** The persistent value. */
    persistent: profile.persistent,
    /** The site ID value. */
    siteId,
  };
}

/** Creates the partition. */
function createPartition(key: string, persistent: boolean): string {
  const safeKey = key.replace(/[^A-Za-z0-9._-]+/g, '_');
  return `${persistent ? 'persist:' : ''}kawaikara.${safeKey}`;
}
