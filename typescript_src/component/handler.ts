import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { KAWAI_API_LITERAL } from '../definitions/api';
import { global_object } from '../data/context';
import { set_config } from '../logics/configures';
import { KawaiConfig } from '../definitions/setting_types';
import { KawaiWindowManager } from '../manager/window_manager';
import { LocaleManager } from '../manager/lcoale_manager';
import { MenuManager } from '../manager/menu_manager';
import { flog, log } from '../logging/logger';
import { KawaiKeyboardManager } from '../manager/keyboard_manager';
import { KawaiKeyEvent } from '../definitions/keyboard';
import { get_preference_instance } from './preference';
import { default_config } from '../definitions/default_preference';
import { KawaiViewManager } from '../manager/view_manager';
import { KawaiSiteDescriptorManager } from '../manager/site_descriptor_manager';

/**
 *
 * global event loop initilaize.
 */
export function connectAppHandler() {}

/**
 *
 * @param
 */
export function connectMainWindowHandler() {}

/**
 * this function is add global event handler.
 */
export function connectMainProcessHandler() {
    ipcMain.handle(
        KAWAI_API_LITERAL.input.keydown,
        (event: IpcMainInvokeEvent, key_event: KawaiKeyEvent) => {
            return KawaiKeyboardManager.getInstance().keyboard_logics(
                'keydown',
                key_event,
            );
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.input.keyup,
        (event: IpcMainInvokeEvent, key_event: KawaiKeyEvent) => {
            return KawaiKeyboardManager.getInstance().keyboard_logics(
                'keyup',
                key_event,
            );
        },
    );

    ipcMain.handle(
        KAWAI_API_LITERAL.menu.load_menu,
        (event: IpcMainInvokeEvent, ...args: any) => {
            const spy = MenuManager.getInstance().getMenuItemsByJson();
            console.log(spy)
            return MenuManager.getInstance().getMenuItemsByJson();
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.menu.load_favorites_list,
        (event: IpcMainInvokeEvent, ...args: any) => {
            const spy = MenuManager.getInstance().getMenuItemsByJson();
            console.log(spy)
            return MenuManager.getInstance().getMenuItemsByJson();
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.menu.add_favorites,
        (event: IpcMainInvokeEvent, ...args: any) => {
            const spy = MenuManager.getInstance().getMenuItemsByJson();
            console.log(spy)
            return MenuManager.getInstance().getMenuItemsByJson();
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.menu.delete_favorites,
        (event: IpcMainInvokeEvent, ...args: any) => {
            const spy = MenuManager.getInstance().getMenuItemsByJson();
            console.log(spy)
            return MenuManager.getInstance().getMenuItemsByJson();
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.menu.select_menu_item,
        (event: IpcMainInvokeEvent, ...args: any) => {
            const spy = MenuManager.getInstance().getMenuItemsByJson();
            console.log(spy)
            return MenuManager.getInstance().getMenuItemsByJson();
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.menu.update_favorites_order,
        (event: IpcMainInvokeEvent, ...args: any) => {
            const spy = MenuManager.getInstance().getMenuItemsByJson();
            console.log(spy)
            return MenuManager.getInstance().getMenuItemsByJson();
        },
    );


    ipcMain.handle(
        KAWAI_API_LITERAL.preference.apply_modified_preference,
        (e: Electron.IpcMainInvokeEvent, ...args: any[]) => {
            const new_conf = args[0] as KawaiConfig;
            set_config(new_conf!);
            flog.debug('new config saved.', new_conf);
            flog.debug('new config saved.', global_object.config);
            return true;
        },
    );

    ipcMain.on(
        KAWAI_API_LITERAL.preference.close,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
           get_preference_instance().close()
        },
    );

    ipcMain.handle(
        KAWAI_API_LITERAL.preference.load_config,
        (event: IpcMainInvokeEvent, ...args: any) => {
            flog.debug(default_config)
            return default_config.preference;
            // return global_object.config?.preference;
        },
    );

    ipcMain.handle(
        KAWAI_API_LITERAL.preference.load_available_locale_list,
        (e: Electron.IpcMainInvokeEvent, ...args: any[]) => {
            return LocaleManager.getInstance().getLocaleMetas();
        },
    );

    ipcMain.handle(
        KAWAI_API_LITERAL.preference.load_available_monitor_list,
        (e: Electron.IpcMainInvokeEvent, ...args: any[]) => {
            return KawaiWindowManager.getInstance().getMonitorNames();
        },
    );

    ipcMain.handle(
        KAWAI_API_LITERAL.preference.load_available_site_list,
        (e: Electron.IpcMainInvokeEvent, ...args: any[]) => {
            return KawaiSiteDescriptorManager.getInstance().getRegisteredDescriptorIds();
        },
    );

    ipcMain.handle(
        KAWAI_API_LITERAL.preference.load_available_window_size_list,
        (e: Electron.IpcMainInvokeEvent, ...args: any[]) => {
            return KawaiWindowManager.getInstance().getPresetSize();
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.preference.load_available_pip_window_size_list,
        (e: Electron.IpcMainInvokeEvent, ...args: any[]) => {
            return KawaiWindowManager.getInstance().getPictureInPicturePresetSize();
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.preference.load_available_pip_location_list,
        (e: Electron.IpcMainInvokeEvent, ...args: any[]) => {
            return KawaiWindowManager.getInstance().getPiPLocationCandidates();
        },
    );

    ipcMain.handle(
        KAWAI_API_LITERAL.preference.load_locale,
        (e: Electron.IpcMainInvokeEvent) => {
            return global_object.locale?.preference;
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
    ipcMain.on(
        KAWAI_API_LITERAL.menu.close,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            KawaiViewManager.getInstance()._closeMenu();
        },
    );
    
}
