import type { AppLocale, AppTheme } from '../../Common/IPC';
import en from '../../../locales/en.json';
import ja from '../../../locales/ja.json';
import ko from '../../../locales/ko.json';

export interface ExternalLoginViewData {
  readonly locale: string;
  readonly theme: AppTheme;
  readonly siteTitle?: string;
  readonly title: string;
  readonly description: string;
  readonly waiting: string;
  readonly secure: string;
}

const LOCALES = { en, ja, ko } as const;

export function resolveAppLocale(locale: AppLocale, systemLocale: string): string {
  return locale === 'system' ? systemLocale : locale;
}

export function getExternalLoginViewData(
  locale: AppLocale,
  systemLocale: string,
  siteTitle?: string,
  theme: AppTheme = 'dark',
): ExternalLoginViewData {
  const resolvedLocale = resolveAppLocale(locale, systemLocale);
  const messages = LOCALES[toSupportedLanguage(resolvedLocale)].externalLogin;
  return { locale: resolvedLocale, siteTitle, theme, ...messages };
}

function toSupportedLanguage(locale: string): keyof typeof LOCALES {
  const language = locale.toLowerCase();
  if (language.startsWith('ko')) return 'ko';
  if (language.startsWith('ja')) return 'ja';
  return 'en';
}
