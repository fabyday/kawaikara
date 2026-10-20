import { listProviderExternalApps } from '../Functional/Bundle/Provider/ProviderCatalog';
import type { ExternalAppCookie } from '../Functional/ExternalApps/ExternalAppAdapter';
import type { ExternalAppManager } from './ExternalAppManager';
import { dispatchProviderDownload } from '../Functional/Bundle/Provider/ProviderDownloads';
import type { ProviderDownloadResult } from '@kawaikara/site-api';
import type { WebExtensionProvider } from '@kawaikara/site-api';
import {
    SHORT_FORM_PUBLISHER_CAPABILITY,
    type AbstractProvider,
    type BundleDefinition,
    type Disposable,
    type NewWindowPolicy,
    type PictureInPictureSubtitleController,
    type ProviderMetadata,
    type ProviderPictureInPictureSession,
    type ProviderSettings,
    type ShortFormVideoDescriptor,
    type ShortFormVideoPublisher,
    type SiteContext,
    type SiteLocaleContext,
    type SitePagePipeline,
    type SitePermission,
    type SiteRequestDetails,
    type SiteRequestHeaders,
    type SiteRequestRedirect,
} from '@kawaikara/site-api';
import type {
    BrowserProfileInfo,
    BundleRuntimeInfo,
    PreferenceState,
    SiteMenuItem,
} from '../../Common/IPC';
import type { SiteTransitionState } from '../../Common/SiteTransition';
import {
    pluginMatchesProvider,
    withPluginSettings,
} from '../Functional/Bundle/Plugin/PluginDescriptors';
import { PluginRuntime } from '../Functional/Bundle/Plugin/PluginRuntime';
import { resolveProviderAddress } from '../Functional/Bundle/Provider/ProviderAddress';
import {
    findBrowserProfile,
    listProviderBrowserDataPartitions,
    resolveProviderBrowserProfile,
} from '../Functional/Bundle/Provider/ProviderBrowserProfiles';
import {
    listBundleRuntimeInfo,
    listProviderMenuItems,
    listProviderWebExtensions,
    type ProviderCatalogContext,
} from '../Functional/Bundle/Provider/ProviderCatalog';
import { resolveProviderLocales } from '../Functional/Bundle/Provider/ProviderLocale';
import {
    installProviderBrowserIdentity,
    installProviderPictureInPicturePolicy,
} from '../Functional/Bundle/Provider/ProviderPagePolicy';
import { prepareBundleRegistration } from '../Functional/Bundle/Provider/ProviderRegistration';
import { requiresProviderReload } from '../Functional/Bundle/Provider/ProviderSettings';
import { createScopedSiteContext } from '../Functional/Bundle/Provider/ScopedSiteContext';
import {
    createAcceptLanguage,
    createSharedRuntime,
    isNavigationAborted,
    setHeader,
    type BrowserDataTarget,
    type RegisteredBundle,
    type RegisteredProvider,
    type RegisteredRuntimePlugin,
    type ResolvedSiteAddress,
    type SiteContextFactory,
    type SiteRuntimeProfile,
} from '../Functional/Bundle/Provider/SiteRuntime';
import { resolvePictureInPictureOverlaySelectors } from '../Functional/Window/PictureInPicture/PictureInPictureOverlays';
import { createProviderPictureInPictureSubtitleController } from '../Functional/Window/PictureInPicture/PictureInPictureSubtitleRuntime';
import { DragDropManager } from './DragDropManager';

/** Registers Providers and manages their activation, context, and Plugins. */
export class ProviderManager {
    /** Drop discovery includes inactive Providers and follows Bundle ownership. */
    readonly dragDrop = new DragDropManager();
    /** The sites value. */
    private readonly sites = new Map<string, RegisteredProvider>();
    /** The bundles value. */
    private readonly bundles = new Map<string, RegisteredBundle>();
    /** The runtime plugins value. */
    private readonly runtimePlugins = new Map<
        string,
        RegisteredRuntimePlugin
    >();
    /** The current provider value. */
    private currentProvider?: AbstractProvider;
    /** Plugin authority belongs to one Provider activation, never a global singleton. */
    private currentPluginRuntime?: PluginRuntime;
    /** Snapshot actually applied to the current instance, not the preference draft. */
    private currentProviderSettings: ProviderSettings = {};
    /** The current site ID value. */
    private currentSiteId?: string;
    /** The current locale value. */
    private currentLocale?: SiteLocaleContext;
    /** The current runtime value. */
    private currentRuntime?: SiteRuntimeProfile;
    /** The current page pipeline value. */
    private currentPagePipeline?: SitePagePipeline;
    /** The current runtime disposables value. */
    private readonly currentRuntimeDisposables: Disposable[] = [];
    /** The current page policy disposables value. */
    private readonly currentPagePolicyDisposables: Disposable[] = [];
    /** The plugin browser profiles value. */
    private readonly pluginBrowserProfiles = new Map<
        string,
        BrowserProfileInfo
    >();
    /** Serializes Provider teardown and activation across every caller. */
    private siteTransition: Promise<void> = Promise.resolve();
    /** Outgoing cleanup tasks hold snapshots, never the successor's mutable fields. */
    private readonly retiredSiteCleanups = new Set<Promise<void>>();
    /** Revokes Provider authority and begins its captured login cancellation. */
    private currentContextRetirement?: () => Promise<void>;

