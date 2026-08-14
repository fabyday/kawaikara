import {
  KAWAIKARA_SITE_API_VERSION,
  type SitePluginDefinition,
} from '@kawaikara/site-api';
import type { SiteManager } from '../Manager/SiteManager';

export class PluginHost {
  private readonly installedPluginIds = new Set<string>();

  constructor(private readonly siteManager: SiteManager) {}

  install(plugin: SitePluginDefinition): void {
    if (plugin.apiVersion !== KAWAIKARA_SITE_API_VERSION) {
      throw new Error(
        `Plugin ${plugin.id} requires site API ${plugin.apiVersion}; ` +
          `this app supports ${KAWAIKARA_SITE_API_VERSION}.`,
      );
    }

    if (this.installedPluginIds.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already installed.`);
    }

    this.siteManager.registerPlugin(plugin);
    this.installedPluginIds.add(plugin.id);
  }
}
