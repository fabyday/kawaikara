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
            dark_mode: { value: false },
            default_main: { id: { value: 'main' } },
            enable_autoupdate: { value: true },
            render_full_size_when_pip_running: { value: true },
            window_preference: {
                pip_location: { value: 'top-right' },
                pip_window_size: {
                    x: { value: 300 },
                    y: { value: 400 },
                    height: { value: 300 },
                    width: { value: 400 },
                },
                window_size: { height: { value: 720 }, width: { value: 1280 } },
            },
        },
        locale: {
            selected_locale: { value: 'EN' },
        },
        shortcut: {
            goto_netflix: { shortcut_key: '' },
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
    favorites: {},
    version: { value: '2.0.0' },
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
    version: { name: 'Version' },
    locale_meta: { filename: 'EN', metaname: 'eng', version: '2.0.0' },
    system_literal: {
        menu_main: 'Kawai Main',
        menu_netflix: 'Netflix',
        menu_laftel: 'Laftel',
        menu_disneyplus: 'Disney',
        menu_youtube: 'Youtube',
        menu_amazonprime: 'Amazon Prime',
        menu_wavve: 'Wavve',
        menu_watcha: 'Watcha',
        menu_coupangplay: 'Coupang Play',
        menu_tving: 'Tving',
        menu_applemusic: 'Apple Music',
        menu_chzzk: 'Chzzk',
        menu_twitch: 'Twitch',
        menu_info: 'Info',
        menu_preference: 'Preference',
        menu_checkupdate: 'Update Check',
        menu_github: 'Github',
        menu_discord: 'Discord',
    },
};
