import { ContextBridge, contextBridge, ipcRenderer } from 'electron';

const SOOP_GRID_BYPASS_MAIN_WORLD_SCRIPT = String.raw`
(() => {
    const KEY = '__KAWAI_SOOP_GRID_BYPASS__';
    if (window[KEY]) {
        return;
    }

    const forceFalse = () => false;

    const defineValue = (target, key, value) => {
        try {
            Object.defineProperty(target, key, {
                configurable: true,
                writable: true,
                value,
            });
        } catch (_) {
            try {
                target[key] = value;
            } catch (_) {}
        }
    };

    const forceHls = (player) => {
        try {
            const PlayerCtor = window.LivePlayer || (player && player.constructor);
            const playerInfo =
                PlayerCtor && typeof PlayerCtor.getPlayerInfo === 'function'
                    ? PlayerCtor.getPlayerInfo()
                    : null;

            if (playerInfo) {
                defineValue(playerInfo, 'getIsSdkHls', forceFalse);
            }
        } catch (_) {}

        try {
            const streamer =
                player &&
                player.streamConnector &&
                player.streamConnector.streamer &&
                player.streamConnector.streamer.streamer;

            if (streamer) {
                streamer.hasSDKErrored = true;
                if (streamer.config && streamer.config.streamProtocol === 'P2P_HLS') {
                    streamer.config.streamProtocol = 'HLS';
                }
            }
        } catch (_) {}
    };

    const patchMethod = (prototype, methodName) => {
        const original = prototype && prototype[methodName];
        if (typeof original !== 'function' || original.__kawaiSoopGridPatched) {
            return;
        }

        const patched = function (...args) {
            forceHls(this);
            const result = original.apply(this, args);
            forceHls(this);

            if (result && typeof result.finally === 'function') {
                return result.finally(() => forceHls(this));
            }

            return result;
        };
        defineValue(patched, '__kawaiSoopGridPatched', true);
        defineValue(prototype, methodName, patched);
    };

    const patchLivePlayer = (LivePlayerCtor) => {
        if (typeof LivePlayerCtor !== 'function') {
            return LivePlayerCtor;
        }

        if (!LivePlayerCtor.__kawaiSoopGridPatched) {
            patchMethod(LivePlayerCtor.prototype, 'loadBroad');
            patchMethod(LivePlayerCtor.prototype, 'reloadBroad');
            patchMethod(LivePlayerCtor.prototype, 'changeQuality');
            patchMethod(LivePlayerCtor.prototype, 'moveBroad');
            patchMethod(LivePlayerCtor.prototype, 'loadOriginalBroad');
            defineValue(LivePlayerCtor, '__kawaiSoopGridPatched', true);
        }

        try {
            if (typeof LivePlayerCtor.getPlayer === 'function') {
                forceHls(LivePlayerCtor.getPlayer());
            }
            if (typeof LivePlayerCtor.getInstance === 'function') {
                forceHls(LivePlayerCtor.getInstance());
            }
        } catch (_) {}

        return LivePlayerCtor;
    };

    let currentLivePlayer = window.LivePlayer;
    try {
        Object.defineProperty(window, 'LivePlayer', {
            configurable: true,
            get() {
                return currentLivePlayer;
            },
            set(value) {
                currentLivePlayer = patchLivePlayer(value);
            },
        });
    } catch (_) {}

    const patchCurrent = () => {
        try {
            if (window.LivePlayer) {
                patchLivePlayer(window.LivePlayer);
            }
            if (window.livePlayer) {
                forceHls(window.livePlayer);
            }
        } catch (_) {}
    };

    window[KEY] = { forceHls, patchCurrent };
    patchCurrent();
    document.addEventListener('DOMContentLoaded', patchCurrent);
    window.setInterval(patchCurrent, 1000);
})();
`;

function injectMainWorldScript(source: string) {
    const script = document.createElement('script');
    script.textContent = source;
    const target = document.documentElement || document.head || document.body;
    if (!target) {
        window.addEventListener(
            'DOMContentLoaded',
            () => injectMainWorldScript(source),
            { once: true },
        );
        return;
    }

    target.appendChild(script);
    script.remove();
}

function injectSoopGridBypassScript() {
    if (!/(^|\.)sooplive\.com$|(^|\.)afreecatv\.com$/i.test(location.hostname)) {
        return;
    }

    injectMainWorldScript(SOOP_GRID_BYPASS_MAIN_WORLD_SCRIPT);
}

injectSoopGridBypassScript();