    /**
     * Creates an empty registry and its serialized Provider activation coordinator.
     *
     * @param createContext - Creates the runtime context for a selected storage profile
     * and permission set. Called during activation, never during catalog reads.
     * @param getPreferences - Reads the latest application preference snapshot on demand.
     * @param getCurrentAddress - Reads the active address for reload/removal recovery.
     * @param onTransition - Receives loading/ready/failed notifications; defaults to a no-op.
     * Callbacks should not throw or await a new transition on this manager.
     * @param externalApps - Optional external-app registry for static action dispatch.
     * @param readExternalCookies - Injected URL-filtered cookie reader for the Provider-selected profile.
     * @remarks Construction does not register Bundles, instantiate Providers or open windows.
     * The application owns this manager and requests disposal during shutdown.
     */
    constructor(
        /** Runtime-context factory invoked with the selected profile and permissions. */
        private readonly createContext: SiteContextFactory,
        /** Reads current preferences rather than capturing a stale startup snapshot. */
        private readonly getPreferences: () => PreferenceState,
        /** Reads the active document address for transition recovery. */
        private readonly getCurrentAddress: () => string,
        /** Reports queued activation independently of captured outgoing teardown. */
        private readonly onTransition: (
            state: SiteTransitionState,
        ) => void = () => undefined,
        /** Narrow external-app facade supplied by application composition. */
        private readonly externalApps?: ExternalAppManager,
        /** Injected resource reader; native cookie/session implementation stays outside the manager. */
        private readonly readExternalCookies?: (
            partition: string,
            url: string,
        ) => Promise<readonly ExternalAppCookie[]>,
    ) {}

    /**
     * Validates a loaded Bundle and commits its Provider, Plugin and profile registrations.
     *
     * @param bundle - Loaded definition with constructors and resolved source resources.
     * @throws When registration staging fails, leaving existing registry maps unchanged.
     * Errors from commit-time integrations or change subscribers also propagate.
     * @remarks Does not load a Provider or read Bundle files. Validation precedes map writes;
     * WebExtension subscribers are notified after commit. Use the Bundle host transaction
     * for install rollback rather than assuming subscriber errors roll back automatically.
     */
    registerBundle(bundle: BundleDefinition): void {
        const prepared = prepareBundleRegistration(bundle, {
            /** Existing registry remains unchanged during validation. */
            sites: this.sites,
            /** Existing Bundle identifiers. */
            bundles: this.bundles,
            /** Existing Plugin definitions. */
            plugins: this.runtimePlugins,
            /** Existing browser profile identifiers. */
            browserProfiles: this.pluginBrowserProfiles,
        });
        for (const registration of prepared.composedProviders)
            this.sites.set(registration.metadata.id, registration);
        for (const registration of prepared.providers)
            this.dragDrop.registerProvider(registration.metadata);
        for (const plugin of prepared.plugins)
            this.runtimePlugins.set(plugin.metadata.id, plugin);
        for (const profile of prepared.bundle.browserProfiles)
            this.pluginBrowserProfiles.set(profile.id, profile);
        this.bundles.set(bundle.id, prepared.bundle);
        this.notifyWebExtensionChanges();
    }

