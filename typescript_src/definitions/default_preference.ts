import {
    KawaiConfig,
    KawaiConfigure,
    KawaiLocale,
    KawaiLocaleConfigure,
} from './setting_types';
export const config_name = 'kawai-config.json';

export const default_config: KawaiConfig = {
    preference: {
        general: {
            dark_mode: { value: true },
            default_main: { id: { value: '' } },
            enable_autoupdate: { value: true },
            render_full_size_when_pip_running: { value: true },
            window_preference: {
                pip_location: {},
                pip_window_size: {
                    x: { value: 300 },
                    y: { value: 400 },
                    height: { value: 300 },
                    width: { value: 400 },
                },
            },
        },
        locale: {
            selected_locale: { value: '' },
        },
        shortcut: {
            goto_netflix: { shortcut_key: 'lCtrl+L' },
            goto_laftel: { shortcut_key: '' },
            goto_youtube: { shortcut_key: '' },
            goto_disney: { shortcut_key: '' },
            goto_wavve: { shortcut_key: '' },
            goto_tving: { shortcut_key: '' },
            goto_twitch: { shortcut_key: '' },
            run_pip: { shortcut_key: '' },
            goto_applemusic: { shortcut_key: '' },
            goto_chzzk: { shortcut_key: '' },
            goto_amazonprime: { shortcut_key: '' },
        },
    },
    favorites: {
        values: [],
    },
    version: {value : "2.0.0"},
};


export const default_locale: KawaiLocale = {
    preference: {
        general: {
            dark_mode: { name: 'Dark Mode' },
            default_main: {
                name: 'Default Main Page',
                id: { name: 'Main Page' },
            },
            enable_autoupdate: { name: 'Enable Autoupdate' },
            render_full_size_when_pip_running: {
                name: 'render when pip running',
            },
            window_preference: {
                pip_location: {
                    monitor: { name: 'PiP Location' },
                },
                pip_window_size: {
                    name: 'PiP Window Size',
                    x: { name: 'X' },
                    y: { name: 'Y' },
                    width: { name: 'Width' },
                    height: { name: 'Height' },
                },
            },
        },
        locale: {
            name: 'Locale',
            selected_locale: { name: 'Selected Locale' },
        },
        shortcut: {
            name: 'Shortcut',
            goto_netflix: { name: 'netflix' },
            goto_laftel: { name: 'lafel' },
            goto_youtube: { name: 'youtube' },
            goto_disney: { name: 'disney' },
            goto_wavve: { name: 'wavve' },
            goto_tving: { name: 'tving' },
            goto_twitch: { name: 'twitch' },
            run_pip: { name: 'run pip' },
            goto_applemusic: { name: 'apple music' },
            goto_chzzk: { name: 'chzzk' },
            goto_amazonprime: { name: 'amazon prime' },
        },
    },
    version: { name : "2.0.0"},
    locale_meta: { filename: 'EN', metaname: 'eng' },
    system_literal : {
        main : "Kawai Main",
        netflix : "Netflix",
        laftel:"Laftel",
        disneyplus:"Disney",
        youtube:"Youtube",
        amazonprime : "Amazon Prime",
        wavve : "Wavve",
        watcha : "Watcha",
        coupangplay : "Coupang Play",
        tving : "Tving",
        applemusic : "Apple Music",
        chzzk : "Chzzk",
        twitch : "Twitch",
    }
};
