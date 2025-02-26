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
import { ElectronBlocker } from '@cliqz/adblocker-electron';
import fetch from 'cross-fetch'; // required 'fetch'
// import isDev from 'electron-is-dev';
import { setup_pogress_bar } from './autoupdater';

import { KawaiWindowManager } from '../manager/window_manager';
import { global_object } from '../data/context';
import { KawaiKeyboardManager } from '../manager/keyboard_manager';
import { flog, select_menu_item_f } from './predefine/api';
import { KawaiViewManager } from '../manager/view_manager';
import { apply_default_main, save_config } from '../logics/configures';

// ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
//     blocker.enableBlockingInSession(session.defaultSession);
// });
// const { ElectronChromeExtensions } = require('electron-chrome-extensions')
// ElectronChromeExtensions

// about chrome extension installation
// https://stackoverflow.com/questions/75691451/can-i-download-chrome-extension-directly-from-an-electron-webview

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

            icon: path.join(__dirname, '../../resources/icons/kawaikara.ico'),

            webPreferences: {
                preload: path.resolve(__dirname, 'predefine/communicate.js'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
                // preload: path.join(__dirname, 'predefine/communicate.js'),
                backgroundThrottling:
                    !global_object.config?.preference?.general
                        ?.render_full_size_when_pip_running?.value,
            },
        });

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
                // details.requestHeaders['Sec-Ch-Ua'] =
                //     '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
                // details.requestHeaders['User-Agent'] =
                //     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
                // console.log("test detua", details)
                if (
                    typeof global_object.context?.current_site_descriptor !==
                    'undefined'
                ) {
                    global_object.context?.current_site_descriptor.onBeforeSendHeaders(
                        details,
                    );
                }
                callback({ requestHeaders: details.requestHeaders });
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

        return global_object.mainWindow;
    }
    return global_object!.mainWindow!;
};
