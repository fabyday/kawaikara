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
import { script_root_path } from './constants';

// ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
//     blocker.enableBlockingInSession(session.defaultSession);
// });
// const { ElectronChromeExtensions } = require('electron-chrome-extensions')
// ElectronChromeExtensions

// about chrome extension installation
// https://stackoverflow.com/questions/75691451/can-i-download-chrome-extension-directly-from-an-electron-webview

export const get_bgtask_view_instnace = (): BrowserWindow => {
    const min_sizes = KawaiWindowManager.getInstance().getPresetSize()[0];
    const { x, y, width, height } =
        KawaiWindowManager.getInstance().getDefaultWindowSize();
    if (typeof global_object?.taskWindow === 'undefined') {
        const taskview = new BrowserWindow({
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
            },
        });

        taskview.setMenu(null);
        KawaiViewManager.getInstance().trackBrowserFocus(taskview);
        let html_path = path.resolve(
            script_root_path,
            './pages/bgtaskview.html',
        );

        taskview.on('closed', () => {
            global_object.taskWindow = undefined;
        });
        taskview.loadURL(
            process.env.IS_DEV
                ? 'http://localhost:3000/bgtaskview.html'
                : html_path,
        );

        taskview.setFullScreenable(false);
        if (process.env.IS_DEV) {
            taskview.webContents.openDevTools({ mode: 'detach' });
        }
        taskview.webContents.on('page-title-updated', () => {
            taskview.setTitle('Kawai Background TaskView');
        });
        (taskview as any).name = 'bg_task_view';
        global_object.taskWindow = taskview;

        // apply_default_main(
        //     global_object?.config?.preference?.general?.default_main?.id?.value,
        // );

        return global_object.taskWindow;
    }
    return global_object!.taskWindow!;
};
