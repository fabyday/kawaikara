import type { AppLocale, AppTheme } from '../../Common/IPC';
import en from '../../../locales/en.json';
import ja from '../../../locales/ja.json';
import ko from '../../../locales/ko.json';

/** Describes the external login view data contract. */
export interface ExternalLoginViewData {
  /** The locale value. */
  readonly locale: string;
  /** The theme value. */
  readonly theme: AppTheme;
  /** The site title value. */
  readonly siteTitle?: string;
  /** The title value. */
  readonly title: string;
  /** The description value. */
  readonly description: string;
  /** The waiting value. */
  readonly waiting: string;
  /** The secure value. */
  readonly secure: string;
}

/** Defines the shared locales constant. */
const LOCALES = {
  /** The en value. */
  en,
  /** The ja value. */
  ja,
  /** The ko value. */
  ko,
} as const;

/** Resolves the app locale. */
export function resolveAppLocale(locale: AppLocale, systemLocale: string): string {
  return locale === 'system' ? systemLocale : locale;
}

/** Returns the external login view data. */
export function getExternalLoginViewData(
  locale: AppLocale,
  systemLocale: string,
  siteTitle?: string,
  theme: AppTheme = 'dark',
): ExternalLoginViewData {
  const resolvedLocale = resolveAppLocale(locale, systemLocale);
  const messages = LOCALES[toSupportedLanguage(resolvedLocale)].externalLogin;
  return {
    /** The locale value. */
    locale: resolvedLocale,
    /** The site title value. */
    siteTitle,
    /** The theme value. */
    theme, ...messages,
  };
}

/** Performs the to supported language operation. */
function toSupportedLanguage(locale: string): keyof typeof LOCALES {
  const language = locale.toLowerCase();
  if (language.startsWith('ko')) return 'ko';
  if (language.startsWith('ja')) return 'ja';
  return 'en';
}
