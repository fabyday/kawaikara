import { app } from 'electron';
import { set_config, set_locale } from './configures';
import { global_object } from '../data/context';
import {
    data_root_path,
    default_app_states_path,
} from '../component/constants';
import path from 'path';

import * as fs from 'fs';
import { KawaiContext } from '../definitions/context';
import {
    connectMainProcessHandler,
    connectMainWindowHandler,
} from '../component/handler';
import { KawaiSiteDescriptorManager } from '../definitions/SiteDescriptor';
import { LocaleManager as KawaiLocaleManager } from '../manager/lcoale_manager';
import { ShortcutManager as KawaiShortcutManager } from '../manager/shortcut_manager';

function initialize_global_object(root_path?: string) {
    // initialize global object states
    var root_pth: string;
    if (typeof root_path === 'string') {
        root_pth = root_path;
    } else {
        root_pth = data_root_path;
    }

    var states;
    try {
        let rawData = fs.readFileSync(
            path.join(root_pth, default_app_states_path),
            'utf8',
        );
        let jsonData = JSON.parse(rawData);
        const unknown_state: unknown = jsonData as unknown; // remove syntax error
        states = unknown_state as KawaiContext;
    } catch {
        console.log('err');
    }

    global_object.context = {
        current_window_bounds: { ...states?.current_window_bounds },
    };

    // initilaize views
}

function initialize_handler() {
    connectMainProcessHandler();
    connectMainWindowHandler();
}

async function initialize_manager() {
    await KawaiSiteDescriptorManager.getInstance().initializeDefaultSitesDescriptor();
    await KawaiLocaleManager.getInstance().initialize();
    await KawaiShortcutManager.getInstance().initialize();
}

/**
 *
 * @param config_root : config file root. if it was undefined,
 * then find config and states files in AppData on windows and OS specific default app path
 */
export async function initialize(config_root?: string) {
    const manager_promise = initialize_manager();
    initialize_handler();
    initialize_global_object(config_root);

    if (typeof config_root === 'string') {
        set_config(config_root);
    } else {
        set_config(app.getAppPath());
    }

    set_locale(
        global_object.config?.preference?.locale?.selected_locale?.value,
    );

    await manager_promise;
}
