import type {
    PluginRuntimeState,
    PluginViewPanelDescriptor,
    ProviderMetadata,
    ProviderSettings,
    WebExtensionProvider,
} from '@kawaikara/site-api';
import type {
    BundleRuntimeInfo,
    PluginViewPanelInfo,
    SiteMenuItem,
} from '../../../../Common/IPC';
import {
    isPluginEnabled,
    pluginMatchesProvider,
} from '../Plugin/PluginDescriptors';
import {
    cloneLocalizedText,
    createPluginBrowserProfileId,
    type RegisteredBundle,
    type RegisteredProvider,
    type RegisteredRuntimePlugin,
} from './SiteRuntime';

/** Read-only data required to project registry state for application consumers. */
export interface ProviderCatalogContext {
    /** Registered Provider metadata; constructors are never instantiated by catalog readers. */
    readonly providers: readonly RegisteredProvider[];
    /** Registered Plugin scopes and descriptors. */
    readonly plugins: readonly RegisteredRuntimePlugin[];
    /** Persisted settings used to resolve enabled flags. */
    readonly settings: Readonly<Record<string, ProviderSettings>>;
    /** The currently activated Provider, if any. */
    readonly currentSiteId?: string;
    /** Captured runtime states for the current Provider. */
    readonly pluginStates: readonly PluginRuntimeState[];
}

/** Copies localized settings into the renderer-facing settings contract. */
function serializeProviderSettings(
    metadata: ProviderMetadata,
): BundleRuntimeInfo['providers'][number]['settings'] {
    return (metadata.settings?.categories ?? []).map((category) => ({
        id: category.id,
        title: cloneLocalizedText(category.title),
        description: category.description
            ? cloneLocalizedText(category.description)
            : undefined,
        settings: category.settings.map((setting) => {
            const label = {
                key: setting.key,
                title: cloneLocalizedText(setting.title),
                description: setting.description
                    ? cloneLocalizedText(setting.description)
                    : undefined,
            };
            if (setting.type === 'boolean')
                return {
                    ...label,
                    type: setting.type,
                    defaultValue: setting.defaultValue,
                };
            if (setting.type === 'select')
                return {
                    ...setting,
                    ...label,
                    options: setting.options.map((option) => ({
                        value: option.value,
                        label: cloneLocalizedText(option.label),
                    })),
                };
            return {
                ...label,
                type: setting.type,
                emptyText: setting.emptyText
                    ? cloneLocalizedText(setting.emptyText)
                    : undefined,
            };
        }),
    }));
}

/** Resolves the status of attached Plugins without exposing the live Plugin runtime. */
function listProviderPluginStates(
    providerId: string,
    context: ProviderCatalogContext,
): PluginRuntimeState[] {
    return context.plugins
        .filter((plugin) => pluginMatchesProvider(plugin, providerId))
        .map((plugin) => {
            const active =
                context.currentSiteId === providerId
                    ? context.pluginStates.find(
                          (state) => state.id === plugin.metadata.id,
                      )
                    : undefined;
            return (
                active ?? {
                    id: plugin.metadata.id,
                    enabled: isPluginEnabled(
                        plugin.metadata,
                        context.settings[providerId] ?? {},
                    ),
                    state: 'inactive' as const,
                }
            );
        });
}

/** Builds one Provider's settings entry, including its declarative short-form capabilities. */
function serializeBundleProvider(
    metadata: ProviderMetadata,
    context: ProviderCatalogContext,
): BundleRuntimeInfo['providers'][number] {
    return {
        /** Provider identifier. */
        id: metadata.id,
        /** Display title. */
        title: metadata.title,
        /** Optional Provider description. */
        description: metadata.description,
        /** Localized settings copied for the consumer. */
        settings: serializeProviderSettings(metadata),
        /** Attached Plugin states from this catalog snapshot. */
        plugins: listProviderPluginStates(metadata.id, context),
        /** Declared short-form navigation capabilities. */
        shortFormVideo: metadata.shortFormVideo
            ? {
                  /** Whether backward navigation is supported. */
                  previous: metadata.shortFormVideo.previous === true,
                  /** Whether forward navigation is supported. */
                  next: metadata.shortFormVideo.next === true,
                  /** Copied auto-advance policy. */
                  autoAdvance: metadata.shortFormVideo.autoAdvance
                      ? { ...metadata.shortFormVideo.autoAdvance }
                      : undefined,
                  /** Copied publisher filtering policy. */
                  publisherBan: metadata.shortFormVideo.publisherBan
                      ? { ...metadata.shortFormVideo.publisherBan }
                      : undefined,
              }
            : undefined,
    };
}

/**
 * Builds the application-facing Bundle settings catalog from committed registrations.
 *
 * @param bundles - Registered Bundles to enumerate; the iterable is consumed once.
 * @param context - Provider/Plugin definitions, persisted settings and active Plugin states
 * captured for this projection. No live manager is required.
 * @returns Bundles sorted by display name, with Providers sorted by title. Attached
 * Plugins use captured runtime states for the active Provider and declared enablement otherwise.
 * @remarks Does not instantiate Providers, change preferences or write registry state.
 * Localized settings are copied for presentation; some immutable metadata collections
 * remain shared. Treat the entire result as read-only.
 */
export function listBundleRuntimeInfo(
    bundles: Iterable<RegisteredBundle>,
    context: ProviderCatalogContext,
): BundleRuntimeInfo[] {
    return [...bundles]
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
            providers: context.providers
                .filter((provider) => provider.bundleId === definition.id)
                .map(({ metadata }) =>
                    serializeBundleProvider(metadata, context),
                )
                .sort((left, right) => left.title.localeCompare(right.title)),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
}

