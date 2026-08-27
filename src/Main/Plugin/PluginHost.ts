import {
  KAWAIKARA_SITE_API_VERSION,
  isBundleDefinition,
  type BundleDefinition,
} from '@kawaikara/site-api';
import type { SiteManager } from '../Manager/SiteManager';

/** Represents the plugin host. */
export class PluginHost {
  /** The installed bundles value. */
  private readonly installedBundles = new Map<string, BundleDefinition>();

  /** Creates an instance of PluginHost. */
  constructor(
    /** The site manager value. */
    private readonly siteManager: SiteManager,
  ) {}

  /** Installs the operation. */
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
    if (this.installedBundles.has(bundle.id)) {
      throw new Error(`Bundle ${bundle.id} is already installed.`);
    }

    try {
      this.siteManager.registerBundle(bundle);
      this.installedBundles.set(bundle.id, bundle);
    } catch (error) {
      this.siteManager.rollbackBundleRegistration(bundle.id);
      throw error;
    }
  }

  /** Uninstalls the operation. */
  async uninstall(bundleId: string): Promise<{
    /** Whether the active site ID option is enabled. */
    activeSiteId?: string;
    /** Whether the active URL option is enabled. */
    activeUrl?: string;
  }> {
    if (!this.installedBundles.has(bundleId)) {
      throw new Error(`Bundle ${bundleId} is not installed.`);
    }
    const state = await this.siteManager.unregisterBundle(bundleId);
    this.installedBundles.delete(bundleId);
    return state;
  }

  /** Replaces one Bundle transactionally and restores the previous definition on failure. */
  async replace(bundle: BundleDefinition): Promise<void> {
    if (!isBundleDefinition(bundle)) {
      throw new Error('The extension entry must export one Bundle.');
    }
    const previous = this.installedBundles.get(bundle.id);
    if (!previous) {
      this.install(bundle);
      return;
    }
    if (bundle.apiVersion !== KAWAIKARA_SITE_API_VERSION) {
      throw new Error(
        `Bundle ${bundle.id} requires Site API ${bundle.apiVersion}; ` +
          `this app supports ${KAWAIKARA_SITE_API_VERSION}.`,
      );
    }

    const { activeSiteId, activeUrl } =
      await this.siteManager.unregisterBundle(bundle.id);
    try {
      this.siteManager.registerBundle(bundle);
      this.installedBundles.set(bundle.id, bundle);
      if (activeSiteId && this.siteManager.has(activeSiteId)) {
        if (activeUrl) await this.siteManager.openUrl(activeSiteId, activeUrl);
        else await this.siteManager.load(activeSiteId);
      }
    } catch (error) {
      await this.siteManager.unregisterBundle(bundle.id).catch(() => undefined);
      this.siteManager.registerBundle(previous);
      this.installedBundles.set(bundle.id, previous);
      if (activeSiteId && this.siteManager.has(activeSiteId)) {
        try {
          if (activeUrl) await this.siteManager.openUrl(activeSiteId, activeUrl);
          else await this.siteManager.load(activeSiteId);
        } catch (restoreError) {
          throw new AggregateError(
            [error, restoreError],
            `Bundle ${bundle.id} reload and rollback both failed.`,
          );
        }
      }
      throw error;
    }
  }
}
