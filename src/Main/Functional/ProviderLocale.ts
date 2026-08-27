import type {
  ProviderDecoratorMetadata,
  ProviderLocalizedText,
  ProviderLocaleResource,
  ProviderMetadata,
} from '@kawaikara/site-api';

/** Defines the unresolved provider metadata type. */
type UnresolvedProviderMetadata =
  Omit<ProviderMetadata, 'menu' | 'shortcut' | 'settings'> &
  Required<Pick<ProviderDecoratorMetadata, 'menu'>> &
  Pick<ProviderDecoratorMetadata, 'shortcut' | 'settings'>;

/** Resolves the global locale. */
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

/** Resolves the provider locale contributions. */
export function resolveProviderLocaleContributions(
  metadata: UnresolvedProviderMetadata,
  localization: ProviderLocaleResource | undefined,
  providerId: string,
): ProviderMetadata {
  /** Performs the required text operation. */
  const requiredText = (
    explicit: ProviderLocalizedText | undefined,
    key: string,
  ): ProviderLocalizedText => {
    const inferred = explicit !== undefined
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
  ): ProviderLocalizedText | undefined => explicit !== undefined
    ? explicit
    : readProviderLocaleText(localization, key);

  return {
    ...metadata,
    /** The menu value. */
    menu: {
      ...metadata.menu,
      /** The panels value. */
      panels: metadata.menu.panels?.map((panel) => ({
        ...panel,
        title: requiredText(panel.title, `menu.panel.${panel.id}.title`),
      })),
    },
    /** The shortcut value. */
    shortcut: metadata.shortcut
      ? {
          ...metadata.shortcut,
          /** The actions value. */
          actions: metadata.shortcut.actions?.map((action) => ({
            ...action,
            title: requiredText(action.title, `shortcut.${action.id}.title`),
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
            title: requiredText(category.title, `settings.${category.id}.title`),
            description: optionalText(
              category.description,
              `settings.${category.id}.description`,
            ),
            settings: category.settings.map((setting) => ({
              ...setting,
              title: requiredText(setting.title, `settings.${setting.key}.title`),
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
