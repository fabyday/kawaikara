import { default_locale_directory } from '../component/constants';
import {
    KawaiLocale,
    LocaleMeta as KawaiLocaleMeta,
} from '../definitions/setting_types';
import * as fs from 'fs';
import * as path from 'path';
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
        const read_meta = (path: string): KawaiLocaleMeta | undefined => {
            const file_data = fs.readFileSync(path, { encoding: 'utf8' });
            const locale: KawaiLocale = JSON.parse(file_data) as KawaiLocale;
            return locale.locale_meta;
        };

        if (typeof root_path === 'undefined') {
            const filenames: string[] = fs.readdirSync(
                default_locale_directory,
                { encoding: 'utf8' },
            );
            return filenames.map((value: string) => {
                const meta: KawaiLocaleMeta = read_meta(value) ?? {
                    filename: value,
                    metaname: 'unnamed',
                };
                return meta;
            });
        } else {
            const filenames: string[] = fs.readdirSync(
                default_locale_directory,
                { encoding: 'utf8' },
            );
            return filenames.map((value: string) => {
                const meta: KawaiLocaleMeta = read_meta(value) ?? {
                    filename: value,
                    metaname: 'unnamed',
                };
                return meta;
            });
        }
    }
}
