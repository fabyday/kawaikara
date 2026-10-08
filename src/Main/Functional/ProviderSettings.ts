import type { ProviderMetadata, ProviderSettings } from '@kawaikara/site-api';

/** Compare effective values so writing an unchanged default never reloads a page. */
export function requiresProviderReload(
  metadata: ProviderMetadata,
  previous: ProviderSettings,
  next: ProviderSettings,
): boolean {
  return (metadata.settings?.categories ?? []).some((category) =>
    category.settings.some((setting) => {
      if (setting.type === 'item-list' || !setting.reloadOnChange) return false;
      /** Performs the valid operation. */
      const valid = (value: unknown) => setting.type === 'boolean' ? typeof value === 'boolean'
        : setting.options.some(option => option.value === value);
      const before = valid(previous[setting.key])
        ? previous[setting.key] : setting.defaultValue;
      const after = valid(next[setting.key])
        ? next[setting.key] : setting.defaultValue;
      return before !== after;
    }));
}
