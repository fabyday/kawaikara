import { AbstractPlugin, plugin } from '@kawaikara/site-api';
import { builtinPluginMetadata } from '../../../../Functional/PluginMetadata';
import { createAppleStorefrontPersistenceScript } from '../../Inject/StorefrontPersistence';
import localization from '../../locale.json';

/** Optional page enhancement, independently managed by App. */
@plugin(builtinPluginMetadata('kawaikara.apple-tv.storefront', 'plugins.storefront-persistence', localization))
export default class StorefrontPlugin extends AbstractPlugin {
  /** Host disposal fences later reinjection. */
  activate(): void {
    this.requirePage().register({ id: 'Storefront', source: createAppleStorefrontPersistenceScript() });
  }
}
