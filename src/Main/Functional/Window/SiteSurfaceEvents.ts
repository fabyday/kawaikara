import { ownEventConnections } from './EventConnections';
import type { NewWindowPolicy, SiteLogger } from '@kawaikara/site-api';
import type { BrowserWindow, Session, WebContents } from 'electron';
import { openInDefaultBrowser } from '../../Platform/DefaultBrowser';

/** Provider policies and state transitions needed by site event adapters. */
export interface SiteSurfaceEvents {
    /** Prevents inactive retained sites from issuing application actions. */
    isCurrent(): boolean;
    /** Resolves the native parent for a permitted popup. */
    getViewer(): BrowserWindow | undefined;
    /** Reveals the active site once its document is ready. */
    ready(): void;
    /** Applies the current application theme to site and popup documents. */
    applyTheme(contents: WebContents): void;
    /** Refreshes retained compositor geometry without reloading media. */
    refreshSurface(reason: string): void;
    /** Parses only the application-owned Provider action scheme. */
    parseAction(url: string): string | undefined;
    /** Dispatches a Provider action to the configured handler. */
    dispatchAction(action: string): void;
    /** Evaluates the currently configured Provider navigation policy. */
    allowNavigation(url: string): boolean;
    /** Evaluates the currently configured popup policy. */
    resolveWindowPolicy(url: string): NewWindowPolicy;
    /** Applies PiP policy to committed main-frame navigation. */
    navigated(url: string): void;
    /** Clears transient editor focus state. */
    clearEditing(): void;
    /** Restores the application title instead of a remote document title. */
    titleChanged(): void;
    /** Tracks and configures developer tools. */
    devToolsChanged(open: boolean): void;
    /** Tracks native popups for application shutdown. */
    popupOpened(popup: BrowserWindow): void;
    /** Removes a closed popup from application state. */
    popupClosed(popup: BrowserWindow): void;
    /** Reports load failures and policy decisions. */
    logger: Pick<SiteLogger, 'debug' | 'warn' | 'error'>;
}

/** Defines the shared remote scrollbar CSS constant. */
const REMOTE_SCROLLBAR_CSS = `
  :root {
    scrollbar-color: transparent transparent !important;
    scrollbar-width: auto !important;
  }
  *::-webkit-scrollbar {
    width: 12px !important;
    height: 12px !important;
  }
  *::-webkit-scrollbar-track {
    background: transparent !important;
  }
  *::-webkit-scrollbar-button,
  *::-webkit-scrollbar-button:single-button {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    -webkit-appearance: none !important;
    background: transparent !important;
  }
  *::-webkit-scrollbar-corner {
    background: transparent !important;
  }
  *::-webkit-scrollbar-thumb {
    border: 2px solid transparent !important;
    border-radius: 999px !important;
    background: transparent !important;
    background-clip: padding-box !important;
    transition: background-color 180ms ease !important;
  }
  html[data-kawaikara-scrolling="true"] {
    scrollbar-color: rgb(161 161 170 / 58%) transparent !important;
  }
  html[data-kawaikara-scrolling="true"]::-webkit-scrollbar-thumb,
  html[data-kawaikara-scrolling="true"] *::-webkit-scrollbar-thumb {
    background-color: rgb(161 161 170 / 58%) !important;
  }
`;

