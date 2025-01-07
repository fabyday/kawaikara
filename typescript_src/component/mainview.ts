import {
    BrowserView,
    BrowserWindow,
    app,
    screen,
    session,
    shell,
} from 'electron';

import * as path from 'path';
import * as fs from 'fs';

import { ElectronBlocker } from '@cliqz/adblocker-electron';
import fetch from 'cross-fetch'; // required 'fetch'
// import isDev from 'electron-is-dev';
import { script_root_path } from './constants';
import { setup_pogress_bar } from './autoupdater';
import { ElectronChromeExtensions } from 'electron-chrome-extensions';
import {
    KawaiConfig,
    KawaiNameProperty,
    KawaiNumberProperty,
} from '../definitions/setting_types';
import { KawaiWindowManager } from '../manager/window_manager';
import { KawaiSiteDescriptorManager } from '../definitions/SiteDescriptor';
import { global_object } from '../data/context';

ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
    blocker.enableBlockingInSession(session.defaultSession);
});
// const { ElectronChromeExtensions } = require('electron-chrome-extensions')
// ElectronChromeExtensions

// about chrome extension installation
// https://stackoverflow.com/questions/75691451/can-i-download-chrome-extension-directly-from-an-electron-webview



export const get_mainview_instance = (): BrowserWindow => {
    const conf = global_object.config;
    let x: number =
        conf?.preference?.general?.window_preference?.window_size?.x?.value ??
        -1;
    let y: number =
        conf?.preference?.general?.window_preference?.window_size?.x?.value ??
        -1;
    let width: number =
        conf?.preference?.general?.window_preference?.window_size?.x?.value ??
        -1;
    let height: number =
        conf?.preference?.general?.window_preference?.window_size?.x?.value ??
        -1;

    if (width === -1 || height === -1) {
        const preset_size: number[][] =
            KawaiWindowManager.getInstance().getPresetSize();
        const length = preset_size.length;
        const [selected_width, selected_height]: number[] =
            length - 2 > 0 ? preset_size[length - 2] : preset_size[length - 1];
        const xy = KawaiWindowManager.getInstance().findCenterCoordByBounds(
            selected_width,
            selected_height,
        );
        x = xy.x;
        y = xy.y;
        width = selected_width;
        height = selected_height;
        conf!.preference = conf?.preference ? conf.preference : {};
        conf!.preference = {
            ...conf?.preference,
            ...{
                general: {
                    window_preference: {
                        window_size: {
                            x: { value: x },
                            y: { value: y },
                            width: { value: selected_width },
                            height: { value: selected_height },
                        },
                    },
                },
            },
        };
    }
    if (typeof global_object?.mainWindow === 'undefined') {
        const mainView = new BrowserWindow({
            x: x,
            y: y,
            width: width,
            height: height,

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
            if (process.platform !== 'darwin') app.quit();
        });
        mainView.setMenu(null);
        // mainView.webContents.session.webRequest.onBeforeSendHeaders(
        //     (details, callback) => {
        //         const context_id: string | undefined =
        //             global_object.context?.current_site_descriptor;
        //         if (typeof context_id === 'string') {
        //             const site_desc =
        //                 KawaiSiteDescriptorManager.getInstance().qeury_site_descriptor_by_name(
        //                     context_id,
        //                 );
        //             if (typeof site_desc !== 'undefined') {
        //                 site_desc.onBeforeSendHeaders(details);
        //                 callback({ requestHeaders: details.requestHeaders });
        //             }
        //         }
        //         // if else do nothing..
        //         // details.requestHeaders['Sec-Ch-Ua'] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"'
        //         // details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        //         // details.requestHeaders['User-Agent'] = 'Chrome' // when we want to login to youtube....
        //     },
        // );

        mainView.setFullScreenable(false);
        setup_pogress_bar(mainView);
        mainView.loadURL('https://chzzk.naver.com/', {
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        });
        mainView.webContents.openDevTools({ mode: 'detach' });

        (mainView as any).name = "mainview"
        global_object.mainWindow = mainView;
        return global_object.mainWindow;
    }
    return global_object!.mainWindow!;
};