    /**
     * Removes one Bundle's registrations and recomposes settings on remaining Providers.
     *
     * @param bundleId - Registered Bundle identifier; unknown identifiers are ignored.
     * @remarks Removes owned drop routes, Plugins and browser profiles, then notifies
     * catalog subscribers. This synchronous operation does not unload the active Provider.
     * Call unregisterBundle() for normal removal or use it after a safe install rollback.
     */
    rollbackBundleRegistration(bundleId: string): void {
        const registered = this.bundles.get(bundleId);
        if (!registered) return;
        for (const [siteId, site] of this.sites) {
            if (site.bundleId === bundleId) {
                this.sites.delete(siteId);
                this.dragDrop.unregisterProvider(siteId);
            }
        }
        for (const [pluginId, plugin] of this.runtimePlugins) {
            if (plugin.bundleId === bundleId)
                this.runtimePlugins.delete(pluginId);
        }
        for (const profile of registered.browserProfiles) {
            this.pluginBrowserProfiles.delete(profile.id);
        }
        this.bundles.delete(bundleId);
        for (const [id, registration] of this.sites) {
            this.sites.set(id, {
                ...registration,
                metadata: withPluginSettings(registration.metadata, [
                    ...this.runtimePlugins.values(),
                ]),
            });
        }
        this.notifyWebExtensionChanges();
    }

    /**
     * Serializes Bundle removal with Provider transitions and outstanding retirement cleanup.
     *
     * @param bundleId - Bundle to remove, including its attached Plugins and profile registrations.
     * @returns The affected active Provider ID and its previous address, when either the
     * Provider or one of its attached Plugins belongs to the removed Bundle.
     * @remarks Unloads an affected active Provider and drains retired cleanup before removing
     * registrations. Browser Session storage is preserved for development reloads.
     * Cleanup failures reject the operation before registry removal completes.
     */
    async unregisterBundle(bundleId: string): Promise<{
        /** Whether the active site ID option is enabled. */
        activeSiteId?: string;
        /** Whether the active URL option is enabled. */
        activeUrl?: string;
    }> {
        return this.runSiteTransition(async () => {
            const activeSiteId = this.currentSiteId;
            const activeRegistration = activeSiteId
                ? this.sites.get(activeSiteId)
                : undefined;
            const ownedActiveSiteId =
                activeRegistration?.bundleId === bundleId ||
                (activeSiteId &&
                    this.pluginsFor(activeSiteId).some(
                        (plugin) => plugin.bundleId === bundleId,
                    ))
                    ? activeSiteId
                    : undefined;
            const activeUrl = ownedActiveSiteId
                ? this.getCurrentAddress() || undefined
                : undefined;
            if (ownedActiveSiteId) await this.unloadCurrent();
            await this.drainRetiredSiteCleanups();
            this.rollbackBundleRegistration(bundleId);
            return {
                /** Whether the active site ID option is enabled. */
                activeSiteId: ownedActiveSiteId,
                /** Whether the active URL option is enabled. */
                activeUrl,
            };
        });
    }

    /** Observers see committed registration changes, including temporary removal during replacement. */
    private readonly webExtensionListeners = new Set<() => void>();
    /** Subscribes the external catalog without activating a Provider instance. */
    subscribeWebExtensions(listener: () => void): () => void {
        this.webExtensionListeners.add(listener);
        return () => {
            this.webExtensionListeners.delete(listener);
        };
    }

    /** Replacement temporarily unregisters Providers; permission scopes are reconciled at commit. */
    private webExtensionUpdateDepth = 0;
    /** Defers grant pruning across a transactional Bundle replacement or its rollback. */
    beginWebExtensionUpdate(): () => void {
        this.webExtensionUpdateDepth++;
        let finished = false;
        return () => {
            if (finished) return;
            finished = true;
            this.webExtensionUpdateDepth--;
            this.notifyWebExtensionChanges();
        };
    }
    /** Announces only the settled registry, preserving consent for selector-only updates. */
    private notifyWebExtensionChanges(): void {
        if (this.webExtensionUpdateDepth) return;
        for (const listener of this.webExtensionListeners) listener();
    }

    /** Lists current manifest-declared external app consumers for trusted settings. */
    listExternalAppProviders() { return listProviderExternalApps(this.sites.values()); }

    /** Publishes static browser declarations without activating Providers. */
    listWebExtensionProviders(): WebExtensionProvider[] {
        return listProviderWebExtensions(this.sites.values());
    }

