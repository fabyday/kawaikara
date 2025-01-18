import { create } from 'zustand';
import produce from 'immer';
import {
    KawaiConfig,
    KawaiPreference,
    KawaiShortcut,
    KawaiShortcutCollection,
} from '../../typescript_src/definitions/setting_types';

import * as lodash from 'lodash';

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
        if(Object.keys(get().shortcut_dups).length === 0 )
            return false;
        return Object.values(get().shortcut_dups).reduce((p, c) => {
            return p || c;
        });
    },
    check_duplication: (shortcut_id: string) => {
        console.log('dups');
        console.log(shortcut_id);
        console.log((get().shortcut_dups as any)[shortcut_id]);
        return (get().shortcut_dups as any)[shortcut_id] ?? true;
    },
    fetch: (shortcut_collection?: KawaiShortcutCollection) => {
        console.log('F!etched');
        if (typeof shortcut_collection === 'undefined') {
            return; // do nothing.
        }
        let skeys = Object.keys(shortcut_collection);
        skeys = skeys.filter((value) => {
            return value !== 'name';
        });
        console.log(skeys);
        const shortcut_key_id_map = {} as any;
        skeys.forEach((id) => {
            const shortcut =
                (shortcut_collection[id] as KawaiShortcut).shortcut_key ?? '';
            console.log('key', shortcut);
            if (shortcut !== '') {
                console.log('shortcut_key_id_map', shortcut_key_id_map);
                if (typeof shortcut_key_id_map[shortcut] === 'undefined') {
                    shortcut_key_id_map[shortcut] = new Set<string>();
                }

                shortcut_key_id_map[shortcut].add(id);
                console.log('shortcut_key_id_map', shortcut_key_id_map);
                console.log(
                    'shortcut_key_id_map',
                    shortcut_key_id_map[shortcut],
                );
            }
        });
        console.log(skeys);

        const result = {} as any;
        skeys.forEach((id) => (result[id] = false));
        Object.keys(shortcut_key_id_map).forEach((sk) => {
            console.log('res', sk);
            console.log('res', shortcut_key_id_map[sk]);
            for (let name of shortcut_key_id_map[sk]) {
                result[name] = shortcut_key_id_map[sk].size > 1 ? true : false;
            }
        });
        console.log('res', result);
        set((state) => ({ ...state, shortcut_dups: { ...result } }));
        console.log(get().shortcut_dups, 'Asdads');
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
        const locale = await window.KAWAI_API.preference.load_locale();
        console.log(config_);
        console.log(locale);
        set((state) => {
            return { ...state, perference: { ...config_, ...locale } };
        });
        // const shortcut_dups_fetch = shortcut_states(state=>state.fetch)
        // shortcut_dups_fetch(get().perference.shortcut)
        console.log('test');
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
                return;
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
        //TODO If the new value is equal to the old value, remove the modified preference item.
        set(
            produce((state: PreferenceState) => {
                const keys = path.split('.');
                if (keys.length === 0) {
                    return;
                }

                const key = keys.pop();
                var old_preference = func_Get(keys, state.perference) as any;
                var new_preference = func_Get(
                    keys,
                    state.changed_preference,
                ) as any;
                // if(keys.length > 1){
                //     keys.forEach((v, i)=>{

                //         if(typeof tmp[v] === "undefined")
                //             tmp[v] = {};
                //         tmp = tmp[v] as any;
                //     })
                // }
                // tmp[key!]  = new_value;
                console.log(new_preference);
                if (old_preference[key!] === new_value) {
                    console.log('del', new_preference);
                    delete new_preference[key!];
                } else {
                    new_preference[key!] = new_value;
                    console.log('new val : ', new_preference);
                }
            }),
        );

        console.log('default : ', get().perference);
        console.log('check changed : ', get().changed_preference, 'changed');
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
