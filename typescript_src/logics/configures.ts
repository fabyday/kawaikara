import { isStringLiteral } from 'typescript';
import {
    KawaiConfig,
    KawaiConfigure,
    KawaiLocale,
    KawaiNameProperty,
    KawaiShortcut,
    KawaiWindowPreference,
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
import { set_autoupdater, unset_autoupdater } from '../component/autoupdater';
import log from 'electron-log/main';
import {
    default_config,
    default_locale,
} from '../definitions/default_preference';
import { normalize_locale_string } from './os';
import { LocaleManager } from '../manager/lcoale_manager';
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
    KawaiViewManager.getInstance().resizeWindow(
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
            if (typeof value.shortcut_key === 'undefined')
                mgr.queryAndModifyShortcut(key, value.shortcut_key ?? '');
        }
    });
}

function save_config(config: KawaiConfig, save_path?: string) {
    const data = JSON.stringify(config);
    if (typeof save_path === 'string') {
        fs.writeFileSync(save_path, data);
    } else {
        fs.writeFileSync(path.join(data_root_path, default_config_path), data);
    }
}

function isJsonObject(input: unknown): input is JSON {
    return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function check_version(version?: string) {}

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
            flog.debug('load from file ', data);
            rawData = fs.readFileSync(data, 'utf8');
        } catch (e) {
            flog.debug('load was failed from given path.');
            log.debug('load was failed from given path.');
            // if failed load default config json
            try {
                flog.debug(
                    'load from default path.',
                    path.join(data_root_path, default_config_path),
                );
                rawData = fs.readFileSync(
                    path.join(data_root_path, default_config_path),
                    'utf8',
                );
            } catch (e) {
                flog.debug(
                    'failed...\nload from default locale.\n',
                    default_config,
                );
                log.debug('default config file was not existed.');
                rawData = JSON.stringify(default_config);
                log.debug('load default config.');
            }
        } finally {
            jsonData = JSON.parse(rawData as string);
            const unknown_type_config: unknown = jsonData as unknown; // remove syntax error
            config = unknown_type_config as KawaiConfig;
            flog.debug('convert loaded config to KawaiConfig.\n', config);
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
    flog.debug('config start');
    flog.debug(global_object.config);
    flog.debug('config  end');
    if (typeof config.version?.value === 'undefined') {
        global_object.config = { ...global_object.config, ...default_config };
    } else {
        global_object.config = { ...global_object.config, ...config };
    }

    set_general_configuration(global_object.config);
    set_shortcut_configuration(global_object.config);
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
                const system_locale_code = normalize_locale_string(
                    app.getSystemLocale(),
                );
                log.debug(
                    "can't find default system locale file.",
                    'locale path : ' +
                        path.join(
                            data_root_path,
                            default_locale_directory,
                            system_locale_code + '.json',
                        ),
                );
                rawData = JSON.stringify(default_locale);
            }
        }
        jsonData = JSON.parse(rawData);
        flog.debug(jsonData);
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
