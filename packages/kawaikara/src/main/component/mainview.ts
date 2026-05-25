import {
    BrowserView,
    BrowserWindow,
    app,
    screen,
    session,
    shell,
} from 'electron';

import * as path from 'path';
import * as fs from 'node:fs';
import fetch from 'cross-fetch'; // required 'fetch'
// import isDev from 'electron-is-dev';
import { setup_pogress_bar } from './autoupdater';

import { KawaiWindowManager } from '../manager/window_manager';
import { global_object } from '../data/context';
import { KawaiKeyboardManager } from '../manager/keyboard_manager';
import { flog, select_menu_item_f } from './predefine/api';
import { KawaiViewManager } from '../manager/view_manager';
import { apply_default_main, save_config } from '../logics/configures';
import { resources_root } from './constants';
import { bindInputBlocker } from './input_blocker';

// ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
//     blocker.enableBlockingInSession(session.defaultSession);
// });
// const { ElectronChromeExtensions } = require('electron-chrome-extensions')
// ElectronChromeExtensions

// about chrome extension installation
// https://stackoverflow.com/questions/75691451/can-i-download-chrome-extension-directly-from-an-electron-webview

function bindWindowsFullscreenFocusGuard(mainView: BrowserWindow) {
    if (process.platform !== 'win32') {
        return;
    }

    let restoreTimer: NodeJS.Timeout | null = null;
    const clearRestoreTimer = () => {
        if (restoreTimer !== null) {
            clearTimeout(restoreTimer);
            restoreTimer = null;
        }
    };

    mainView.on('blur', () => {
        if (global_object.context?.window_mode !== 'fullscreen') {
            return;
        }

        clearRestoreTimer();
        mainView.setSkipTaskbar(false);
        if (mainView.isFullScreen()) {
            mainView.setFullScreen(false);
            mainView.setFullScreenable(false);
        }
    });

    mainView.on('focus', () => {
        if (global_object.context?.window_mode !== 'fullscreen') {
            return;
        }

        clearRestoreTimer();
        restoreTimer = setTimeout(() => {
            restoreTimer = null;
            if (
                mainView.isDestroyed() ||
                !mainView.isFocused() ||
                global_object.context?.window_mode !== 'fullscreen'
            ) {
                return;
            }

            mainView.setSkipTaskbar(false);
            mainView.setFullScreenable(true);
            mainView.setFullScreen(true);
        }, 160);
    });

    mainView.on('leave-full-screen', () => {
        if (global_object.context?.window_mode !== 'fullscreen') {
            clearRestoreTimer();
        }
        mainView.setSkipTaskbar(false);
    });

    mainView.on('closed', clearRestoreTimer);
}

export const get_mainview_instance = (): BrowserWindow => {
    const min_sizes = KawaiWindowManager.getInstance().getPresetSize()[0];
    const { x, y, width, height } =
        KawaiWindowManager.getInstance().getDefaultWindowSize();
    if (typeof global_object?.mainWindow === 'undefined') {
        const mainView = new BrowserWindow({
            x: x,
            y: y,
            width: width,
            height: height,
            minWidth: min_sizes[0],
            minHeight: min_sizes[1],

            icon: path.join(resources_root, 'icons/kawaikara.ico'),

            webPreferences: {
                preload: path.resolve(__dirname, 'predefine/communicate.js'),
                contextIsolation: true,
                nodeIntegration: false,
                additionalArguments: [`--platform=${process.platform}`],
                sandbox: false,
                backgroundThrottling:
                    !global_object.config?.preference?.general
                        ?.render_full_size_when_pip_running?.value,
            },
        });

        bindInputBlocker(mainView);
        bindWindowsFullscreenFocusGuard(mainView);

        mainView.on('closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
            if (typeof global_object.config !== 'undefined') {
                save_config(global_object.config);
            }
        });
        mainView.setMenu(null);
        KawaiViewManager.getInstance().trackBrowserFocus(mainView);

        mainView.webContents.session.webRequest.onBeforeSendHeaders(
            (details, callback) => {
                try {
                    global_object.context?.current_site_descriptor?.onBeforeSendHeaders(
                        details,
                    );
                } catch (error) {
                    console.error('onBeforeSendHeaders handler failed', error);
                }
                callback({ requestHeaders: details.requestHeaders });
            },
        );

        mainView.webContents.session.webRequest.onBeforeRequest(
            (details, callback) => {
                try {
                    const { cancel, redirectURL } =
                        global_object.context?.current_site_descriptor?.onBeforeRequest(
                            details,
                        ) ?? {};
                    callback({ cancel: cancel, redirectURL: redirectURL });
                } catch (error) {
                    console.error('onBeforeRequest handler failed', error);
                    callback({});
                }
            },
        );

        mainView.setFullScreenable(false);
        setup_pogress_bar(mainView);

        if (process.env.IS_DEV) {
            mainView.webContents.openDevTools({ mode: 'detach' });
        }

        mainView.webContents.on('page-title-updated', () => {
            mainView.setTitle(app.getName());
        });
        (mainView as any).name = 'mainview';
        global_object.mainWindow = mainView;

        apply_default_main(
            global_object?.config?.preference?.general?.default_main?.id?.value,
        );

        mainView.webContents.setWindowOpenHandler(
            (details: Electron.HandlerDetails) => {
                console.log('set on : ', details.url);
                // mainView.loadURL(details.url);s

                const value =
                    global_object.context?.current_site_descriptor?.onNewWindowCreated(
                        details.url,
                    ) ?? 'suppress';

                switch (value) {
                    case 'external': // open url on external brwosers or apps
                        shell.openExternal(details.url);
                        return { action: 'deny' };
                    case 'open': // open it main view
                        mainView.loadURL(details.url);
                        return { action: 'deny' };
                    case 'suppress': //suppress : do nothing
                        return { action: 'deny' };
                    case 'basic': // open url default action in electron.
                        return { action: 'allow' };
                }
            },
        );
        return global_object.mainWindow;
    }
    return global_object!.mainWindow!;
};