    /** Routes only a declared custom browser action to its registered desktop Provider. */
    async handleWebExtensionAction(
        providerId: string,
        request: import('@kawaikara/site-api').WebExtensionInvocation,
    ): Promise<import('@kawaikara/site-api').WebExtensionResult | void> {
        const registration = this.sites.get(providerId);
        if (
            registration?.metadata.webExtension?.actionDefinitions[
                request.action
            ]?.handler !== 'provider' ||
            !registration.constructor.onWebExtensionAction
        ) {
            throw new Error('Provider browser action is unavailable.');
        }
        return registration.constructor.onWebExtensionAction(request);
    }

    /**
     * Dispatches a declared download to the Provider without activating or constructing it.
     * @param providerId - Registered Provider whose download declaration grants this route.
     * @param url - HTTPS source; must resolve to the requested Provider's declared hosts.
     * @returns Provider-selected app and handoff result, including unavailability.
     * @throws For missing declarations/services, mismatched hosts, or handler/transport failures.
     */
    async requestDownload(
        providerId: string,
        url: string,
    ): Promise<ProviderDownloadResult> {
        const registration = this.sites.get(providerId);
        return dispatchProviderDownload(
            registration,
            url,
            this.externalApps,
            () => this.sites.get(providerId) === registration,
            () => this.resolveBrowserProfile(registration!).partition,
            this.readExternalCookies,
        );
    }

    /** Projects the current registry into visible menu items. */
    listMenuItems(): SiteMenuItem[] {
        return listProviderMenuItems(this.catalogContext());
    }

    /** Captures one consistent preference/runtime snapshot for a catalog projection. */
    private catalogContext(): ProviderCatalogContext {
        return {
            /** Registered Providers. */
            providers: [...this.sites.values()],
            /** Registered Plugins. */
            plugins: [...this.runtimePlugins.values()],
            /** Stored settings are read-only during projection. */
            settings: this.getPreferences().providerSettings ?? {},
            /** Current activation identity. */
            currentSiteId: this.currentSiteId,
            /** Current Plugin states are read once per projection. */
            pluginStates: this.currentPluginRuntime?.listStates() ?? [],
        };
    }

    /**
     * Returns the Bundle settings catalog for the current committed registry.
     *
     * @returns Bundles sorted by display name, including localized Provider settings and
     * Plugin states derived from one captured preference/runtime snapshot.
     * @remarks Delegates presentation mapping to listBundleRuntimeInfo(). Does not activate
     * Providers or persist settings; consumers must treat the result as read-only.
     */
    listBundles(): BundleRuntimeInfo[] {
        return listBundleRuntimeInfo(
            this.bundles.values(),
            this.catalogContext(),
        );
    }

    /** Determines whether the current site condition applies. */
    isCurrentSite(id: string): boolean {
        return this.currentSiteId === id;
    }

    /** Current drop target for Local registrations; menu layers do not change it. */
    getActiveProviderId(): string | undefined {
        return this.currentSiteId;
    }

    /**
     * Queues activation of a registered Provider behind earlier requested transitions.
     *
     * @param id - Registered Provider identifier.
     * @returns A promise fulfilled after context creation, settings, Plugin activation,
     * Provider load and required page-policy refresh complete.
     * @throws When the ID is unknown or any activation stage fails.
     * @remarks Retires previous authority before starting the successor. Captured outgoing
     * cleanup may continue asynchronously; it cannot mutate successor state. Reports
     * loading/ready/failed states through the transition callback.
     */
    async load(id: string): Promise<void> {
        await this.runSiteTransition(() => this.loadSite(id));
    }

