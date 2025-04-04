import { app, ipcMain, IpcMainInvokeEvent } from 'electron';
import { KAWAI_API_LITERAL } from '../definitions/api';
import { global_object } from '../data/context';
import { set_config, set_preference } from '../logics/configures';
import {
    KawaiNameProperty,
    KawaiPreference,
} from '../definitions/setting_types';
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
import { KawaiRecursiveTypeRemover } from '../definitions/types';

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
        async (event: IpcMainInvokeEvent, key_event: KawaiKeyEvent) => {
            return await KawaiKeyboardManager.getInstance().keyboard_logics(
                'keydown',
                key_event,
            );
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.input.keyup,
        async (event: IpcMainInvokeEvent, key_event: KawaiKeyEvent) => {
            return await KawaiKeyboardManager.getInstance().keyboard_logics(
                'keyup',
                key_event,
            );
        },
    );

    ipcMain.handle(
        KAWAI_API_LITERAL.menu.load_menu,
        (event: IpcMainInvokeEvent, ...args: any) => {
            const spy = MenuManager.getInstance().getMenuItemsByJson();
            return MenuManager.getInstance().getMenuItemsByJson();
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.menu.load_favorites_list,
        (event: IpcMainInvokeEvent, ...args: any) => {
            flog.debug(
                'load favorites',
                MenuManager.getInstance().getFavorites(),
            );
            return MenuManager.getInstance().getFavorites();
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.menu.add_favorites,
        (event: IpcMainInvokeEvent, menu_id: string) => {
            MenuManager.getInstance().addFavorites(menu_id);
            return MenuManager.getInstance().getMenuItemsByJson();
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.menu.delete_favorites,
        (event: IpcMainInvokeEvent, id: string) => {
            return MenuManager.getInstance().deleteFavorites(id);
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.menu.select_menu_item,
        (event: IpcMainInvokeEvent, id: string) => {
            return MenuManager.getInstance().onSelectItem('', id);
        },
    );
    ipcMain.handle(
        KAWAI_API_LITERAL.menu.update_favorites_order,
        (event: IpcMainInvokeEvent, ...args: any) => {
            const spy = MenuManager.getInstance().getMenuItemsByJson();
            return MenuManager.getInstance().getMenuItemsByJson();
        },
    );

    ipcMain.handle(
        KAWAI_API_LITERAL.preference.apply_modified_preference,
        (
            e: Electron.IpcMainInvokeEvent,
            config: KawaiRecursiveTypeRemover<
                KawaiPreference,
                KawaiNameProperty
            >,
        ) => {
            set_preference(config!);
            KawaiViewManager.getInstance().notifyToView(
                KAWAI_API_LITERAL.preference.notify_config_update,
            );
            flog.debug('new config saved.', config);
            flog.debug('new config saved.', global_object.config);
            return true;
        },
    );

    ipcMain.on(
        KAWAI_API_LITERAL.preference.close,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            get_preference_instance().close();
        },
    );

    ipcMain.handle(
        KAWAI_API_LITERAL.preference.load_config,
        (event: IpcMainInvokeEvent, ...args: any) => {
            flog.debug(default_config);
            log.info('config', global_object.config?.preference);
            return global_object.config?.preference;
        },
    );

    ipcMain.handle(
        KAWAI_API_LITERAL.preference.load_available_locale_list,
        (e: Electron.IpcMainInvokeEvent, ...args: any[]) => {
            const locale_list = LocaleManager.getInstance().getLocaleMetas();
            locale_list.forEach((v) => {
                log.info(
                    `load available locales list  [${v.filename},${v.version}, ${v.metaname}]`,
                );
            });
            return locale_list;
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
            let loc = global_object.locale;
            return global_object.locale;
        },
    );

    ipcMain.on(
        KAWAI_API_LITERAL.preference.save_and_close,
        (
            e: Electron.IpcMainEvent,
            config: KawaiRecursiveTypeRemover<
                KawaiPreference,
                KawaiNameProperty
            >,
        ) => {
            set_preference(config);
            KawaiViewManager.getInstance().notifyToView(
                KAWAI_API_LITERAL.preference.notify_config_update,
            );
            global_object.preferenceWindow?.close();
        },
    );
    ipcMain.on(
        KAWAI_API_LITERAL.menu.close,
        (e: Electron.IpcMainEvent, ...args: any[]) => {
            KawaiViewManager.getInstance()._closeMenu();
        },
    );

    ipcMain.handle(
        KAWAI_API_LITERAL.etc.version,
        (event: IpcMainInvokeEvent, args: any[]) => {
            return app.getVersion();
        },
    );
}
