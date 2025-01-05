import { ipcRenderer } from 'electron';
import { KawaiConfig } from '../../definitions/setting_types';
import { KAWAI_API_LITERAL } from '../../definitions/api';

export const load_update_info_f = () => {
    return ipcRenderer.invoke(KAWAI_API_LITERAL.etc.load_update_info);
};

export const load_locale_f = (locale: string) => {
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
    ipcRenderer.invoke(KAWAI_API_LITERAL.menu.load_menu);
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
    return ipcRenderer.invoke(KAWAI_API_LITERAL.preference.close);
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

export const keydown_f = (event: KeyboardEvent) => {
    event.preventDefault();
    const eventData = {
        key: event.key,
        keyCode: event.keyCode,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
    };
    return ipcRenderer.invoke(KAWAI_API_LITERAL.input.keydown, eventData);
};

export const keydup_f = (event: KeyboardEvent) => {
    if (event.defaultPrevented) {
        console.log('up');
        return ipcRenderer.invoke(KAWAI_API_LITERAL.input.keyup, event);
    }
};
