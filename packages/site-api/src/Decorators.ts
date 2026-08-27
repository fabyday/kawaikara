import type {
  ProviderConstructor,
  ProviderDecoratorMetadata,
  ProviderMetadata,
} from './Provider';
import type { PluginConstructor, PluginMetadata } from './Plugin';

/** Defines the shared provider metadata constant. */
const PROVIDER_METADATA = Symbol.for('@kawaikara/site-api/provider-metadata');
/** Defines the shared plugin metadata constant. */
const PLUGIN_METADATA = Symbol.for('@kawaikara/site-api/plugin-metadata');

/** Performs the provider operation. */
export function provider(metadata: ProviderDecoratorMetadata = {}) {
  return <T extends ProviderConstructor>(target: T): T => {
    Object.defineProperty(target, PROVIDER_METADATA, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({ ...metadata
      }),
    });

    return target;
  };
}

/** Returns the provider metadata. */
export function getProviderMetadata(
  target: ProviderConstructor,
): ProviderDecoratorMetadata | undefined {
  return (target as unknown as Record<symbol, ProviderDecoratorMetadata>)[PROVIDER_METADATA];
}

/** Performs the plugin operation. */
export function plugin(metadata: PluginMetadata) {
  return <T extends PluginConstructor>(target: T): T => {
    if (!metadata.id.trim()) {
      throw new Error('A plugin must have a non-empty id.');
    }

    Object.defineProperty(target, PLUGIN_METADATA, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({
        ...metadata,
        providerIds: metadata.providerIds
          ? Object.freeze([...metadata.providerIds])
          : undefined,
        panels: metadata.panels
          ? Object.freeze([...metadata.panels])
          : undefined,
      }),
    });

    return target;
  };
}

/** Returns the plugin metadata. */
export function getPluginMetadata(
  target: PluginConstructor,
): PluginMetadata | undefined {
  return (target as unknown as Record<symbol, PluginMetadata>)[PLUGIN_METADATA];
}
