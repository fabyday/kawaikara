import { isStringLiteral } from 'typescript';
import {
    KawaiConfig,
    KawaiConfigure,
    KawaiLocale,
    KawaiNameProperty,
    KawaiPreference,
    KawaiShortcut,
    KawaiWindowPreference,
} from '../definitions/setting_types';
import * as lodash from 'lodash';
import * as fs from 'fs';
import path from 'path';
import { app, nativeTheme } from 'electron';
import {
    data_root_path,
    default_config_path,
    default_locale_directory,
} from '../component/constants';
import { global_object } from '../data/context';
import { set_autoupdater, unset_autoupdater } from '../component/autoupdater';
import log from 'electron-log/main';
import {
    default_config,
    default_locale,
} from '../definitions/default_preference';
import { normalize_locale_string } from './os';
import { get_flogger } from '../logging/logger';
import { KawaiViewManager } from '../manager/view_manager';
import {
    KawaiRecursiveTypeExtractor,
    KawaiRecursiveTypeRemover,
} from '../definitions/types';
import { KawaiSiteDescriptorManager } from '../manager/site_descriptor_manager';
import { KawaiWindowManager } from '../manager/window_manager';
import { ShortcutManager } from '../manager/shortcut_manager';

const flog = get_flogger('configure', 'configure', 'debug');

function apply_darkmode(mode: boolean) {
    if (global_object.config?.preference?.general?.dark_mode?.value === true) {
        nativeTheme.themeSource = 'dark';
    } else {
        nativeTheme.themeSource = 'light';
    }
    log.info(nativeTheme.themeSource, 'mode on.');
    global_object.mainWindow?.reload(); // reload theme.
}

function set_general_configuration(config: KawaiConfig) {
    flog.debug('setup general config.');

    apply_darkmode(config.preference?.general?.dark_mode?.value ?? false);
    apply_autoupdate(
        config.preference?.general?.enable_autoupdate?.value ?? false,
    );

    apply_window_prefernece(config.preference?.general?.window_preference);
    apply_default_main(config.preference?.general?.default_main?.id.value);
}

function apply_window_prefernece(
    window_preference:
        | KawaiRecursiveTypeRemover<KawaiWindowPreference, KawaiNameProperty>
        | undefined,
) {
    KawaiWindowManager.getInstance().setDefaultWindowSize(
        window_preference?.window_size?.width?.value,
        window_preference?.window_size?.height?.value,
    );
    KawaiWindowManager.getInstance().setPiPBounds(
        window_preference?.pip_window_size?.width?.value,
        window_preference?.pip_window_size?.height?.value,
        window_preference?.pip_location?.location?.value,
        window_preference?.pip_location?.monitor?.value,
    );
}

function apply_default_main(id: string | undefined) {
    if (typeof id !== 'undefined') {
        const site_descritor =
            KawaiSiteDescriptorManager.getInstance().qeury_site_descriptor_by_name(
                id,
            );
        if (typeof site_descritor !== 'undefined') {
            KawaiViewManager.getInstance().loadUrl(id);
        }
    }
}

function apply_autoupdate(mode: boolean) {
    log.debug('apply auto update');
    if (mode === true) {
        set_autoupdater();
    } else {
        unset_autoupdater();
    }
}

function set_shortcut_configuration(config: KawaiConfig) {
    const mgr = ShortcutManager.getInstance();
    if (typeof config === 'undefined') {
        return;
    }
    if (typeof config.preference === 'undefined') {
        return;
    }
    if (typeof config.preference.shortcut === 'undefined') {
        return;
    }

    Object.keys(config.preference.shortcut).forEach((key) => {
        const value: string | KawaiShortcut | undefined =
            config.preference!.shortcut?.[key];
        if (typeof value !== 'undefined' && typeof value !== 'string') {
            if (typeof value.shortcut_key !== 'undefined') {
                mgr.queryAndModifyShortcut(key, value.shortcut_key ?? '');
            }
        }
    });
}

export function save_config(config: KawaiConfig, save_path?: string) {
    const data = JSON.stringify(config);
    save_path = save_path ?? path.join(data_root_path, default_config_path);
    let root_pth = path.dirname(save_path);

    if (!fs.existsSync(root_pth)) {
        fs.mkdirSync(root_pth, { recursive: true });
    }

    fs.writeFileSync(save_path, data);
}

