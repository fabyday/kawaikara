import {
    data_root_path,
    default_locale_directory,
} from '../component/constants';
import {
    KawaiLocale,
    LocaleMeta as KawaiLocaleMeta,
} from '../definitions/setting_types';
import * as fs from 'fs';
import * as path from 'path';
import { get_flogger, get_logger } from '../logging/logger';
import { read_json, read_json_filenames_in_dir } from '../logics/io';

const fclog = get_flogger('LocaleManager', 'LocaleManager', 'debug');
fclog.transports!.console!.level = 'info';

export class LocaleManager {
    static __instance: LocaleManager | undefined;

    private constructor() {}

    public static getInstance() {
        if (typeof LocaleManager.__instance === 'undefined') {
            LocaleManager.__instance = new LocaleManager();
        }
        return LocaleManager.__instance;
    }

    public async initialize() {}

    /**
     * return locale meta
     */
    public getLocaleMetas(root_path?: string): KawaiLocaleMeta[] {
        fclog.info('Get Locale Meta');
        fclog.info('Default Searching Directroy : ' + default_locale_directory);

        let filenames: string[] = [];
        const read_meta = (path: string): KawaiLocaleMeta | undefined => {
            const file_data = read_json(path);
            if (file_data == null) {
                return undefined;
            }
            const locale: KawaiLocale = file_data as KawaiLocale;
            return locale.locale_meta;
        };

        if (typeof root_path === 'undefined') {
            // check default root
            fclog.info(
                'Default Searching Directroy : ' +
                    path.join(data_root_path, default_locale_directory),
            );

            filenames = read_json_filenames_in_dir(
                path.join(data_root_path, default_locale_directory),
            );
            fclog.debug('searched Files : ' + filenames);
        } else {
            fclog.debug("searched file location :", root_path);
            filenames = read_json_filenames_in_dir(root_path);
        }

        const result = filenames.map((value: string) => {
            const meta: KawaiLocaleMeta = read_meta(value) ?? {
                filename: value,
                metaname: 'unnamed',
            };
            return meta;
        });

        fclog.debug(result);
        return result;
    }
}