import {
    add_favorites_f,
    apply_preference_f,
    cancel_update_f,
    close_update_f,
    close_menu_f,
    close_preference_f,
    custom_callback_emitter,
    custom_callback_f,
    custom_invoke_f,
    custom_recv_callback_f,
    delete_favorites_list_f,
    get_version_f,
    install_update_f,
    keydown_f,
    keyup_f as keyup_f,
    load_available_locale_list_f,
    load_available_monitor_list_f,
    load_available_pip_location_list_f,
    load_available_pip_window_size_list_f,
    load_available_site_list_f,
    load_available_window_size_list_f,
    load_config_f,
    load_favorites_list_f,
    load_locale_f,
    load_menu_f,
    load_update_info_f,
    load_update_status_f,
    notify_config_update_f,
    notify_menu_update_f,
    notify_update_status_f,
    on_notify_menu_open_f,
    save_and_close_preference_f,
    select_menu_item_f,
    start_update_download_f,
    update_favorites_order_f,
} from './api';
import { KAWAI_API_LITERAL } from '../../definitions/api';

contextBridge.exposeInMainWorld('KAWAI_API', {
    preference: {
        apply_modified_preference: apply_preference_f,
        close: close_preference_f,
        save_and_close: save_and_close_preference_f,
        load_config: load_config_f,
        load_locale: load_locale_f,

        load_available_site_list: load_available_site_list_f,
        notify_config_update: notify_config_update_f,
        load_available_locale_list: load_available_locale_list_f,
        load_available_monitor_list: load_available_monitor_list_f,
        load_available_window_size_list: load_available_window_size_list_f,
        load_available_pip_window_size_list:
            load_available_pip_window_size_list_f,
        load_available_pip_location_list: load_available_pip_location_list_f,
    },
    menu: {
        // fovorites manipulation ops
        add_favorites: add_favorites_f,
        load_favorites_list: load_favorites_list_f,
        delete_favorites: delete_favorites_list_f,
        update_favorites_order: update_favorites_order_f,
        // load entire menu item.
        load_menu: load_menu_f,
        select_menu_item: select_menu_item_f,
        notify_menu_update: notify_menu_update_f,
        close: close_menu_f,

        on_notify_menu_status: on_notify_menu_open_f,
    },
    etc: {
        load_update_info: load_update_info_f,
        version: get_version_f,
    },
    update: {
        status: load_update_status_f,
        start_download: start_update_download_f,
        cancel: cancel_update_f,
        install: install_update_f,
        close: close_update_f,
        notify_status: notify_update_status_f,
    },
    custom: {
        custom_callback: custom_callback_f,
        custom_invoke: custom_invoke_f,
        custom_callback_recv: custom_recv_callback_f,
    },
});

// inject Keyboard hijacking
window.addEventListener('keydown', keydown_f);
window.addEventListener('keyup', keyup_f);

ipcRenderer.on(
    KAWAI_API_LITERAL.custom.custom_callback,
    async (event: Electron.IpcRendererEvent, ...args: any[]) => {
        const [name, ...remai_args] = args;
        custom_callback_emitter.emit(name, ...remai_args);
    },
);

import { applySpoofing, platforms } from './spoof';
const args = process.argv;
const spoofArg = args.find((arg) => arg.startsWith('--platform='));
const target = spoofArg ? spoofArg.split('=')[1] : 'windows';
console.log(target)
const target_literal = target as keyof typeof platforms;
applySpoofing(target_literal);
/// spoofing code
// preload.ts
// 반드시 tsconfig에 "dom" 타입 포함되어 있어야 함

// const spoofedUA =
//     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';

// Object.defineProperty(window.navigator, 'userAgent', {
//     get: () => spoofedUA,
// });

// Object.defineProperty(window.navigator, 'platform', {
//     get: () => 'Win32',
// });

// Object.defineProperty(window.navigator, 'userAgentData', {
//     get: () => ({
//         brands: [
//             { brand: 'Chromium', version: '122' },
//             { brand: 'Google Chrome', version: '122' },
//             { brand: 'Not-A.Brand', version: '99' },
//         ],
//         mobile: false,
//         platform: 'Windows',
//         getHighEntropyValues: async (hints: string[]) => {
//             const data: Record<string, string | boolean | object[]> = {
//                 architecture: 'x86',
//                 model: '',
//                 platform: 'Windows',
//                 platformVersion: '10.0.0',
//                 uaFullVersion: '122.0.0.0',
//                 fullVersionList: [
//                     { brand: 'Chromium', version: '122.0.0.0' },
//                     { brand: 'Google Chrome', version: '122.0.0.0' },
//                     { brand: 'Not-A.Brand', version: '99.0.0.0' },
//                 ],
//                 bitness: '64',
//                 wow64: false,
//             };
//             const result: Record<string, any> = {};
//             hints.forEach((key) => {
//                 result[key] = data[key];
//             });
//             return result;
//         },
//     }),
// });
