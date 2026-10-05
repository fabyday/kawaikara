import type { PluginMetadata, ProviderBooleanSettingContribution, ProviderMetadata,
  ProviderSettings } from '@kawaikara/site-api';
import type { RegisteredRuntimePlugin } from './SiteRuntime';

/** Physical ownership takes precedence over a Bundle-level target list. */
export function pluginMatchesProvider(plugin: RegisteredRuntimePlugin, providerId: string): boolean {
  return (!plugin.scopedProviderId || plugin.scopedProviderId === providerId) &&
    (!plugin.metadata.providerIds?.length || plugin.metadata.providerIds.includes(providerId));
}

/** Every registered Plugin has a real switch, even legacy Plugins without settings. */
export function pluginActivation(metadata: PluginMetadata): ProviderBooleanSettingContribution {
  return metadata.activation ?? {
    /** Existing Plugins preserve their enabled behavior. */
    type: 'boolean',
    /** Stable identity avoids coupling preferences to display names. */
    key: `plugins.${metadata.id}.enabled`,
    /** Manifest/decorator name is the fallback for unlocalized third-party Plugins. */
    title: metadata.name ?? metadata.id,
    /** Preserve existing installs. */
    defaultValue: true,
    /** Legacy Plugins cannot promise reversible document changes. */
    reloadOnChange: true,
  };
}

/** Desired state is resolved from the containing Provider's persisted preferences. */
export function isPluginEnabled(metadata: PluginMetadata, settings: ProviderSettings): boolean {
  const activation = pluginActivation(metadata);
  const value = settings[activation.key];
  return typeof value === 'boolean' ? value : activation.defaultValue;
}

/** Compose UI from registered Plugins; Providers never manufacture fake Plugin switches. */
export function withPluginSettings(metadata: ProviderMetadata, plugins: readonly RegisteredRuntimePlugin[]): ProviderMetadata {
  const categories = plugins.filter(plugin => pluginMatchesProvider(plugin, metadata.id))
    .map(({ metadata: plugin }) => {
      const activation = pluginActivation(plugin);
      return {
        /** Stable Plugin-owned section identity. */
        id: `plugin.${plugin.id}`,
        /** Same localized identity in the toggle and section heading. */
        title: activation.title,
        /** Explain reload behavior before the user saves. */
        description: activation.description,
        /** All controls are contributed by this Plugin. */
        settings: [activation, ...(plugin.settings ?? [])],
      };
    });
  return {
    ...metadata,
    /** Rebuild generated Plugin categories atomically when Bundle registrations change. */
    settings: {
      /** The plugin. category namespace is reserved for App-composed contributions. */
      categories: [
        ...(metadata.settings?.categories ?? []).filter(category => !category.id.startsWith('plugin.')),
        ...categories,
      ],
    },
  };
}
