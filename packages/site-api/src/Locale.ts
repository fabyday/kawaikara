import type { ProviderLocalizedText } from './Provider';

/** Defines the provider locale resource type. */
export type ProviderLocaleResource = Readonly<
  Record<string, Readonly<Record<string, string>>>
>;

/** Defines the provider locale key type. */
type ProviderLocaleKey<Resource extends ProviderLocaleResource> = Extract<
  {
    [Locale in keyof Resource]: keyof Resource[Locale];
  }[keyof Resource],
  string
>;

/** Describes the provider locale contract. */
export interface ProviderLocale<Resource extends ProviderLocaleResource> {
  /** Returns the locale map consumed by Provider presentation contributions. */
  text(key: ProviderLocaleKey<Resource>): ProviderLocalizedText;
  /** Resolves one message for page injection and other runtime behavior. */
  resolve(
    locale: string | undefined,
    key: ProviderLocaleKey<Resource>,
    defaultLocale?: string,
  ): string;
}

/** Defines a typed Provider locale resource loaded from locale.json. */
export function defineProviderLocale<const Resource extends ProviderLocaleResource>(
  resource: Resource,
): ProviderLocale<Resource> {
  const locales = Object.entries(resource);
  if (locales.length === 0) {
    throw new Error('A Provider locale resource must contain at least one locale.');
  }

  /** Performs the text operation. */
  const text = (key: ProviderLocaleKey<Resource>): ProviderLocalizedText => {
    const localized = Object.fromEntries(
      locales.flatMap(([locale, messages]) => {
        const value = messages[key];
        return typeof value === 'string' && value.trim()
          ? [[locale, value] as const]
          : [];
      }),
    );
    if (Object.keys(localized).length === 0) {
      throw new Error(`Provider locale message ${key} is missing.`);
    }
    return Object.freeze(localized);
  };

  return Object.freeze({
    /** The text value. */
    text,
    /** Resolves the operation. */
    resolve(
      locale: string | undefined,
      key: ProviderLocaleKey<Resource>,
      defaultLocale = 'en-US',
    ) {
      const requested = normalizeLocale(locale);
      const language = requested.split('-')[0];
      const candidates = [
        requested,
        ...locales
          .map(([candidate]) => candidate)
          .filter((candidate) => normalizeLocale(candidate).split('-')[0] === language),
        defaultLocale,
        locales[0]?.[0],
      ];
      for (const candidate of candidates) {
        if (!candidate) continue;
        const entry = locales.find(
          ([available]) => normalizeLocale(available) === normalizeLocale(candidate),
        );
        const value = entry?.[1][key];
        if (typeof value === 'string' && value.trim()) return value;
      }
      throw new Error(`Provider locale message ${key} is missing.`);
    },
  });
}

/** Normalizes the locale. */
function normalizeLocale(locale: string | undefined): string {
  return (locale ?? '').trim().replace('_', '-').toLowerCase();
}
