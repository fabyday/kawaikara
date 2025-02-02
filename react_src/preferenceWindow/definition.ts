import { create } from 'zustand';
import produce from 'immer';
import {
    KawaiConfig,
    KawaiLocale,
    KawaiPreference,
    KawaiShortcut,
    KawaiShortcutCollection,
} from '../../typescript_src/definitions/setting_types';
import log from 'electron-log/renderer';
import * as lodash from 'lodash';
log.transports.console.level = 'debug';
//////// 려차려차려차려차
type ShortCutDupStates = {
    shortcut_dups: Object;
    check_duplication: (shortcut_id: string) => boolean;
    check_duplication_all: () => boolean;
    fetch: (shortcut_collections?: KawaiShortcutCollection) => void;
};

export const shortcut_states = create<ShortCutDupStates>((set, get) => ({
    shortcut_dups: {},
    check_duplication_all: () => {
        if (Object.keys(get().shortcut_dups).length === 0) return false;
        return Object.values(get().shortcut_dups).reduce((p, c) => {
            return p || c;
        });
    },
    check_duplication: (shortcut_id: string) => {
        return (get().shortcut_dups as any)[shortcut_id] ?? true;
    },
    fetch: (shortcut_collection?: KawaiShortcutCollection) => {
        if (typeof shortcut_collection === 'undefined') {
            return; // do nothing.
        }
        let skeys = Object.keys(shortcut_collection);
        skeys = skeys.filter((value) => {
            return value !== 'name';
        });
        const shortcut_key_id_map = {} as any;
        skeys.forEach((id) => {
            const shortcut =
                (shortcut_collection[id] as KawaiShortcut).shortcut_key ?? '';
            if (shortcut !== '') {
                if (typeof shortcut_key_id_map[shortcut] === 'undefined') {
                    shortcut_key_id_map[shortcut] = new Set<string>();
                }

                shortcut_key_id_map[shortcut].add(id);
            }
        });

        const result = {} as any;
        skeys.forEach((id) => (result[id] = false));
        Object.keys(shortcut_key_id_map).forEach((sk) => {
            for (let name of shortcut_key_id_map[sk]) {
                result[name] = shortcut_key_id_map[sk].size > 1 ? true : false;
            }
        });
        set((state) => ({ ...state, shortcut_dups: { ...result } }));
    },
}));

type Action = {
    fetch: () => Promise<void>;
    get_property: () => KawaiPreference;
    set_property: (path: string, new_value: any) => void;
    is_changed: () => boolean;
};

type PreferenceState = {
    perference: KawaiPreference;
    changed_preference: KawaiPreference;
} & Action;

type get_type = () => PreferenceState;
type set_type = (
    partial:
        | PreferenceState
        | Partial<PreferenceState>
        | ((state: PreferenceState) => PreferenceState),
    replace?: boolean | undefined,
) => void;