/** Connects remote renderer lifecycle and navigation while preserving Provider policies. */
export function bindSiteSurfaceEvents(
    webContents: WebContents,
    siteSession: Session,
    events: SiteSurfaceEvents,
): () => void {
    let connected = true;
    const dispose = ownEventConnections(webContents, 'destroyed', () => {
        webContents.on('dom-ready', () => {
            events.ready();
            events.applyTheme(webContents);
            void webContents
                .insertCSS(REMOTE_SCROLLBAR_CSS, { cssOrigin: 'user' })
                .catch((error: unknown) => {
                    events.logger.debug(
                        'The site scrollbar theme could not be applied.',
                        error,
                    );
                });
            events.refreshSurface('dom-ready');
        });
        webContents.on('did-finish-load', () =>
            events.refreshSurface('did-finish-load'),
        );
        webContents.on('media-started-playing', () =>
            events.refreshSurface('media-started-playing'),
        );
        webContents.on(
            'did-fail-load',
            (
                _event,
                errorCode,
                errorDescription,
                validatedURL,
                isMainFrame,
            ) => {
                if (!isMainFrame || errorCode === -3) return;
                events.logger.warn('Site main-frame load failed.', {
                    errorCode,
                    errorDescription,
                    url: validatedURL,
                });
            },
        );
        webContents.on('render-process-gone', (_event, details) => {
            events.logger.error('Site renderer process exited.', details);
            if (details.reason === 'clean-exit' || webContents.isDestroyed())
                return;
            setTimeout(() => {
                if (!webContents.isDestroyed()) webContents.reload();
            }, 500);
        });
        /** Performs the guard navigation operation. */
        const guardNavigation = (event: Electron.Event, url: string): void => {
            if (!events.isCurrent()) {
                event.preventDefault();
                return;
            }
            const action = events.parseAction(url);
            if (action !== undefined) {
                event.preventDefault();
                events.dispatchAction(action);
                return;
            }
            if (!events.allowNavigation(url)) {
                event.preventDefault();
                events.logger.debug(`Blocked guarded site navigation: ${url}`);
            }
        };
        webContents.on('will-navigate', guardNavigation);
        webContents.on('will-redirect', guardNavigation);
        webContents.on('will-frame-navigate', (details) => {
            if (!events.isCurrent()) return;
            // Provider action URLs may originate in a cross-origin media iframe
            // (for example CHZZK's m.naver.com Shorts carousel). Only intercept the
            // application-owned scheme here; ordinary subframe navigation remains
            // outside the main-frame navigation guard.
            const action = events.parseAction(details.url);
            if (action === undefined) return;
            details.preventDefault();
            events.dispatchAction(action);
        });
        webContents.on('did-start-loading', () => {
            events.clearEditing();
        });
        webContents.on('did-navigate', (_event, url) => {
            events.navigated(url);
        });
        webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
            if (isMainFrame) events.navigated(url);
        });
        webContents.on('page-title-updated', (event) => {
            event.preventDefault();
            if (events.isCurrent()) events.titleChanged();
        });
        webContents.on('destroyed', () => {
            events.clearEditing();
        });
        webContents.on('devtools-opened', () => events.devToolsChanged(true));
        webContents.on('devtools-closed', () => events.devToolsChanged(false));

        webContents.setWindowOpenHandler(({ url }) => {
            if (!connected || !events.isCurrent()) return { action: 'deny' };
            const action = events.parseAction(url);
            if (action !== undefined) {
                events.dispatchAction(action);
                return { action: 'deny' };
            }
            if (!events.allowNavigation(url)) {
                events.logger.debug(`Blocked guarded site window open: ${url}`);
                return { action: 'deny' };
            }

            const policy = events.resolveWindowPolicy(url);
            switch (policy) {
                case 'external':
                    void openInDefaultBrowser(url).catch((error: unknown) => {
                        events.logger.error(
                            `Failed to open ${url} in the default browser.`,
                            error,
                        );
                    });
                    return { action: 'deny' };
                case 'viewer':
                    void webContents.loadURL(url).catch((error: unknown) => {
                        events.logger.error(
                            `Failed to open ${url} in the site viewer.`,
                            error,
                        );
                    });
                    return { action: 'deny' };
                case 'deny':
                    return { action: 'deny' };
                case 'popup':
                    return {
                        action: 'allow',
                        overrideBrowserWindowOptions: {
                            parent: events.getViewer(),
                            autoHideMenuBar: true,
                            backgroundColor: '#ffffff',
                            webPreferences: {
                                session: siteSession,
                                contextIsolation: true,
                                nodeIntegration: false,
                                sandbox: true,
                            },
                        },
                    };
                case 'default':
                    return { action: 'allow' };
            }
        });

        webContents.on('did-create-window', (popupWindow) => {
            if (!events.isCurrent()) {
                popupWindow.destroy();
                return;
            }
            events.popupOpened(popupWindow);
            // A site-specific browser UA must also be visible to popup JavaScript.
            // Session request interception covers the initial navigation headers.
            popupWindow.webContents.setUserAgent(webContents.getUserAgent());
            popupWindow.webContents.on('dom-ready', () => {
                events.applyTheme(popupWindow.webContents);
            });
            events.applyTheme(popupWindow.webContents);
            popupWindow.setMenuBarVisibility(false);
            popupWindow.on('closed', () => {
                events.popupClosed(popupWindow);
            });
        });
    });
    return () => {
        connected = false;
        dispose();
    };
}
