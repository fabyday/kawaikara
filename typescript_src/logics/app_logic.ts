import { app, net, protocol } from 'electron';
import { set_config, set_locale } from './configures';
import { global_object } from '../data/context';
import {
    data_root_path,
    default_app_states_path,
    default_config_path,
    default_locale_directory,
} from '../component/constants';
import path from 'path';

import * as fs from 'fs';
import { KawaiContext } from '../definitions/context';
import {
    connectMainProcessHandler,
    connectMainWindowHandler,
} from '../component/handler';
import { LocaleManager as KawaiLocaleManager } from '../manager/lcoale_manager';
import {
    ShortcutManager as KawaiShortcutManager,
    ShortcutManager,
} from '../manager/shortcut_manager';
import { get_mainview_instance } from '../component/mainview';
import log from 'electron-log/main';
import { KawaiViewManager } from '../manager/view_manager';
import { MenuManager } from '../manager/menu_manager';
import { get_menu_instance } from '../component/menu';
import { KawaiSiteDescriptorManager } from '../manager/site_descriptor_manager';
import { set_activity } from '../component/discord';
import { KAWAI_PROTOCOL_LITERAL } from '../definitions/protocol';

import * as url from 'node:url';
import { flog, get_flogger, get_logger } from '../logging/logger';
import { KawaiBgTaskManager } from '../manager/background_task_manager';

function initialize_global_object_context(root_path?: string) {
    // initialize global object states
    var root_pth: string;
    if (typeof root_path === 'string') {
        root_pth = root_path;
    } else {
        root_pth = data_root_path;
    }

    var states: KawaiContext | undefined;
    try {
        let rawData = fs.readFileSync(
            path.join(root_pth, default_app_states_path),
            'utf8',
        );
        let jsonData = JSON.parse(rawData);
        const unknown_state: unknown = jsonData as unknown; // remove syntax error
        states = unknown_state as KawaiContext;
    } catch {
        log.debug("global context save files wasn't existed");
    }

    global_object.context = { ...global_object.context, ...states };

    // initilaize views
}

function initialize_handler() {
    connectMainProcessHandler();
    connectMainWindowHandler();
}

async function initialize_manager() {
    await KawaiSiteDescriptorManager.getInstance().initializeDefaultSitesDescriptor();
    await KawaiLocaleManager.getInstance().initialize();
    await KawaiViewManager.getInstance().initialize();
    await MenuManager.getInstance().initialize();
    await KawaiShortcutManager.getInstance().initialize();
    await KawaiBgTaskManager.getInstance().initialize();
}

async function initialize_manager_connection() {
    MenuManager.getInstance()._connectManager(
        'menu-selected',
        KawaiSiteDescriptorManager.getInstance().runEventLogic.bind(
            KawaiSiteDescriptorManager.getInstance(),
        ),
    );
    log.info('menu manager, site desc manager, connected.');

    ShortcutManager.getInstance()._connectManager(
        'activated',
        KawaiSiteDescriptorManager.getInstance().runEventLogic.bind(
            KawaiSiteDescriptorManager.getInstance(),
        ),
    );
}

/**
 * initialize views,
 * this function will be executed after config loading was done.
 */
async function initialize_views() {
    get_mainview_instance();
    get_menu_instance();
}
async function initialize_data() {
    await import('../data/connnect_data');
}

async function initialize_protocol() {
    // seeeeee
    // https://www.electronjs.org/docs/latest/api/protocol
    protocol.handle(
        KAWAI_PROTOCOL_LITERAL.default,
        (request: GlobalRequest) => {
            const filePath = request.url.slice(
                `${KAWAI_PROTOCOL_LITERAL.default}://`.length,
            );
            const path = url.pathToFileURL(filePath);
            return net.fetch(path.toString());
        },
    );
}
const app_flog = get_flogger('app_logic', 'applogic', 'info');
/**
 *
 * @param config_root : config file root. if it was undefined,
 * then find config and states files in AppData on windows and OS specific default app path
 */
export async function initialize(config_root?: string) {
    await initialize_protocol();
    await initialize_manager();
    await initialize_manager_connection();
    await initialize_data();
    await set_activity();
    initialize_global_object_context(config_root);
    initialize_handler();
    log.info(`config search path ${data_root_path}`);
    log.info(`locale search path ${default_locale_directory}`);
    set_config(config_root);

    log.info(
        `selected locale ${global_object.config?.preference?.locale?.selected_locale?.value}`,
    );

    await initialize_views();
}