const context = (set: set_type, get: get_type) => ({
    perference: {},
    changed_preference: {},
    fetch: async () => {
        const config_ = await window.KAWAI_API.preference.load_config();
        const locale_ : KawaiLocale = await window.KAWAI_API.preference.load_locale() as KawaiLocale;
        const locale = locale_.preference
        console.log('context fetch.1');
        console.log(config_);
        console.log(locale);
        console.log('context fetch.2');
        const combine_config = lodash.merge({}, config_);
        const combine_locale = lodash.merge(combine_config, locale);
        set((state) => {
            return {
                ...state,
                perference: { ...combine_locale },
                changed_preference: {},
            };
        });
        shortcut_states.getState().fetch(config_.shortcut);
    },
    is_changed: (): boolean => {
        return Object.keys(get().changed_preference).length > 0;
    },
    get_property: (): KawaiPreference => {
        const mereged_config = {};
        lodash.merge(mereged_config, get().perference);
        lodash.merge(mereged_config, get().changed_preference);
        return mereged_config;
        // return { ...get().perference, ...get().changed_preference };
    },
    set_property: (path: string, new_value: any) => {
        const func_Get = (key_list: string[], pref: KawaiPreference) => {
            const keys = key_list;
            if (keys.length === 0) {
                return pref;
            }
            var tmp = pref;
            if (keys.length > 1) {
                keys.forEach((v, i) => {
                    if (typeof tmp[v] === 'undefined') tmp[v] = {};
                    tmp = tmp[v] as any;
                });
            }
            return tmp;
        };
        const has_key = (key_list: string[], pref: KawaiPreference) => {
            let elem = pref;
            for (const key of key_list) {
                elem = elem[key] as any;
                if (elem == null) return false;
            }
            return true;
        };
        const func_delete = (key_list: string[], pref: KawaiPreference) => {
            if (key_list.length === 1) {
                delete pref[key_list[0]];
                return;
            } else if (key_list.length === 0) {
                return;
            }
            let sep_ = 0;
            let target = pref;
            for (let i = 0; i < key_list.length - 1; i++) {
                target = target[key_list[i]!] as any;
                if (
                    Object.keys(target! as any).filter((v) => v !== 'name')
                        .length === 1
                ) {
                    log.info(
                        Object.keys(target! as any).filter((v) => v !== 'name'),
                    );
                    log.info('continue', key_list[i]);
                    continue;
                } else {
                    log.info(
                        Object.keys(target! as any).filter((v) => v !== 'name'),
                    );
                    log.info('sep', i + 1);
                    sep_ = i + 1;
                }
            }
            let elem: any = pref;
            for (const key of key_list.slice(0, sep_)) {
                elem = elem[key];
            }
            delete elem[key_list[sep_]];
        };

        //TODO If the new value is equal to the old value, remove the modified preference item.
        set(
            produce((state: PreferenceState) => {
                const keys = path.split('.');
                const full_keys = lodash.cloneDeep(keys);
                log.info(keys.length);
                if (keys.length === 0) {
                    return;
                }
                const target_key = keys.pop();
                // const key = keys.pop();
                var old_preference = func_Get(keys, state.perference) as any;

                if (old_preference[target_key!] === new_value) {
                    if (has_key(full_keys, state.changed_preference)) {
                        func_delete(full_keys, state.changed_preference);
                    }
                } else {
                    const test = func_Get(
                        keys,
                        state.changed_preference,
                    ) as any;
                    test[target_key!] = new_value;
                }
            }),
        );
        const keys = path.split('.');

        shortcut_states.getState().fetch(get().get_property().shortcut);
    },
});

export const config_states = create<PreferenceState>(context);

/////////////////////////////////////////////////////////////////////

type Presets = {
    available_window_size_list: Array<any>;
    available_monitor_list: Array<any>;
    available_pip_window_size_list: Array<any>;
    available_locale_list: Array<any>;
    available_site_list: Array<any>;
    available_pip_location_list: Array<any>;
    fetch: () => Promise<void>;
};

export const preset_data = create<Presets>((set, get) => ({
    available_window_size_list: [],
    available_monitor_list: [],
    available_locale_list: [],
    available_site_list: [],
    available_pip_window_size_list: [],
    available_pip_location_list: [],
    fetch: async () => {
        const available_window_size_list =
            await window.KAWAI_API.preference.load_available_window_size_list();
        const available_monitor_list =
            await window.KAWAI_API.preference.load_available_monitor_list();
        const available_pip_window_size_list =
            await window.KAWAI_API.preference.load_available_pip_window_size_list();
        const available_locale_list =
            await window.KAWAI_API.preference.load_available_locale_list();
        const available_site_list =
            await window.KAWAI_API.preference.load_available_site_list();
        const available_pip_location_list =
            await window.KAWAI_API.preference.load_available_pip_location_list();
        set((state) => ({
            ...state,
            available_window_size_list: [...available_window_size_list],
            available_monitor_list: [...available_monitor_list],
            available_locale_list: [...available_locale_list],
            available_site_list: [...available_site_list],
            available_pip_window_size_list: [...available_pip_window_size_list],
            available_pip_location_list: [...available_pip_location_list],
        }));
    },
}));
