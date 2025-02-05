import { BrowserWindow, ipcMain, app, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Event } from 'electron/main';
import { script_root_path } from './constants';
import { KawaiViewManager } from '../manager/view_manager';

let preferenceWindow: BrowserWindow | null = null;

export const get_preference_instance = (): BrowserWindow => {
    if (preferenceWindow === null) {
        preferenceWindow = new BrowserWindow({
            // width: 600,
            width: 640,
            height: 800,
            minWidth: 640,
            icon: path.join(__dirname, '../../resources/icons/kawaikara.ico'),
            // resizable : false,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,

                preload: path.join(__dirname, 'predefine/communicate.js'),
            },
        });

        preferenceWindow.setMenu(null);
        let html_path = path.resolve(
            script_root_path,
            './pages/preference.html',
        );
        // mainView.loadURL(process.env.IS_DEV?"http://localhost:3000/preference.html" : html_path)

        console.log('process.env.IS_DEV :', process.env.IS_DEV);
        // preferenceWindow.loadURL(process.env.IS_DEV ? "http://localhost:3000/preference.html" : html_path)

        preferenceWindow.on('closed', () => {
            preferenceWindow = null;
        });
        preferenceWindow.loadURL(
            process.env.IS_DEV
                ? 'http://localhost:3000/preference.html'
                : html_path,
        );


        preferenceWindow.webContents.on('did-finish-load', (evt: Event) => {
            if (process.env.IS_DEV) {
                preferenceWindow?.setSize(1200, 600);
                preferenceWindow!.webContents.openDevTools();
            }
            // preferenceWindow!.webContents.send("setup-configure", conf)
        });

        (preferenceWindow as any).name = 'preference';
        KawaiViewManager.getInstance().trackBrowserFocus(preferenceWindow);

    }

    return preferenceWindow;
};
