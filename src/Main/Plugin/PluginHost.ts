import {
  KAWAIKARA_SITE_API_VERSION,
  isBundleDefinition,
  type BundleDefinition,
} from '@kawaikara/site-api';
import type { SiteManager } from '../Manager/SiteManager';

export class PluginHost {
  private readonly installedBundleIds = new Set<string>();

  constructor(private readonly siteManager: SiteManager) {}

  install(bundle: BundleDefinition): void {
    if (!isBundleDefinition(bundle)) {
      throw new Error('The extension entry must export one Bundle.');
    }
    if (bundle.apiVersion !== KAWAIKARA_SITE_API_VERSION) {
      throw new Error(
        `Bundle ${bundle.id} requires Site API ${bundle.apiVersion}; ` +
          `this app supports ${KAWAIKARA_SITE_API_VERSION}.`,
      );
    }
    if (this.installedBundleIds.has(bundle.id)) {
      throw new Error(`Bundle ${bundle.id} is already installed.`);
    }

    try {
      this.siteManager.registerBundle(bundle);
      this.installedBundleIds.add(bundle.id);
    } catch (error) {
      this.siteManager.rollbackBundleRegistration(bundle.id);
      throw error;
    }
  }
}