function isJsonObject(input: unknown): input is JSON {
    return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function check_lower_than_2_x_version(raw_json: Object) {
    const json = raw_json as any;
    if (typeof json?.['version']?.['value'] !== 'undefined') {
        let version: string = json['version']['value']!;
        const [major, minor1, minor2] = version.split('.');
        if (2 >= Number(major)) {
            return false;
        }
    } else {
        return true;
    }
}

/**
 *
 * @param jsondata  jsondata or json file path or KawaiConfig data.
 * @param conf if value was undefined, then create new @KawaiConfigure
 * If path is directory, then find kawai-config.json on specified directory.
 * If path is json file path, then load file.(if it was not json, then throw error)
 * if Path wasn't exists, then Find config file AppData/config/kawai-config.json,
 *
 *
 */

function _set_config_from_path(pth: string): KawaiConfig | null {
    let raw_data = null;
    try {
        raw_data = fs.readFileSync(pth, 'utf8');
    } catch (e) {
        flog.debug(`${pth} path failed`);
        flog.debug(e);
    }

    if (raw_data == null) {
        try {
            raw_data = fs.readFileSync(path.join(data_root_path, pth), 'utf-8');
        } catch (e) {
            flog.debug(`${pth} path failed`);
        }
    }
     

    if (raw_data == null) {
        return default_config;
    }

    const config: KawaiConfig = JSON.parse(raw_data) as KawaiConfig;
    if (check_lower_than_2_x_version(config)) {
        return default_config;
    }
    return config;
}

function _set_config_from_json(data: JSON): KawaiConfig {
    const config = data as unknown as KawaiConfig;

    // if (check_lower_than_2_x_version(config)) {
    //     return default_config;
    // }

    return config;
}

export function set_preference(
    preference: KawaiRecursiveTypeRemover<KawaiPreference, KawaiNameProperty>,
) {
    if (typeof global_object.config === 'undefined') {
        global_object.config = {};
    }
    let obj = lodash.merge({}, global_object.config.preference ?? {});
    obj = lodash.merge(obj, preference);
    global_object.config.preference = obj;
    let v = global_object.config;

    set_general_configuration(global_object.config);
    set_shortcut_configuration(global_object.config);
    set_locale(
        global_object?.config?.preference?.locale?.selected_locale?.value ?? '',
    );
    save_config(global_object.config, path.join(data_root_path, 'test.json'));
}

export function set_config(data: JSON | string | KawaiConfig | undefined) {
    var jsonData: JSON;
    var config: KawaiConfig | null = null;

    if (typeof data === 'string' || typeof data === 'undefined') {
        let config_path = data;
        if (typeof config_path === 'undefined') {
            config_path = path.join(data_root_path, default_config_path);
        }

        config = _set_config_from_path(config_path!);
    } else if (isJsonObject(data)) {
        config = _set_config_from_json(data);
    } else {
        config = config;
        if (check_lower_than_2_x_version(data)) {
            config = default_config;
        } else {
            config = data;
        }
        // KAWAI CONFIG
    }

    let obj = lodash.merge({}, global_object.config);
    obj = lodash.merge(obj, config);
    global_object.config = obj;
    let sss = global_object.config ;
    console.log(sss)
    set_general_configuration(global_object.config);
    set_shortcut_configuration(global_object.config);
    set_locale(
        global_object?.config?.preference?.locale?.selected_locale?.value ?? '',
    );
}

export function load_locale_from_path(pth: string): KawaiLocale | null {
    let raw_data = null;
    try {
        raw_data = fs.readFileSync(pth, 'utf8');
    } catch (e) {
        flog.debug(`${pth} path failed`);
        flog.debug(e);
    }

    if (raw_data == null) {
        try {
            raw_data = fs.readFileSync(
                path.join(data_root_path, default_locale_directory, pth),
                'utf-8',
            );
        } catch (e) {
            flog.debug(
                `${path.join(data_root_path, default_locale_directory, pth)} path failed`,
            );
        }
    }

    if (raw_data == null) {
        return default_locale;
    }

    const config: KawaiLocale = JSON.parse(raw_data) as KawaiLocale;
    let version_str: string | undefined = config.locale_meta?.version;
    if (typeof version_str === 'undefined') {
        return default_locale;
    }
    let major_version = Number(version_str.split('.')[0]);
    if (major_version < 2) {
        return default_locale;
    }

    return config;
}

/**
 *
 * @param data
 */
export function set_locale(data: JSON | string | KawaiLocale | undefined) {
    let locale: KawaiLocale | null = null;
    console.log(
        global_object.config?.preference?.locale?.selected_locale?.value,
    );
    if (typeof data === 'string' || typeof data === 'undefined') {
        let config_path = data;

        if (typeof config_path === 'undefined') {
            let selected_locale_fname = 'EN.json';
            if (
                typeof global_object.config?.preference?.locale?.selected_locale
                    ?.value !== 'undefined'
            ) {
                selected_locale_fname =
                    global_object.config.preference.locale.selected_locale
                        .value + '.json';
            }

            config_path = path.join(
                default_locale_directory,
                selected_locale_fname,
            );
        }

        if (path.extname(config_path) === '') {
            config_path = config_path + '.json';
        }

        locale = load_locale_from_path(config_path!);
    } else if (isJsonObject(data)) {
        locale = data as unknown as KawaiLocale;
    } else {
        if (check_lower_than_2_x_version(data)) {
            locale = default_locale;
        } else {
            locale = data;
        }
        // KAWAI CONFIG
    }

    if (typeof global_object?.locale === 'undefined') {
        //for safety.
        global_object.locale = default_locale;
    }

    if (locale != null) {
        global_object.locale = locale;
    }
}
