import { BrowserWindow, ipcMain } from 'electron';
import { KAWAI_API_LITERAL } from '../definitions/api';
import { global_object } from '../data/context';
import { set_config } from '../logics/configures';
import { KawaiConfig } from '../definitions/setting_types';
import { KawaiWindowManager } from '../manager/window_manager';
import { KawaiSiteDescriptorManager } from '../definitions/SiteDescriptor';
import { LocaleManager } from '../manager/lcoale_manager';
import { MenuManager } from '../manager/menu_manager';
import path from 'node:path';
import { project_root } from './constants';
import fs from 'node:fs';
import { flog, log } from '../logging/logger';

/**
 *
 * global event loop initilaize.
 */
export function connectAppHandler() {}

/**
 *
 * @param
 */
export function connectMainWindowHandler() {
    // global_object?.mainWindow?.webContents.on(
    //     'before-input-event',
    //     (event: Electron.Event, input: Electron.Input) => {
    //         flog.debug(input);
    //         if(input.type === "keyUp"){
    //             event.preventDefault()
    //         }
    //         log.debug(input)
    //         if (input.key.toLowerCase() === 'tab') {
    //                 log.debug(typeof global_object.menu);
    //                 if (typeof global_object.menu === 'undefined') {
    //                         log.debug('menu open');
    //                         MenuManager.getInstance().openMenu();
    //                     }
    //                 }
    //     },
    // );
}

/**
 * this function is add global event handler.
 */
export function connectMainProcessHandler() {
    ipcMain.handle(KAWAI_API_LITERAL.input.keydown, (...args: any[]) => {
        const new_conf = args;
        flog.info(new_conf);
        flog.info('fdisofidso');
        // // if (new_conf.key.toLowerCase() === 'tab') {
        //     log.debug(typeof global_object.menu);
        //     if (typeof global_object.menu === 'undefined') {
        //             log.debug('menu open');
        //             MenuManager.getInstance().openMenu();
        //         }
        //     }
        // flog.debug('');
        return true;
    });

    ipcMain.on(
        KAWAI_API_LITERAL.input.keydown,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            const new_conf = args[0] as KeyboardEvent;
            flog.debug('');
        },
    );
    ipcMain.on(
        KAWAI_API_LITERAL.preference.apply_modified_preference,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            const new_conf = args[0] as KawaiConfig;
            flog.debug('');
            set_config(new_conf);
            return global_object.config;
        },
    );

    ipcMain.on(
        KAWAI_API_LITERAL.preference.close,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            global_object.preferenceWindow?.close();
        },
    );

    ipcMain.on(
        KAWAI_API_LITERAL.preference.load_config,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            return global_object.config!.preference;
        },
    );

    ipcMain.on(
        KAWAI_API_LITERAL.preference.load_available_locale_list,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            return LocaleManager.getInstance().getLocaleMetas();
        },
    );

    ipcMain.on(
        KAWAI_API_LITERAL.preference.load_available_monitor_list,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            return KawaiWindowManager.getInstance().getMonitorNames();
        },
    );

    ipcMain.on(
        KAWAI_API_LITERAL.preference.load_available_site_list,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            return KawaiSiteDescriptorManager.getInstance();
        },
    );

    ipcMain.on(
        KAWAI_API_LITERAL.preference.load_available_window_size_list,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            return KawaiWindowManager.getInstance().getPresetSize();
        },
    );

    ipcMain.on(
        KAWAI_API_LITERAL.preference.load_locale,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            return global_object.locale;
        },
    );

    ipcMain.on(
        KAWAI_API_LITERAL.preference.save_and_close,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            const config: KawaiConfig = args[0] as KawaiConfig;
            set_config(config);
            global_object.preferenceWindow?.close();
        },
    );
}
