import { ContextBridge, contextBridge, ipcRenderer } from "electron";

import { add_favorites_f, apply_preference_f, close_preference_f, delete_favorites_list_f, load_available_locale_list_f, load_available_monitor_list_f, load_available_site_list_f, load_available_window_size_list_f, load_config, load_config_f, load_favorites_list_f, load_locale_f, load_menu_f, save_and_close_preference_f, update_favorites_order_f } from "./API";




contextBridge.exposeInMainWorld( "KAWAI_API" , {
    

    preference : {
        apply_modified_preference : apply_preference_f,
        close : close_preference_f,
        save_and_close : save_and_close_preference_f,
        load_config : load_config_f,
        load_locale : load_locale_f,
        
        load_available_site_list : load_available_site_list_f,

        load_available_locale_list : load_available_locale_list_f,
        load_available_monitor_list : load_available_monitor_list_f,
        load_available_window_size_list : load_available_window_size_list_f,
    },
    menu : {

        // fovorites manipulation ops
        add_favorites : add_favorites_f,
        load_favorites_list : load_favorites_list_f,
        delete_favorites : delete_favorites_list_f,
        update_favorites_order : update_favorites_order_f,
        // load entire menu item.
        load_menu : load_menu_f,
        
    }

})