    /** Loads one Provider while the site transition queue is held. */
    private async loadSite(id: string): Promise<void> {
        const registration = this.sites.get(id);
        if (!registration) {
            throw new Error(`Unknown site: ${id}`);
        }

        this.onTransition({
            /** Requested Provider. */
            siteId: id,
            /** Provider display name. */
            title: registration.metadata.title,
            /** Begin before potentially slow outgoing Provider cleanup. */
            phase: 'loading',
        });
        try {
            await this.loadRegisteredSite(id, registration);
            this.onTransition({
                /** Activated Provider. */
                siteId: id,
                /** Provider display name. */
                title: registration.metadata.title,
                /** Provider lifecycle and required policy installation completed. */
                phase: 'ready',
            });
        } catch (error) {
            this.onTransition({
                /** Failed requested Provider. */
                siteId: id,
                /** Provider display name. */
                title: registration.metadata.title,
                /** Context/constructor/load/policy failures belong to this activation only. */
                phase: 'failed',
                /** Displayed as text by the app-owned backing page. */
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /** Activates the next Provider without waiting for captured outgoing async cleanup. */
    private async loadRegisteredSite(
        id: string,
        registration: RegisteredProvider,
    ): Promise<void> {
        this.retireCurrent();

        const locale = this.resolveLocales(registration);
        const runtime = this.resolveBrowserProfile(registration);
        const permissions = new Set(registration.metadata.permissions ?? []);
        const context = await this.createContext(runtime, permissions);
        const scoped = createScopedSiteContext({
            ...context,
            page: permissions.has('script-injection')
                ? context.page
                : undefined,
            locale,
        });
        const providerContext = scoped.context;
        this.currentPagePipeline = context.page;
        this.currentContextRetirement = scoped.retire;
        this.activeContext = providerContext;
        try {
            const pluginRuntime = new PluginRuntime(
                providerContext,
                registration.metadata,
            );
            this.currentPluginRuntime = pluginRuntime;
            const contextWithCapabilities = {
                ...providerContext,
                capabilities: pluginRuntime.capabilities,
            };
            this.activeContext = contextWithCapabilities;
            const provider = new registration.constructor(
                contextWithCapabilities,
            );
            this.currentProvider = provider;
            this.currentSiteId = id;
            this.currentLocale = locale;
            this.currentRuntime = runtime;
            // Internal views have no navigable page to patch. Executing a page-world
            // policy in their detached, initial about:blank WebContents makes Electron
            // wait forever for did-stop-loading and leaves the site-open IPC pending.
            const refreshPagePictureInPicturePolicy = permissions.has(
                'navigation',
            )
                ? this.installPagePictureInPicturePolicy(
                      context,
                      registration.metadata,
                  )
                : async () => undefined;
            this.installBrowserIdentity(providerContext, registration.metadata);
            this.currentProviderSettings = this.getProviderSettings(id);
            await provider.onSettingsChanged(this.currentProviderSettings);
            await this.activatePlugins(registration);
            await provider.load();
            await refreshPagePictureInPicturePolicy();
        } catch (error) {
            this.retireCurrent();
            throw error;
        }
    }

    /**
     * Activates a Provider and navigates it while holding the site transition queue.
     *
     * @param id - Registered Provider selected for the URL.
     * @param url - Target URL; context navigation still enforces the Provider's permissions and policy.
     * @returns A promise fulfilled after activation and navigation handoff.
     * @throws For activation or navigation errors other than Chromium navigation-aborted
     * errors, which are tolerated because streaming SPAs can replace an initial navigation.
     * @remarks Call resolveAddress() first when starting from untrusted user address input.
     */
    async openUrl(id: string, url: string): Promise<void> {
        await this.runSiteTransition(async () => {
            await this.loadSite(id);
            try {
                await this.currentProviderContext().viewer.loadURL(url);
            } catch (error) {
                // Streaming SPAs commonly replace the initial navigation. Electron
                // reports that successful hand-off as ERR_ABORTED.
                if (!isNavigationAborted(error)) {
                    throw error;
                }
            }
        });
    }

    /** Returns the current site ID. */
    getCurrentSiteId(): string | undefined {
        return this.currentSiteId;
    }

    /** Returns the current short form video descriptor. */
    getCurrentShortFormVideoDescriptor(): ShortFormVideoDescriptor | undefined {
        const registration = this.currentSiteId
            ? this.sites.get(this.currentSiteId)
            : undefined;
        return registration?.metadata.shortFormVideo;
    }

    /** Returns the current short form video publisher. */
    async getCurrentShortFormVideoPublisher(): Promise<
        ShortFormVideoPublisher | undefined
    > {
        const service = this.currentPluginRuntime?.capabilities.get(
            SHORT_FORM_PUBLISHER_CAPABILITY,
        );
        return service
            ? service.getPublisher()
            : this.currentProvider?.getShortFormVideoPublisher();
    }

    /**
     * Applies saved settings to the activation that was current when this request began.
     *
     * @returns A promise fulfilled after in-place settings/Plugin synchronization or a required reload.
     * @remarks Runs through the transition queue and ignores the request if its captured
     * activation is no longer current. Settings that require reload recreate the Provider
     * and restore its previous HTTP(S) address. Other settings are passed to the current
     * Provider and Plugin runtime. Errors propagate; this method does not persist the draft.
     */
    async applyCurrentProviderSettings(): Promise<void> {
        const provider = this.currentProvider;
        const siteId = this.currentSiteId;
        if (!provider || !siteId) return;
        await this.runSiteTransition(async () => {
            // A queued save must never resurrect a Provider that the user left.
            if (
                this.currentProvider !== provider ||
                this.currentSiteId !== siteId
            )
                return;
            const settings = this.getProviderSettings(siteId);
            const registration = this.sites.get(siteId);
            if (
                registration &&
                requiresProviderReload(
                    registration.metadata,
                    this.currentProviderSettings,
                    settings,
                )
            ) {
                const address = this.getCurrentAddress();
                await this.loadSite(siteId);
                if (address && /^https?:\/\//i.test(address)) {
                    try {
                        await this.currentProviderContext().viewer.loadURL(
                            address,
                        );
                    } catch (error) {
                        if (!isNavigationAborted(error)) throw error;
                    }
                }
                return;
            }
            await provider.onSettingsChanged(settings);
            await this.currentPluginRuntime?.sync(
                this.pluginsFor(siteId),
                settings,
            );
            this.currentProviderSettings = settings;
        });
    }

    /** Performs the refresh current browser profile operation. */
    async refreshCurrentBrowserProfile(): Promise<boolean> {
        const siteId = this.currentSiteId;
        if (!siteId) return false;
        const registration = this.sites.get(siteId);
        if (!registration) return false;
        const next = this.resolveBrowserProfile(registration);
        if (next.partition === this.currentRuntime?.partition) return false;
        await this.load(siteId);
        return true;
    }

    /** Resolves the browser profile data target. */
    resolveBrowserProfileDataTarget(
        profileId: string,
    ): BrowserDataTarget | undefined {
        const profile = this.findBrowserProfile(
            profileId,
            this.getPreferences(),
        );
        if (!profile) return undefined;
        const runtime = createSharedRuntime('', profile);
        return {
            /** The ID value. */
            id: profile.id,
            /** The name value. */
            name: profile.name,
            /** The partition value. */
            partition: runtime.partition,
        };
    }

    /** Resolves the isolated site data target. */
    resolveIsolatedSiteDataTarget(
        siteId: string,
    ): BrowserDataTarget | undefined {
        const registration = this.sites.get(siteId);
        if (!registration) return undefined;
        const runtime = this.resolveBrowserProfile(registration);
        if (runtime.id !== `isolated:${siteId}`) return undefined;
        return {
            /** The ID value. */
            id: siteId,
            /** The name value. */
            name: registration.metadata.title,
            /** The partition value. */
            partition: runtime.partition,
        };
    }

    /** Lists known partitions without activating their Providers. */
    listBrowserDataPartitions(): string[] {
        return listProviderBrowserDataPartitions(
            this.sites.values(),
            this.getPreferences(),
            this.pluginBrowserProfiles,
        );
    }

    /**
     * Runs a storage operation with any Provider using that partition temporarily unloaded.
     *
     * @param partition - Exact Electron partition identifier to suspend.
     * @param operation - Asynchronous storage operation, invoked after relevant teardown and cleanup.
     * @returns The operation's result after the previously active Provider has been reloaded, if needed.
     * @remarks Holds the site transition queue. Reload is attempted in finally even when
     * operation rejects. If reload itself fails, that failure can replace the operation error.
     * The operation must not await another queued transition on this manager.
     */
    async withPartitionSuspended<T>(
        partition: string,
        operation: () => Promise<T>,
    ): Promise<T> {
        return this.runSiteTransition(async () => {
            const siteId =
                this.currentRuntime?.partition === partition
                    ? this.currentSiteId
                    : undefined;
            if (siteId) await this.unloadCurrent();
            await this.drainRetiredSiteCleanups();
            try {
                return await operation();
            } finally {
                if (siteId) await this.loadSite(siteId);
            }
        });
    }

    /** Resolves the new window policy. */
    resolveNewWindowPolicy(url: string): NewWindowPolicy {
        if (!this.currentProviderHasPermission('navigation')) return 'deny';
        return this.currentProvider?.onNewWindow(url) ?? 'deny';
    }

    /** Handles the action. */
    async handleAction(action: string): Promise<boolean> {
        const provider = this.currentProvider;
        if (await this.currentPluginRuntime?.handleAction(action)) return true;
        return (await provider?.onAction(action)) ?? false;
    }

    /** Returns the provider settings. */
    private getProviderSettings(providerId: string): ProviderSettings {
        return {
            ...(this.getPreferences().providerSettings?.[providerId] ?? {}),
        };
    }

    /** Performs the allow navigation operation. */
    allowNavigation(url: string): boolean {
        if (!this.currentProviderHasPermission('navigation')) return false;
        return this.currentProvider?.allowNavigation(url) ?? false;
    }

    /**
     * Resolves input against the hosts declared by all registered Providers.
     *
     * @param value - User address or supported application open URL.
     * @returns The matching Provider and normalized HTTPS address, or undefined if invalid/unmatched.
     * @remarks This is a pure lookup through resolveProviderAddress(); it neither navigates
     * nor activates the selected Provider.
     */
    resolveAddress(value: string): ResolvedSiteAddress | undefined {
        return resolveProviderAddress(value, this.sites.values());
    }

    /** Performs the transform request operation. */
    transformRequest(
        details: SiteRequestDetails,
    ): SiteRequestRedirect | undefined {
        if (!this.currentProviderHasPermission('network-interception'))
            return undefined;
        const base = this.currentProvider?.onBeforeRequest(details);
        return (
            this.currentPluginRuntime?.transformRequest(details, base) ?? base
        );
    }

    /** Performs the allow picture in picture operation. */
    allowPictureInPicture(url: string): boolean {
        const registration = this.currentSiteId
            ? this.sites.get(this.currentSiteId)
            : undefined;
        if (registration?.metadata.pictureInPicture?.enabled !== true)
            return false;
        return this.currentProvider?.allowPictureInPicture(url) ?? false;
    }

    /** Returns the picture in picture content overlay selectors. */
    getPictureInPictureContentOverlaySelectors(): readonly string[] {
        if (!this.currentSiteId) return [];
        return resolvePictureInPictureOverlaySelectors(
            this.sites.get(this.currentSiteId)?.metadata.pictureInPicture
                ?.contentOverlaySelectors ?? [],
        );
    }

    /** Resolve Provider behavior while preserving the existing page permission boundary. */
    createPictureInPictureSubtitleController(
        session: ProviderPictureInPictureSession,
    ):
        | PictureInPictureSubtitleController
        | undefined
        | Promise<PictureInPictureSubtitleController | undefined> {
        return createProviderPictureInPictureSubtitleController(
            this.currentProvider,
            session,
            this.currentProviderHasPermission('script-injection'),
        );
    }

    /** Performs the transform request headers operation. */
    transformRequestHeaders(
        details: SiteRequestDetails,
    ): SiteRequestHeaders | undefined {
        const transformed = this.currentProviderHasPermission(
            'network-interception',
        )
            ? this.currentProvider?.onBeforeSendHeaders(details)
            : undefined;
        const locale = this.currentLocale?.site;
        if (!locale || locale === 'system' || locale === 'inherit') {
            return transformed;
        }

        const headers = { ...(transformed ?? details.requestHeaders) };
        setHeader(headers, 'Accept-Language', createAcceptLanguage(locale));
        return headers;
    }

    /** Determines whether the unnamed declaration condition applies. */
    has(id: string): boolean {
        return this.sites.has(id);
    }

    /** Performs the current provider has permission operation. */
    private currentProviderHasPermission(permission: SitePermission): boolean {
        if (!this.currentSiteId) return false;
        return (
            this.sites
                .get(this.currentSiteId)
                ?.metadata.permissions?.includes(permission) === true
        );
    }

    /** Releases the operation. */
    async dispose(): Promise<void> {
        await this.runSiteTransition(() => this.unloadCurrent());
    }

    /** Runs a site transition after every previously requested transition. */
    private runSiteTransition<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.siteTransition.then(operation, operation);
        this.siteTransition = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    }

    /** Performs the activate plugins operation. */
    private async activatePlugins(
        registration: RegisteredProvider,
    ): Promise<void> {
        await this.currentPluginRuntime?.sync(
            this.pluginsFor(registration.metadata.id),
            this.currentProviderSettings,
        );
    }

    /** All attached Plugins use the same physical/declared scope resolution. */
    private pluginsFor(providerId: string): RegisteredRuntimePlugin[] {
        return [...this.runtimePlugins.values()].filter((plugin) =>
            pluginMatchesProvider(plugin, providerId),
        );
    }

    /** Performs the unload current operation. */
    private async unloadCurrent(): Promise<void> {
        await this.retireCurrent();
        await this.drainRetiredSiteCleanups();
    }

    /** Releases app-owned policy authority immediately, then retires captured instances. */
    private retireCurrent(): Promise<void> {
        const provider = this.currentProvider;
        const pluginCleanup = this.currentPluginRuntime?.retire();
        this.currentPluginRuntime = undefined;
        const context = this.activeContext;
        const pipeline = this.currentPagePipeline;
        const retireContext = this.currentContextRetirement;
        this.currentContextRetirement = undefined;
        this.currentPagePipeline = undefined;
        this.currentProvider = undefined;
        this.currentProviderSettings = {};
        this.currentSiteId = undefined;
        this.currentLocale = undefined;
        this.currentRuntime = undefined;
        this.activeContext = undefined;
        this.disposeCurrentPagePolicy();
        this.disposeCurrentRuntimeServices();
        try {
            pipeline?.dispose();
        } catch (error) {
            console.error('Retired page pipeline disposal failed.', error);
        }
        if (!provider && !context && !pluginCleanup) return Promise.resolve();
        let loginClose: Promise<void>;
        try {
            loginClose =
                retireContext?.() ??
                context?.externalBrowser.close() ??
                Promise.resolve();
        } catch (error) {
            loginClose = Promise.reject(error);
        }
        void loginClose.catch(() => undefined);
        // Defer Plugin/Provider hooks until after the native handoff can start.
        const cleanup = Promise.resolve().then(async () => {
            await pluginCleanup;
            try {
                await provider?.unload();
            } catch (error) {
                console.error('Retired Provider unload failed.', error);
            }
            try {
                await loginClose;
            } catch (error) {
                console.error('Retired external login cleanup failed.', error);
            }
        });
        this.retiredSiteCleanups.add(cleanup);
        void cleanup.then(() => this.retiredSiteCleanups.delete(cleanup));
        return cleanup;
    }

    /** Shutdown, Bundle removal, and storage resets still require complete cleanup. */
    private async drainRetiredSiteCleanups(): Promise<void> {
        await Promise.all([...this.retiredSiteCleanups]);
    }

    /** Retains the browser identity subscription for the current activation. */
    private installBrowserIdentity(
        context: SiteContext,
        metadata: ProviderMetadata,
    ): void {
        const disposable = installProviderBrowserIdentity(context, metadata);
        if (disposable) this.currentRuntimeDisposables.push(disposable);
    }

    /** Releases the current runtime services. */
    private disposeCurrentRuntimeServices(): void {
        for (const disposable of this.currentRuntimeDisposables
            .splice(0)
            .reverse()) {
            try {
                disposable.dispose();
            } catch (error) {
                console.error('Retired browser policy disposal failed.', error);
            }
        }
    }

    /** Replaces the activation-owned page policy and returns its refresh operation. */
    private installPagePictureInPicturePolicy(
        context: SiteContext,
        metadata: ProviderMetadata,
    ): () => Promise<void> {
        this.disposeCurrentPagePolicy();
        const policy = installProviderPictureInPicturePolicy(context, metadata);
        if (policy.disposable)
            this.currentPagePolicyDisposables.push(policy.disposable);
        return policy.refresh;
    }

    /** Releases the current page policy. */
    private disposeCurrentPagePolicy(): void {
        for (const disposable of this.currentPagePolicyDisposables.splice(0)) {
            try {
                disposable.dispose();
            } catch (error) {
                console.error('Retired page policy disposal failed.', error);
            }
        }
    }

    /** Selects the runtime using current preferences and registered profiles. */
    private resolveBrowserProfile(
        registration: RegisteredProvider,
    ): SiteRuntimeProfile {
        return resolveProviderBrowserProfile(
            registration,
            this.getPreferences(),
            this.pluginBrowserProfiles,
        );
    }

    /** Resolves a profile from the current registry. */
    private findBrowserProfile(
        id: string,
        preferences: PreferenceState,
    ): BrowserProfileInfo | undefined {
        return findBrowserProfile(id, preferences, this.pluginBrowserProfiles);
    }

    /** Whether the active context option is enabled. */
    private activeContext?: SiteContext;

    /** Performs the current provider context operation. */
    private currentProviderContext(): SiteContext {
        if (!this.activeContext) throw new Error('No active site context.');
        return this.activeContext;
    }

    /** Resolves locale choices from the current preference and Bundle declarations. */
    private resolveLocales(
        registration: RegisteredProvider,
    ): SiteLocaleContext {
        return resolveProviderLocales(
            this.getPreferences().appLocale,
            registration.metadata,
            this.bundles.get(registration.bundleId)?.definition,
        );
    }
}