/** Selects panels using permission, declared scope, enablement and current activation state. */
function listPluginViewPanels(
    provider: ProviderMetadata,
    context: ProviderCatalogContext,
): PluginViewPanelInfo[] {
    const panels: PluginViewPanelInfo[] = [];
    /** Performs the append operation. */
    const append = (
        ownerId: string,
        descriptors: readonly PluginViewPanelDescriptor[],
    ) => {
        for (const descriptor of descriptors) {
            panels.push({
                id: `${ownerId}:${descriptor.id}`,
                title: cloneLocalizedText(descriptor.title),
                order: descriptor.order ?? 0,
                content:
                    descriptor.content.kind === 'internal'
                        ? {
                              kind: 'internal',
                              viewId: descriptor.content.viewId,
                          }
                        : { kind: 'html', html: descriptor.content.html },
            });
        }
    };

    append(`provider:${provider.id}`, provider.menu.panels ?? []);
    if (provider.menu.panel && !provider.menu.panels?.length) {
        append(`provider:${provider.id}`, [
            {
                id: provider.menu.panel,
                title: provider.title,
                content: { kind: 'internal', viewId: provider.menu.panel },
            },
        ]);
    }
    for (const plugin of context.plugins) {
        if (plugin.scopedProviderId && plugin.scopedProviderId !== provider.id)
            continue;
        if (
            plugin.metadata.providerIds?.length &&
            !plugin.metadata.providerIds.includes(provider.id)
        ) {
            continue;
        }
        if (
            !isPluginEnabled(
                plugin.metadata,
                context.settings[provider.id] ?? {},
            )
        )
            continue;
        if (!provider.permissions?.includes('plugin-view')) continue;
        if (
            context.currentSiteId === provider.id &&
            context.pluginStates.find(
                (state) => state.id === plugin.metadata.id,
            )?.state !== 'active'
        )
            continue;
        append(`plugin:${plugin.metadata.id}`, plugin.metadata.panels ?? []);
    }
    return panels.sort(
        (left, right) =>
            left.order - right.order || left.id.localeCompare(right.id),
    );
}

/**
 * Projects registered Providers into menu entries and currently available panels.
 *
 * @param context - One registry/settings/runtime snapshot for all entries in this call.
 * @returns Entries sorted by category, explicit order and title. Plugin panels require
 * matching scope, enablement and plugin-view permission; the active Provider also
 * requires the corresponding Plugin runtime state to be active.
 * @remarks Inactive Providers remain discoverable without being constructed or loaded.
 * The projection does not grant permissions or change Plugin activation.
 */
export function listProviderMenuItems(
    context: ProviderCatalogContext,
): SiteMenuItem[] {
    return [...context.providers]
        .map(({ metadata, bundleId }) => ({
            id: metadata.id,
            bundleId,
            title: metadata.title,
            addressHosts: [...(metadata.address?.hosts ?? [])],
            category: metadata.menu.category,
            icon: metadata.menu.icon,
            panels: listPluginViewPanels(metadata, context),
            order: metadata.menu.order ?? 0,
            defaultShortcut: metadata.shortcut?.defaultKey ?? '',
            actionShortcuts: (metadata.shortcut?.actions ?? []).map(
                (shortcut) => ({
                    id: shortcut.id,
                    title: cloneLocalizedText(shortcut.title),
                    description: shortcut.description
                        ? cloneLocalizedText(shortcut.description)
                        : undefined,
                    defaultKey: shortcut.defaultKey,
                    action: shortcut.action,
                }),
            ),
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
            isCurrent: metadata.id === context.currentSiteId,
        }))
        .sort(
            (left, right) =>
                left.category.localeCompare(right.category) ||
                left.order - right.order ||
                left.title.localeCompare(right.title),
        );
}

/**
 * Publishes static browser descriptors for every registered Provider that declares them.
 *
 * @param providers - Current Provider registrations, including inactive Providers.
 * @returns Browser descriptors sorted by Provider ID, with declared hosts and supported
 * HTTPS/data-image icons. Providers without browser descriptors are omitted.
 * @remarks Does not connect an extension or grant browser permissions. Nested descriptor
 * objects can be shared with registered metadata and must be treated as read-only.
 */
export function listProviderWebExtensions(
    providers: Iterable<RegisteredProvider>,
): WebExtensionProvider[] {
    return [...providers]
        .flatMap(({ metadata }) =>
            metadata.webExtension
                ? [
                      {
                          ...metadata.webExtension,
                          id: metadata.id,
                          title: metadata.title,
                          ...(/^(https:\/\/|data:image\/)/i.test(
                              metadata.menu.icon ?? '',
                          )
                              ? { icon: metadata.menu.icon }
                              : {}),
                          domains: [...(metadata.address?.hosts ?? [])],
                      },
                  ]
                : [],
        )
        .sort((a, b) => a.id.localeCompare(b.id));
}

/** Lists only current manifest-declared app consumers, without activating Providers. */
export function listProviderExternalApps(providers: Iterable<RegisteredProvider>) {
    return [...providers].filter(({ metadata }) => metadata.externalApps?.length).map(({ metadata }) => ({
        /** Stable Provider identity used to scope grants. */
        id: metadata.id,
        /** Localized Provider title for the connection panel. */
        name: metadata.title,
        /** External app identities explicitly declared by this Provider. */
        appIds: [...metadata.externalApps!],
    }));
}
