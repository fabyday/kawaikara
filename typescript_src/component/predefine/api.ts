import { ipcRenderer } from 'electron';
import { KawaiConfig } from '../../definitions/setting_types';
import { KAWAI_API_LITERAL } from '../../definitions/api';
import { KawaiLogType } from '../../logging/logger';

export const load_update_info_f = () => {
    return ipcRenderer.invoke(KAWAI_API_LITERAL.etc.load_update_info);
};

export const load_locale_f = () => {
    return ipcRenderer.invoke(KAWAI_API_LITERAL.preference.load_locale);
};

export const load_favorites_list_f = () => {
    ipcRenderer.invoke(KAWAI_API_LITERAL.menu.load_favorites_list);
};

export const delete_favorites_list_f = (shortcut_property_key: string) => {
    ipcRenderer.invoke(
        KAWAI_API_LITERAL.menu.delete_favorites,
        shortcut_property_key,
    );
};

export const load_menu_f = () => {
    return ipcRenderer.invoke(KAWAI_API_LITERAL.menu.load_menu);
};

export const update_favorites_order_f = (
    shortcut_property_key: string,
    desired_order: number,
) => {
    ipcRenderer.invoke(
        KAWAI_API_LITERAL.menu.add_favorites,
        shortcut_property_key,
    );
};

// only allow shortcut key
export const add_favorites_f = (shortcut_property_key: string) => {
    ipcRenderer.invoke(
        KAWAI_API_LITERAL.menu.add_favorites,
        shortcut_property_key,
    );
};

export const apply_preference_f = (config: KawaiConfig) => {
    return ipcRenderer.invoke(
        KAWAI_API_LITERAL.preference.apply_modified_preference,
        config,
    );
};

export const close_preference_f = () => {
    return ipcRenderer.send(KAWAI_API_LITERAL.preference.close);
};

export const load_available_locale_list_f = () => {
    return ipcRenderer.invoke(
        KAWAI_API_LITERAL.preference.load_available_locale_list,
    );
};

export const load_available_monitor_list_f = () => {
    return ipcRenderer.invoke(
        KAWAI_API_LITERAL.preference.load_available_monitor_list,
    );
};

export const load_available_site_list_f = () => {
    return ipcRenderer.invoke(
        KAWAI_API_LITERAL.preference.load_available_site_list,
    );
};

export const load_available_window_size_list_f = () => {
    return ipcRenderer.invoke(
        KAWAI_API_LITERAL.preference.load_available_window_size_list,
    );
};

export const load_available_pip_window_size_list_f = () => {
    return ipcRenderer.invoke(
        KAWAI_API_LITERAL.preference.load_available_pip_window_size_list,
    );
};
export const load_available_pip_location_list_f = () => {
    return ipcRenderer.invoke(
        KAWAI_API_LITERAL.preference.load_available_pip_location_list,
    );
};

export const load_config_f = () => {
    return ipcRenderer.invoke(KAWAI_API_LITERAL.preference.load_config);
};

export const save_and_close_preference_f = (config: KawaiConfig) => {
    apply_preference_f(config);
    close_preference_f();
};

export const select_menu_item_f = (id: string) => {
    return ipcRenderer.invoke(KAWAI_API_LITERAL.menu.select_menu_item, id);
};


export const notify_menu_update_f = (callback : (...args : any[])=>void)=>{
    ipcRenderer.on(KAWAI_API_LITERAL.menu.notify_menu_update, (event : Electron.IpcRendererEvent, ...args : any[])=>{
        callback(...args);
    })
}



export const keydown_f = async (event: KeyboardEvent) => {
    const keyData = {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
    };
    if (await ipcRenderer.invoke(KAWAI_API_LITERAL.input.keydown, keyData)) {
        event.preventDefault();
    }
};

export const keyup_f = async (event: KeyboardEvent) => {
    const keyData = {
        key: event.key,
        code : event.code,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
    };

    if (await ipcRenderer.invoke(KAWAI_API_LITERAL.input.keyup, keyData)) {
        event.preventDefault();
    }
};

// alias to log()
export function clog(...args: any[]) {
    // ipcRenderer.send(KAWAI_API_LITERAL.logging.file_log, ...args);
}

export function flog(...args: any[]) {}

export function log(name: string, ...args: any[]) {
    ipcRenderer.send(KAWAI_API_LITERAL.logging.log, ...args);
}
export function custom_callback(name: string, ...args: any[]) {
    ipcRenderer.send(KAWAI_API_LITERAL.logging.log, ...args);
}
export function close_menu_f() {
    ipcRenderer.send(KAWAI_API_LITERAL.menu.close);
}


export function on_notify_menu_open_f(callback : (state:string)=>void){
    ipcRenderer.on(KAWAI_API_LITERAL.menu.on_notify_menu_open, (e, s:string)=>{callback(s)});
}
