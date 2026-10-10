import {
    KAWAIKARA_SITE_API_VERSION,
    isBundleDefinition,
    type BundleDefinition,
} from '@kawaikara/site-api';
import type { ProviderManager } from '../Manager/ProviderManager';

/** Hosts site-api Bundles with registration, replacement, and rollback ownership. */
export class BundleHost {
    /** Definitions accepted by the API contract and registered in this runtime. */
    private readonly installedBundles = new Map<string, BundleDefinition>();

    /** Creates an instance of BundleHost. */
    constructor(
        /** Coordinates registered Providers and their Bundle ownership. */
        private readonly providerManager: ProviderManager,
    ) {}

    /** Validates the API contract and registers one Bundle atomically. */
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
            this.providerManager.registerBundle(bundle);
            this.installedBundles.set(bundle.id, bundle);
        } catch (error) {
            this.providerManager.rollbackBundleRegistration(bundle.id);
            throw error;
        }
    }

    /** Unloads the Bundle and returns the active Provider state for restoration. */
    async uninstall(bundleId: string): Promise<{
        /** Whether the active site ID option is enabled. */
        activeSiteId?: string;
        /** Whether the active URL option is enabled. */
        activeUrl?: string;
    }> {
        if (!this.installedBundles.has(bundleId)) {
            throw new Error(`Bundle ${bundleId} is not installed.`);
        }
        const state = await this.providerManager.unregisterBundle(bundleId);
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
            await this.providerManager.unregisterBundle(bundle.id);
        try {
            this.providerManager.registerBundle(bundle);
            this.installedBundles.set(bundle.id, bundle);
            if (activeSiteId && this.providerManager.has(activeSiteId)) {
                if (activeUrl)
                    await this.providerManager.openUrl(activeSiteId, activeUrl);
                else await this.providerManager.load(activeSiteId);
            }
        } catch (error) {
            await this.providerManager
                .unregisterBundle(bundle.id)
                .catch(() => undefined);
            this.providerManager.registerBundle(previous);
            this.installedBundles.set(bundle.id, previous);
            if (activeSiteId && this.providerManager.has(activeSiteId)) {
                try {
                    if (activeUrl)
                        await this.providerManager.openUrl(
                            activeSiteId,
                            activeUrl,
                        );
                    else await this.providerManager.load(activeSiteId);
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
