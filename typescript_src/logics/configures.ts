import { isStringLiteral } from 'typescript';
import {
    KawaiConfig,
    KawaiConfigure,
    KawaiLocale,
} from '../definitions/setting_types';

import * as fs from 'fs';
import path from 'path';
import { app, nativeTheme } from 'electron';
import {
    data_root_path,
    default_config_path,
    default_locale_directory,
} from '../component/constants';
import { global_object } from '../data/context';
import { ShortcutManager } from '../manager/shortcut_manager';
import { set_autoupdater, unset_autoupdater } from '../component/autoupdater';
import log from 'electron-log/main';
import { default_locale } from '../definitions/default_preference';
import { normalize_locale_string } from './os';
import { LocaleManager } from '../manager/lcoale_manager';
function set_general_configuration(jsondata: KawaiConfig) {
    log.debug('setup general config.');
}
function apply_autoupdate() {
    log.debug('apply auto update');
    if (
        global_object.config?.preference?.general?.enable_autoupdate?.value ===
        true
    ) {
        set_autoupdater();
    } else {
        unset_autoupdater();
    }
}
function apply_darkmode() {
    if (global_object.config?.preference?.general?.dark_mode?.value === true) {
        nativeTheme.themeSource = 'dark';
    } else {
        nativeTheme.themeSource = 'light';
    }
    log.info(nativeTheme.themeSource, 'mode on.');
    global_object.mainWindow?.reload(); // reload theme.
}

function apply_resize_window() {
    log.info('apply resize window.');
}

function apply_pipmode() {}

function set_shortcut_configuration(jsondata: KawaiConfig) {
    const mgr = ShortcutManager.getInstance();
}

function save_config(config: KawaiConfig, save_path?: string) {
    const data = JSON.stringify(config);
    if (typeof save_path === 'string') {
        fs.writeFileSync(save_path, data);
    } else {
        fs.writeFileSync(path.join(data_root_path, default_config_path), data);
    }
}

function set_favorites(config: KawaiConfig) {
    log.info('set favorites');
}

function isJsonObject(input: unknown): input is JSON {
    return typeof input === 'object' && input !== null && !Array.isArray(input);
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
export function set_config(data: JSON | string | KawaiConfig) {
    var jsonData: JSON;
    var config: KawaiConfig;

    if (typeof data === 'string') {
        // if data_path isn't exists

        log.debug('config was set by Json');
        let rawData;
        try {
            rawData = fs.readFileSync(data, 'utf8');
        } catch (e) {
            log.debug('load was failed from given path.');
            // if failed load default config json
            try {
                rawData = fs.readFileSync(
                    path.join(data_root_path, default_config_path),
                    'utf8',
                );
            } catch (e) {
                log.debug('default config file was not existed.');
                rawData = JSON.stringify(default_locale);
                log.debug('load default config.');
            }
        } finally {
            jsonData = JSON.parse(rawData as string);
            const unknown_type_config: unknown = jsonData as unknown; // remove syntax error
            config = unknown_type_config as KawaiConfig;
        }
    } else if (isJsonObject(data)) {
        //Conversion of type 'JSON' to type 'KawaiRecursiveTypeRemover<KawaiConfigure, KawaiNameProperty>'
        // may be a mistake because neither type sufficiently overlaps with the other. If this was intentional,
        // convert the expression to 'unknown' first.
        log.debug('config was set by Json');
        jsonData = data;
        const unknown_type_config: unknown = jsonData as unknown; // remove syntax error
        config = unknown_type_config as KawaiConfig;
    } else {
        log.debug('config was set by KawaiConfig');
        config = data as KawaiConfig;
    }

    global_object.config = { ...global_object.config, ...config };

    set_general_configuration(global_object.config);
    set_shortcut_configuration(global_object.config);
    set_favorites(global_object.config);
}

/**
 *
 * @param data
 */
export function set_locale(data: JSON | string | KawaiLocale | undefined) {
    var jsonData: JSON;
    var locale: KawaiLocale;
    log.info('set locale.');
    if (typeof data === 'string') {
        // if data_path isn't exists
        let rawData;
        try {
            rawData = fs.readFileSync(data, 'utf8');
        } catch (e) {
            log.debug('file read was failed.');
            log.debug('err : ', e);
            try {
                log.debug(
                    'find locale in default locale directory. and search system locale.',
                );
                const system_locale_code = normalize_locale_string(
                    app.getSystemLocale(),
                );
                rawData = fs.readFileSync(
                    path.join(
                        data_root_path,
                        default_locale_directory,
                        system_locale_code + '.json',
                    ),
                    'utf8',
                );
            } catch (e) {
                log.debug("can't find default system locale file.");
                rawData = JSON.stringify(default_locale);
            }
        }
        jsonData = JSON.parse(rawData);
        const unknown_type_config: unknown = jsonData as unknown; // remove syntax error
        locale = unknown_type_config as KawaiLocale;
    } else if (isJsonObject(data)) {
        //Conversion of type 'JSON' to type 'KawaiRecursiveTypeRemover<KawaiConfigure, KawaiNameProperty>'
        // may be a mistake because neither type sufficiently overlaps with the other. If this was intentional,
        // convert the expression to 'unknown' first.
        jsonData = data;
        const unknown_type_config: unknown = jsonData as unknown; // remove syntax error
        locale = unknown_type_config as KawaiLocale;
    } else if (typeof data === 'undefined') {
        // if undefined, load default locale.
        let rawData = fs.readFileSync(
            path.join(data_root_path, default_locale_directory, 'en.json'),
            'utf8',
        );
        jsonData = JSON.parse(rawData);
        const unknown_type_config: unknown = jsonData as unknown; // remove syntax error
        locale = unknown_type_config as KawaiLocale;
    } else {
        locale = data as KawaiLocale;
    }

    global_object.locale = { ...global_object.locale, ...locale };
}
