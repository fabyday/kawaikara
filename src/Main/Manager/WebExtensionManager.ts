import { openProviderDownload } from '../Functional/ExternalApps/ProviderDownloads';
import { app, clipboard, dialog, shell } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { AppLocale } from '../../Common/IPC';
import { WebExtensionBridge } from '../Functional/ExternalApps/WebExtensionBridge';
import { getLocaleMessages } from '../Functional/Localization/Locale';
import { type ViewerRuntime } from '../Functional/Viewer/ViewerRuntime';
import {
    listSupportedBrowsers,
    openBrowser,
    openSelectedBrowser,
} from '../Platform/Browsers';
import type { ProviderManager } from './ProviderManager';

/** Connects Provider declarations to browser clients without wrapping Electron in Platform. */
export class WebExtensionManager {
    /** Transport with current catalog and desktop-owned permission decisions. */
    private readonly bridge: WebExtensionBridge;
    /** The pending value. */
    private pending?: {
        /** The ID value. */
        id: string;
        /** The detail value. */
        detail: string;
        /** Callback used to handle resolve. */
        resolve: (approved: boolean) => void;
        /** The timer value. */
        timer: ReturnType<typeof setTimeout>;
    };
    /** Releases catalog observation at shutdown. */
    private readonly unsubscribe: () => void;
    /** Constructs the adapter without starting a listener. */
    constructor(
        statePath: string,
        sites: ProviderManager,
        viewerRuntime: Pick<ViewerRuntime, 'video' | 'viewer'>,
        getLocale: () => AppLocale = () => 'system',
    ) {
        this.bridge = new WebExtensionBridge({
            statePath,
            development: !__KAWAIKARA_DISTRIBUTION_BUILD__,
            pageLabels: () =>
                getLocaleMessages(getLocale(), app.getLocale()).app
                    .webExtension,
            pageImage: async () => {
                const assets = path.join(
                    app.getAppPath(),
                    'dist/renderer/assets',
                );
                const file = (
                    await readdir(assets).catch(() => [] as string[])
                ).find((name) =>
                    /^kawaikara_banner2\.[a-f0-9]+\.png$/.test(name),
                );
                return readFile(
                    file
                        ? path.join(assets, file)
                        : path.join(
                              app.getAppPath(),
                              'imgs/kawaikara_banner2.png',
                          ),
                );
            },
            desktop: {
                name: app.getName(),
                version: app.getVersion(),
                channel: __KAWAIKARA_BUILD_CHANNEL__,
                runtime: app.isPackaged ? 'packaged' : 'development',
                appPath: app.getAppPath(),
                profileId: createHash('sha256')
                    .update(statePath)
                    .digest('hex')
                    .slice(0, 12),
            },
            launchUrl:
                app.isPackaged || process.platform === 'win32'
                    ? 'kawaikara://bridge/wake'
                    : null,
            focus: () => {
                viewerRuntime.viewer.focusViewer();
                app.focus({ steal: true });
            },
            providers: () => sites.listWebExtensionProviders(),
            confirm: (detail) =>
                new Promise<boolean>((resolve) => {
                    this.finishApproval(false);
                    const id = randomUUID();
                    const timer = setTimeout(
                        () => this.finishApproval(false),
                        110_000,
                    );
                    this.pending = { id, detail, resolve, timer };
                    viewerRuntime.viewer.showPreferencesOverlay();
                    app.focus({ steal: true });
                }),
            execute: async (providerId, action, url, settings) => {
                const provider = sites
                    .listWebExtensionProviders()
                    .find((entry) => entry.id === providerId);
                const definition = provider?.actionDefinitions[action];
                if (!definition)
                    throw new Error('Provider browser action is unavailable.');
                if (definition.handler === 'open') {
                    await sites.openUrl(providerId, url);
                    viewerRuntime.viewer.focusViewer();
                } else if (definition.handler === 'download') {
                    await openProviderDownload(
                        sites,
                        viewerRuntime,
                        providerId,
                        url,
                        true,
                    );
                } else if (definition.handler === 'share-link') {
                    const link = new URL('https://kawaikara.github.io/open/');
                    link.searchParams.set('url', url);
                    return { clipboard: link.href };
                } else {
                    return sites.handleWebExtensionAction(providerId, {
                        action,
                        url,
                        settings,
                    });
                }
            },
        });
        this.unsubscribe = sites.subscribeWebExtensions(() => {
            void this.bridge.invalidateCatalog().catch(() => undefined);
        });
    }
    /** Starts the authenticated local adapter. */
    start(): Promise<void> {
        return this.bridge.start();
    }
    /** Starts pairing in the default browser without exposing a code in the renderer. */
    async useExtension(browser?: string, development = false): Promise<void> {
        const url = this.bridge.createConnectionUrl(development);
        if (browser) await openBrowser(browser, url);
        else await shell.openExternal(url);
    }
    /** Lists browsers available for an additional independent connection. */
    browsers() {
        return listSupportedBrowsers();
    }
    /** Lets the user choose a portable or third-party browser without exposing its path to Renderer. */
    async chooseBrowser(development = false): Promise<void> {
        const selection = await dialog.showOpenDialog({
            properties: ['openFile'],
            ...(process.platform === 'darwin'
                ? { filters: [{ name: 'Application', extensions: ['app'] }] }
                : process.platform === 'win32'
                  ? { filters: [{ name: 'Application', extensions: ['exe'] }] }
                  : {}),
        });
        if (!selection.canceled && selection.filePaths[0])
            await openSelectedBrowser(
                selection.filePaths[0],
                this.bridge.createConnectionUrl(development),
            );
    }
    /** Reads safe paired-client metadata. */
    status() {
        return {
            ...this.bridge.connectionStatus(),
            /** The approval value. */
            approval: this.pending
                ? {
                  /** The ID value. */
                  id: this.pending.id,
                  /** The detail value. */
                  detail: this.pending.detail }
                : undefined,
        };
    }
    /** Only trusted settings IPC can answer the current request. */
    decide(id: string, approved: boolean): void {
        if (id !== this.pending?.id)
            throw new Error('Approval request expired.');
        this.finishApproval(approved);
    }
    /** Performs the finish approval operation. */
    private finishApproval(approved: boolean): void {
        const pending = this.pending;
        this.pending = undefined;
        if (pending) {
            clearTimeout(pending.timer);
            pending.resolve(approved);
        }
    }
    /** Selects the extension channel for app-initiated pairing. */
    setDevelopment(value: boolean) {
        return this.bridge.setDevelopment(value);
    }
    /** Transfers a short-lived pairing secret only after a settings action. */
    async copyConnectionCode(): Promise<void> {
        clipboard.writeText(await this.bridge.createConnectionCode());
    }
    /** Removes the browser's authority immediately. */
    revoke(id?: string): Promise<void> {
        this.finishApproval(false);
        return this.bridge.revoke(id);
    }
    /** Releases the listener during application shutdown. */
    dispose(): Promise<void> {
        this.finishApproval(false);
        this.unsubscribe();
        return this.bridge.dispose();
    }
}
