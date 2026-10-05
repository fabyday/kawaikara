import type { ProviderMetadata, ProviderSettings } from '@kawaikara/site-api';

/** Compare effective values so writing an unchanged default never reloads a page. */
export function requiresProviderReload(
  metadata: ProviderMetadata,
  previous: ProviderSettings,
  next: ProviderSettings,
): boolean {
  return (metadata.settings?.categories ?? []).some((category) =>
    category.settings.some((setting) => {
      if (setting.type !== 'boolean' || !setting.reloadOnChange) return false;
      const before = typeof previous[setting.key] === 'boolean'
        ? previous[setting.key] : setting.defaultValue;
      const after = typeof next[setting.key] === 'boolean'
        ? next[setting.key] : setting.defaultValue;
      return before !== after;
    }));
}
