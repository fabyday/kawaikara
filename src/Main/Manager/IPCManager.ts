import type { LoggingManager } from './LoggingManager';
import type { ApplicationDataManager } from './ApplicationDataManager';
import type { PreferenceManager } from './PreferenceManager';
import type { WindowManager } from './WindowManager';
import type { UpdateManager } from './UpdateManager';
import type { ProviderManager } from './ProviderManager';
import type { SocialManager } from './SocialManager';
import type { BundleManager } from './BundleManager';
import type { BundleDevelopmentManager } from './BundleDevelopmentManager';
import type { VideoLibraryManager } from './VideoLibraryManager';
import type { ExternalDownloaderManager } from './ExternalDownloaderManager';
import type { ShortcutManager } from './ShortcutManager';
import type { WebExtensionManager } from './WebExtensionManager';
import { connectApplicationIpc } from '../Functional/IPC/ApplicationIpc';
import { connectWindowIpc } from '../Functional/IPC/WindowIpc';
import { connectProviderIpc } from '../Functional/IPC/ProviderIpc';
import { connectSocialIpc } from '../Functional/IPC/SocialIpc';
import { connectUpdatesIpc } from '../Functional/IPC/UpdatesIpc';
import { connectLogsIpc } from '../Functional/IPC/LogsIpc';
import { connectBundlesIpc } from '../Functional/IPC/BundlesIpc';
import { connectVideoIpc } from '../Functional/IPC/VideoIpc';
import { connectDownloadsIpc } from '../Functional/IPC/DownloadsIpc';
import { connectDataIpc } from '../Functional/IPC/DataIpc';
import { connectPreferencesIpc } from '../Functional/IPC/PreferencesIpc';
import { connectWebExtensionIpc } from '../Functional/IPC/WebExtensionIpc';
import { disposeIpcBindings, type DisposeIpc } from '../Functional/IPC/IpcBindings';

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
        private readonly windows: WindowManager,
        /** The preferences value. */
        private readonly preferences: PreferenceManager,
        /** The downloads value. */
        private readonly downloads: ExternalDownloaderManager,
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
    ) {}

    /** Supplies the browser bridge before or after IPC registration. */
    setWebExtensionManager(manager: WebExtensionManager): void {
        this.webExtension = manager;
    }

    /** Connects each feature once; a partial failure rolls back earlier groups. */
    initialize(): void {
        if (this.connections.length) return;
        try {
            this.connections.push(connectApplicationIpc({
                logging: this.logging,
                data: this.data,
                preferences: this.preferences,
            }));
            this.connections.push(connectWindowIpc({
                windows: this.windows,
                updates: this.updates,
            }));
            this.connections.push(connectProviderIpc({
                sites: this.sites,
                windows: this.windows,
            }));
            this.connections.push(connectSocialIpc({
                social: this.social,
            }));
            this.connections.push(connectUpdatesIpc({
                updates: this.updates,
            }));
            this.connections.push(connectLogsIpc({
                logging: this.logging,
                windows: this.windows,
                preferences: this.preferences,
            }));
            this.connections.push(connectBundlesIpc({
                bundles: this.bundles,
                sites: this.sites,
                development: this.development,
                windows: this.windows,
            }));
            this.connections.push(connectVideoIpc({
                windows: this.windows,
                sites: this.sites,
                videoLibrary: this.videoLibrary,
                preferences: this.preferences,
            }));
            this.connections.push(connectDownloadsIpc({
                downloads: this.downloads,
                windows: this.windows,
                sites: this.sites,
            }));
            this.connections.push(connectDataIpc({
                data: this.data,
                updates: this.updates,
            }));
            this.connections.push(connectPreferencesIpc({
                preferences: this.preferences,
                windows: this.windows,
                logging: this.logging,
                shortcuts: this.shortcuts,
                sites: this.sites,
                updates: this.updates,
                development: this.development,
            }));
            this.connections.push(connectWebExtensionIpc({
                getWebExtension: () => this.webExtension,
            }));
        } catch (error) {
            try {
                this.dispose();
            } catch (cleanupError) {
                throw new AggregateError([error, cleanupError], 'IPC initialization and rollback failed.');
            }
            throw error;
        }
    }

    /** Releases feature handlers, listeners, subscriptions, and pending timers. */
    dispose(): void {
        disposeIpcBindings(this.connections);
    }
}
