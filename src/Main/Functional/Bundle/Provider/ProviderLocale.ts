import type {
    BundleDefinition,
    ProviderDecoratorMetadata,
    ProviderLocaleResource,
    ProviderLocalizedText,
    ProviderMetadata,
    SiteLocaleContext,
    WebExtensionDescriptor,
    WebExtensionLabel,
} from '@kawaikara/site-api';

/** Defines the unresolved provider metadata type. */
type UnresolvedProviderMetadata = Omit<
    ProviderMetadata,
    'menu' | 'shortcut' | 'settings'
> &
    Required<Pick<ProviderDecoratorMetadata, 'menu'>> &
    Pick<ProviderDecoratorMetadata, 'shortcut' | 'settings'>;

/**
 * Chooses an effective language from an application's locale and a declaration.
 *
 * @param appLocale - Application locale or the system sentinel.
 * @param supportedLocales - Declared locales; absent/empty lists inherit the app locale.
 * @param defaultLocale - Fallback when no exact or language-prefix match exists; inherit
 * or an absent value falls back to the app locale.
 * @returns The declared exact match, language-prefix match or fallback locale.
 * @remarks Matching is case-insensitive. The system sentinel passes through unchanged;
 * this function does not query the operating system.
 */
export function resolveGlobalLocale(
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

/**
 * Resolves Provider UI text from explicit declarations and Locale resource keys.
 *
 * @param metadata - Merged decorator/manifest metadata before locale references are resolved.
 * @param localization - Loaded Provider locale resources; may be absent when labels are explicit.
 * @param providerId - Stable Provider identifier used in validation diagnostics.
 * @returns Effective Provider metadata with menu, shortcut, settings and browser labels resolved.
 * @throws When required text or a required locale reference cannot be resolved.
 * @remarks Explicit localized text remains supported for third-party Providers. This
 * function reads the supplied resource object only; loading Locale files belongs to the loader.
 */
export function resolveProviderLocaleDescriptors(
    metadata: UnresolvedProviderMetadata,
    localization: ProviderLocaleResource | undefined,
    providerId: string,
): ProviderMetadata {
    /** Performs the required text operation. */
    const requiredText = (
        explicit: ProviderLocalizedText | undefined,
        key: string,
    ): ProviderLocalizedText => {
        const inferred =
            explicit !== undefined
                ? explicit
                : readProviderLocaleText(localization, key);
        if (inferred === undefined) {
            throw new Error(
                `Provider ${providerId} must declare a title or locale message ${key}.`,
            );
        }
        return inferred;
    };
    /** Performs the optional text operation. */
    const optionalText = (
        explicit: ProviderLocalizedText | undefined,
        key: string,
    ): ProviderLocalizedText | undefined =>
        explicit !== undefined
            ? explicit
            : readProviderLocaleText(localization, key);

    return {
        ...metadata,
        /** Browser labels are resolved before catalog validation and publication. */
        webExtension: metadata.webExtension
            ? resolveWebExtensionLocale(
                  metadata.webExtension,
                  localization,
                  providerId,
              )
            : undefined,
        /** The menu value. */
        menu: {
            ...metadata.menu,
            /** The panels value. */
            panels: metadata.menu.panels?.map((panel) => ({
                ...panel,
                title: requiredText(
                    panel.title,
                    `menu.panel.${panel.id}.title`,
                ),
            })),
        },
        /** The shortcut value. */
        shortcut: metadata.shortcut
            ? {
                  ...metadata.shortcut,
                  /** The actions value. */
                  actions: metadata.shortcut.actions?.map((action) => ({
                      ...action,
                      title: requiredText(
                          action.title,
                          `shortcut.${action.id}.title`,
                      ),
                      description: optionalText(
                          action.description,
                          `shortcut.${action.id}.description`,
                      ),
                  })),
              }
            : undefined,
        /** The settings value. */
        settings: metadata.settings
            ? {
                  /** The categories value. */
                  categories: metadata.settings.categories.map((category) => ({
                      ...category,
                      title: requiredText(
                          category.title,
                          `settings.${category.id}.title`,
                      ),
                      description: optionalText(
                          category.description,
                          `settings.${category.id}.description`,
                      ),
                      settings: category.settings.map((setting) => ({
                          ...setting,
                          title: requiredText(
                              setting.title,
                              `settings.${setting.key}.title`,
                          ),
                          description: optionalText(
                              setting.description,
                              `settings.${setting.key}.description`,
                          ),
                          ...(setting.type === 'item-list'
                              ? {
                                    emptyText: optionalText(
                                        setting.emptyText,
                                        `settings.${setting.key}.emptyText`,
                                    ),
                                }
                              : {}),
                      })),
                  })),
              }
            : undefined,
    } as ProviderMetadata;
}

/** Reads the provider locale text. */
function readProviderLocaleText(
    localization: ProviderLocaleResource | undefined,
    key: string,
): ProviderLocalizedText | undefined {
    if (!localization) return undefined;
    const localized = Object.fromEntries(
        Object.entries(localization).flatMap(([locale, messages]) => {
            const value = messages[key];
            return typeof value === 'string' && value.trim()
                ? [[locale, value] as const]
                : [];
        }),
    );
    return Object.keys(localized).length > 0
        ? Object.freeze(localized)
        : undefined;
}

/** Resolves manifest locale references while preserving optional inline label overrides. */
function resolveWebExtensionLocale(
    descriptor: WebExtensionDescriptor,
    localization: ProviderLocaleResource | undefined,
    providerId: string,
): WebExtensionDescriptor {
    /** Resolves one label without mutating the manifest or its locale resource. */
    const resolveLabel = <T extends WebExtensionLabel>(item: T): T => {
        const match = /^%([^%]+)%$/.exec(item.title);
        if (!match) return item;
        const text = readProviderLocaleText(localization, match[1]);
        if (!text || typeof text === 'string') {
            throw new Error(
                `Provider ${providerId} is missing locale message ${match[1]}.`,
            );
        }
        const entries = Object.entries(text);
        const fallback =
            entries.find(([locale]) => locale.toLowerCase() === 'en-us') ??
            entries.find(
                ([locale]) => locale.toLowerCase().split('-')[0] === 'en',
            ) ??
            entries[0];
        return {
            ...item,
            /** Plain text replaces the manifest reference in the browser catalog. */
            title: fallback[1],
            /** Locale files supply defaults; explicit inline labels remain supported. */
            translations: { ...text, ...item.translations },
        };
    };
    return {
        ...descriptor,
        /** Localized action summaries for permission and feature lists. */
        actionDefinitions: Object.fromEntries(
            Object.entries(descriptor.actionDefinitions).map(([id, action]) => [
                id,
                resolveLabel(action),
            ]),
        ),
        /** Localized Provider browser settings. */
        settings: descriptor.settings?.map(resolveLabel),
        /** Localized native browser context menus. */
        contextMenus: descriptor.contextMenus?.map(resolveLabel),
        /** Localized page controls interpreted by the adapter. */
        domActions: descriptor.domActions?.map((menu) => ({
            ...menu,
            /** Each DOM entry keeps its own stable locale reference. */
            items: menu.items.map(resolveLabel),
        })),
    };
}

/**
 * Resolves application, Bundle and Provider language choices for an activation.
 *
 * @param appLocale - Current application locale or system sentinel.
 * @param provider - Effective Provider metadata containing its locale declaration.
 * @param bundle - Owning Bundle definition; omit to inherit the application locale at Bundle scope.
 * @returns The locale context passed to the Provider and its Plugins.
 * @remarks Resolves declarations only and does not read or persist preferences.
 */
export function resolveProviderLocales(
    appLocale: string,
    provider: ProviderMetadata,
    bundle?: BundleDefinition,
): SiteLocaleContext {
    return {
        /** Current application language. */
        app: appLocale,
        /** Bundle-level fallback choice. */
        plugin: resolveGlobalLocale(
            appLocale,
            bundle?.locale?.supportedLocales,
            bundle?.locale?.defaultLocale,
        ),
        /** Provider-level fallback choice. */
        site: resolveGlobalLocale(
            appLocale,
            provider.locale?.supportedLocales,
            provider.locale?.defaultLocale,
        ),
    };
}
