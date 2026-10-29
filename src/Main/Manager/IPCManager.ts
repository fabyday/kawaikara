import { connectDistributionIpc } from '../Functional/IPC/DistributionIpc';
import type { ExternalAppManager } from './ExternalAppManager';
import { connectExternalAppsIpc } from '../Functional/IPC/ExternalAppsIpc';
import { connectApplicationIpc } from '../Functional/IPC/ApplicationIpc';
import { connectBundlesIpc } from '../Functional/IPC/BundlesIpc';
import { connectDataIpc } from '../Functional/IPC/DataIpc';
import { connectProviderActionsIpc } from '../Functional/IPC/ProviderActionsIpc';
import {
    disposeIpcBindings,
    type DisposeIpc,
} from '../Functional/IPC/IpcBindings';
import { connectLogsIpc } from '../Functional/IPC/LogsIpc';
import { connectPreferencesIpc } from '../Functional/IPC/PreferencesIpc';
import { connectProviderIpc } from '../Functional/IPC/ProviderIpc';
import { connectSocialIpc } from '../Functional/IPC/SocialIpc';
import { connectUpdatesIpc } from '../Functional/IPC/UpdatesIpc';
import { connectVideoIpc } from '../Functional/IPC/VideoIpc';
import { connectWebExtensionIpc } from '../Functional/IPC/WebExtensionIpc';
import { connectWindowIpc } from '../Functional/IPC/WindowIpc';
import { type ViewerRuntime } from '../Functional/Viewer/ViewerRuntime';
import type { ApplicationDataManager } from './ApplicationDataManager';
import type { BundleDevelopmentManager } from './BundleDevelopmentManager';
import type { BundleManager } from './BundleManager';
import type { LoggingManager } from './LoggingManager';
import type { PreferenceManager } from './PreferenceManager';
import type { ProviderManager } from './ProviderManager';
import type { ShortcutManager } from './ShortcutManager';
import type { SocialManager } from './SocialManager';
import type { UpdateManager } from './UpdateManager';
import type { VideoLibraryManager } from './VideoLibraryManager';
import type { WebExtensionManager } from './WebExtensionManager';

/** Explicit composition and lifetime owner for feature-specific IPC connections. */
export class IpcManager {
    /** Successfully connected features, disposed in reverse order. */
    private readonly connections: DisposeIpc[] = [];
    /** Optional bridge resolved lazily by the WebExtension connection. */
    private webExtension?: WebExtensionManager;

    /** Receives app-scoped services without owning their lifetimes. */
    constructor(
        /** The bundles value. */
        private readonly bundles: BundleManager,
        /** The sites value. */
        private readonly sites: ProviderManager,
        /** The Windows value. */
        private readonly viewerRuntime: ViewerRuntime,
        /** The preferences value. */
        private readonly preferences: PreferenceManager,
        /** Shared social actions. */
        private readonly social: SocialManager,
        /** The updates value. */
        private readonly updates: UpdateManager,
        /** The shortcuts value. */
        private readonly shortcuts: ShortcutManager,
        /** The video library value. */
        private readonly videoLibrary: VideoLibraryManager,
        /** The logging value. */
        private readonly logging: LoggingManager,
        /** The data value. */
        private readonly data: ApplicationDataManager,
        /** The development value. */
        private readonly development: BundleDevelopmentManager,
        /** External adapter registration authority, never exposed to site frames. */
        private readonly externalApps?: ExternalAppManager,
    ) {}

    /** Supplies the browser bridge before or after IPC registration. */
    setWebExtensionManager(manager: WebExtensionManager): void {
        this.webExtension = manager;
    }

    /** Connects each feature once; a partial failure rolls back earlier groups. */
    initialize(): void {
        if (this.connections.length) return;
        try {
            this.connections.push(
                connectApplicationIpc({
                    logging: this.logging,
                    data: this.data,
                    preferences: this.preferences,
                }),
            );
            this.connections.push(
                connectWindowIpc({
                    viewerRuntime: this.viewerRuntime,
                    updates: this.updates,
                }),
            );
            this.connections.push(
                connectProviderIpc({
                    sites: this.sites,
                    viewerRuntime: this.viewerRuntime,
                }),
            );
            this.connections.push(
                connectSocialIpc({
                    social: this.social,
                }),
            );
            this.connections.push(
                connectUpdatesIpc({
                    updates: this.updates,
                }),
            );
            this.connections.push(
                connectLogsIpc({
                    logging: this.logging,
                    viewerRuntime: this.viewerRuntime,
                    preferences: this.preferences,
                }),
            );
            this.connections.push(
                connectBundlesIpc({
                    bundles: this.bundles,
                    sites: this.sites,
                    development: this.development,
                    viewerRuntime: this.viewerRuntime,
                }),
            );
            this.connections.push(
                connectVideoIpc({
                    viewerRuntime: this.viewerRuntime,
                    sites: this.sites,
                    videoLibrary: this.videoLibrary,
                    preferences: this.preferences,
                }),
            );
            this.connections.push(connectDistributionIpc(() => this.preferences.get().appLocale));
            if (this.externalApps) this.connections.push(connectExternalAppsIpc(this.externalApps, this.sites));
            this.connections.push(
                connectProviderActionsIpc({
                    viewerRuntime: this.viewerRuntime,
                    sites: this.sites,
                }),
            );
            this.connections.push(
                connectDataIpc({
                    data: this.data,
                    updates: this.updates,
                }),
            );
            this.connections.push(
                connectPreferencesIpc({
                    preferences: this.preferences,
                    viewerRuntime: this.viewerRuntime,
                    logging: this.logging,
                    shortcuts: this.shortcuts,
                    sites: this.sites,
                    updates: this.updates,
                    development: this.development,
                }),
            );
            this.connections.push(
                connectWebExtensionIpc({
                    getWebExtension: () => this.webExtension,
                }),
            );
        } catch (error) {
            try {
                this.dispose();
            } catch (cleanupError) {
                throw new AggregateError(
                    [error, cleanupError],
                    'IPC initialization and rollback failed.',
                );
            }
            throw error;
        }
    }

    /** Releases feature handlers, listeners, subscriptions, and pending timers. */
    dispose(): void {
        disposeIpcBindings(this.connections);
    }
}
