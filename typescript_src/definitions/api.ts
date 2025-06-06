
const api_literal = {
    preference: {
        apply_modified_preference: 'apply-changed-preference',
        close: 'close',
        save_and_close: 'save_and_close',
        load_config: 'load-config',
        load_locale: 'load-locale',

        load_available_site_list: 'load-available-site-list',
        notify_config_update : "notify-config-update",
        load_available_locale_list: 'load-available-locale-list',
        load_available_monitor_list: 'load-available-monitor-list',
        load_available_window_size_list: 'load-available-window-size-list',
        load_available_pip_window_size_list: 'load-available-pip-window-size-list',
        load_available_pip_location_list: 'load-available-pip-location-list',
    },
    menu: {
        // fovorites manipulation ops
        add_favorites: 'add-favorites',
        load_favorites_list: 'load-favorites-list',
        delete_favorites: 'delete-favorites',
        update_favorites_order: 'update-fovorites-order',
        
        // load entire menu item.
        load_menu: 'load-menu',
        select_menu_item: 'select-menu-item',

        notify_menu_update : 'notify-menu-update',
        on_notify_menu_open : 'notify-menu-open', //this is callback on Renderer
        close : 'menu-close'
    },
    etc: {
        load_update_info: 'load-update-info',
        version: 'version',
        github: 'github',
    },
    input: {
        keydown: 'keydown',
        keyup: 'keyup',
    },
    logging: {
        log: 'log',
    },
    custom : {
        custom_callback : "custom-callback"
    }
};

export const KAWAI_API_LITERAL = Object.freeze(api_literal);
