import type {
  ProviderLocalizedText,
  ProviderSettingListItem,
} from '@kawaikara/site-api';
import type {
  AppLocale,
  PreferencePatch,
  PreferenceState
} from '../../../../Common/IPC';

/** Returns the provider boolean setting. */
export function getProviderBooleanSetting(
  preferences: PreferenceState,
  providerId: string,
  key: string,
  fallback: boolean,
): boolean {
  const value = preferences.providerSettings[providerId]?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

/** Handles the update provider setting. */
export function onUpdateProviderSetting(
  preferences: PreferenceState,
  providerId: string,
  key: string,
  value: boolean | readonly ProviderSettingListItem[],
  onUpdate: (patch: PreferencePatch) => void,
): void {
  onUpdate({
    providerSettings: {
      ...preferences.providerSettings,
      [providerId]: {
        ...(preferences.providerSettings[providerId] ?? {}),
        [key]: value,
      },
    },
  });
}

/** Resolves the provider text. */
export function resolveProviderText(
  value: ProviderLocalizedText,
  locale: AppLocale,
): string {
  if (typeof value === 'string') return value;
  const requested = locale === 'system' ? navigator.language : locale;
  const language = requested.split('-')[0]?.toLowerCase();
  const match = Object.entries(value).find(([key]) =>
    key.toLowerCase() === requested.toLowerCase(),
  )?.[1] ?? Object.entries(value).find(([key]) =>
    key.split('-')[0]?.toLowerCase() === language,
  )?.[1];
  return match ?? value.default ?? value['en-US'] ?? Object.values(value)[0] ?? '';
}
