import { defineProviderLocale, type PluginMetadata, type ProviderLocaleResource,
  type ProviderSettingContribution } from '@kawaikara/site-api';

/** Preserve existing preference keys while moving ownership to registered Plugins. */
export function builtinPluginMetadata(
  id: string,
  key: string,
  resource: ProviderLocaleResource,
  settings: readonly ProviderSettingContribution[] = [],
): PluginMetadata {
  const messages = defineProviderLocale(resource);
  return {
    /** Shared manifest/decorator identity. */
    id,
    /** The real Plugin contributes its own switch. */
    activation: {
      /** Supported UI control. */
      type: 'boolean',
      /** Preserve existing saved preferences. */
      key,
      /** JSON-backed title. */
      title: messages.text(`settings.${key}.title`),
      /** Explain document reload before saving. */
      description: messages.text('settings.plugins.description'),
      /** Existing default behavior. */
      defaultValue: true,
      /** Page patches require a fresh document to undo reliably. */
      reloadOnChange: true,
    },
    /** Runtime only exposes these values to this Plugin. */
    settings,
  };
}
