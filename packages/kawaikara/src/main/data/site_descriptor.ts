import { connect } from 'http2';
import {
    KawaiAbstractSiteDescriptor,
    KawaikaraViewAction,
} from '../definitions/SiteDescriptor';
import {
    registerKawaiSiteDescriptor,
    connectToMenu as connectToMenu,
    connectToShortcut,
} from '../logics/register';
import {
    data_root_path,
    download_root_path,
    project_root,
    script_root_path,
    third_party_bin_path,
} from '../component/constants';
import path from 'path';
import { log } from '../logging/logger';
import * as fs from 'fs/promises';
import { ipcMain, session, shell } from 'electron';
import { spawn } from 'child_process';
import { KAWAI_API_LITERAL } from '../definitions/api';
import { Domain } from 'domain';
import {
    convertPlayWrightCookieToElectron,
    getValidCookieFile,
} from '../logics/cookies';
import { KawaiYoutuebeBgChild } from '../definitions/bg_task';
import { KawaiBgTaskManager } from '../manager/background_task_manager';
import { cvrt_electron_path } from '../logics/path';
import {
    closeAllExtenalBrowser,
    closeOnTargetURL,
    launchExternalBrowser,
    setExternalBrowserDataPath,
} from '../component/externalBrowser';
import { Page } from 'patchright';
import { KawaiViewManager } from '../manager/view_manager';

const STREAMING_VIEWER_USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const CHZZK_AD_REQUEST_PATTERNS = [
    /:\/\/[^/?#]*tvetamovie\.pstatic\.net\//i,
    /:\/\/[^/?#]*glad-vod\.pstatic\.net\//i,
];

const SOOP_AD_REQUEST_PATTERNS = [
    /:\/\/(?:[^/?#]+\.)?(?:adballoon|adtime|pa|deapi|reqde|windroloxy)\.(?:afreecatv|sooplive)\./i,
    /:\/\/ad\.(?:afreecatv|sooplive)\./i,
    /vod-player\.afreecatv\.com\/creatives\/media\//i,
    /\/v\d+\/hls\/creatives\/media\//i,
    /\/creatives\/media\//i,
];

const CHZZK_QUALITY_LABEL_SCRIPT = String.raw`
(() => {
    const KEY = '__KAWAI_CHZZK_QUALITY_LABEL__';
    const patchQualityLabel = () => {
        const qualityItems = document.querySelectorAll(
            'div.pzp-setting-quality-pane > div:nth-child(2) > ul > li',
        );

        for (const item of qualityItems) {
            if (!item.textContent || !item.textContent.includes('480p')) {
                continue;
            }

            const label = item.querySelector('li > div:nth-child(2) > span > div');
            if (!label || label.dataset.kawaiQualityPatched === 'true') {
                continue;
            }

            label.dataset.kawaiQualityPatched = 'true';
            label.innerHTML =
                '<span class="pzp-pc-ui-setting-quality-item__prefix">1080p&nbsp;<div class="pzp-ui-track-badge"><em style="vertical-align:super;" class="pzp-ui-track-badge__badge">Kawaikara</em></div></span>';
        }
    };

    if (window[KEY]) {
        window[KEY].patchQualityLabel();
        return;
    }

    const observer = new MutationObserver(patchQualityLabel);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window[KEY] = { observer, patchQualityLabel };
    patchQualityLabel();
})();
`;

const CHZZK_AD_SKIPPER_SCRIPT = String.raw`
(() => {
    const KEY = '__KAWAI_CHZZK_AD_SKIPPER__';
    if (window[KEY]) {
        window[KEY].scan();
        return;
    }

    const adUrlPatterns = [
        /tvetamovie\.pstatic\.net/i,
        /glad-vod\.pstatic\.net/i,
    ];
    const adEventTypes = new Set([
        'AdStarted',
        'AdPlaying',
        'AdBreakReady',
        'AdRemainingTimeChange',
        'ContentPauseRequested',
    ]);
    const videoEvents = [
        'loadedmetadata',
        'loadeddata',
        'durationchange',
        'play',
        'playing',
        'ratechange',
        'timeupdate',
    ];

    let forceSkipUntil = 0;

    const getVideoUrl = (video) =>
        [video.currentSrc, video.src].filter(Boolean).join(' ');

    const isAdUrl = (url) => !!url && adUrlPatterns.some((pattern) => pattern.test(url));

    const isShortFiniteVideo = (video) =>
        Number.isFinite(video.duration) && video.duration > 0 && video.duration < 300;

    const shouldSkipVideo = (video) => {
        if (isAdUrl(getVideoUrl(video))) {
            return true;
        }

        return Date.now() < forceSkipUntil && isShortFiniteVideo(video);
    };

    const runSafely = (fn) => {
        try {
            return fn();
        } catch {
            return undefined;
        }
    };

    const skipVideo = (video) => {
        runSafely(() => {
            video.muted = true;
            video.volume = 0;
        });
        runSafely(() => {
            if (video.playbackRate < 16) {
                video.playbackRate = 16;
            }
        });
        runSafely(() => {
            if (Number.isFinite(video.duration) && video.duration > 0) {
                video.currentTime = Math.min(
                    video.duration,
                    Math.max(video.currentTime + 10, video.duration - 0.05),
                );
            } else if (video.seekable && video.seekable.length > 0) {
                video.currentTime = video.seekable.end(video.seekable.length - 1);
            } else {
                video.currentTime += 10;
            }
        });
        runSafely(() => {
            const playResult = video.play();
            if (playResult && typeof playResult.catch === 'function') {
                playResult.catch(() => {});
            }
        });
    };

    const evaluateVideo = (video) => {
        if (shouldSkipVideo(video)) {
            skipVideo(video);
        }
    };

    const watchVideo = (video) => {
        if (!video || video.dataset.kawaiChzzkAdWatched === 'true') {
            return;
        }

        video.dataset.kawaiChzzkAdWatched = 'true';
        for (const eventName of videoEvents) {
            video.addEventListener(eventName, () => evaluateVideo(video), true);
        }
        evaluateVideo(video);
    };

    const scan = () => {
        for (const video of document.querySelectorAll('video')) {
            watchVideo(video);
            evaluateVideo(video);
        }
    };

    const trySkipAdTarget = (target) => {
        const candidates = [
            target,
            target && target.currentAd,
            target && target._currentAd,
            target && target.ad,
            target && target._ad,
            target && target._client,
            target && target._client && target._client.currentAd,
        ].filter(Boolean);

        for (const candidate of candidates) {
            for (const methodName of ['skipAd', 'skip', 'stopAd']) {
                const method = candidate && candidate[methodName];
                if (typeof method !== 'function') {
                    continue;
                }

                runSafely(() => {
                    const result = method.call(candidate);
                    if (result && typeof result.catch === 'function') {
                        result.catch(() => {});
                    }
                });
            }
        }
    };

    const triggerAdSkip = (target) => {
        forceSkipUntil = Date.now() + 15000;
        trySkipAdTarget(target);
        scan();
    };

    const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (event) {
        if (event && adEventTypes.has(event.type)) {
            window.setTimeout(() => triggerAdSkip(this), 0);
        }

        return originalDispatchEvent.call(this, event);
    };

    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src'],
    });

    const interval = window.setInterval(scan, 500);
    window[KEY] = { observer, interval, scan };
    scan();
})();
`;

const SOOP_AD_SKIPPER_SCRIPT = String.raw`
(() => {
    const KEY = '__KAWAI_SOOP_AD_SKIPPER__';
    if (window[KEY]) {
        window[KEY].scan();
        return;
    }

    const adUrlPatterns = [
        /\/creatives\/media\//i,
        /adballoon\.(afreecatv|sooplive)\./i,
        /adtime\.(afreecatv|sooplive)\./i,
        /:\/\/ad\.(afreecatv|sooplive)\./i,
    ];
    const adEventTypes = new Set([
        'AdStarted',
        'AdPlaying',
        'AdBreakReady',
        'AdRemainingTimeChange',
        'ContentPauseRequested',
    ]);
    const removableSelectors = [
        '#adVideo',
        '#videoLayerCover',
        '.promotion_area',
        '.promotion_area_left',
        '.promotion_area_right',
        '.text_output',
    ];
    const videoEvents = [
        'loadedmetadata',
        'loadeddata',
        'durationchange',
        'play',
        'playing',
        'timeupdate',
    ];

    let forceSkipUntil = 0;

    const runSafely = (fn) => {
        try {
            return fn();
        } catch {
            return undefined;
        }
    };

    const getVideoUrl = (video) =>
        [video.currentSrc, video.src].filter(Boolean).join(' ');

    const isAdUrl = (url) => !!url && adUrlPatterns.some((pattern) => pattern.test(url));

    const isShortFiniteVideo = (video) =>
        Number.isFinite(video.duration) && video.duration > 0 && video.duration < 300;

    const shouldSkipVideo = (video) => {
        if (video.id === 'adVideo' || isAdUrl(getVideoUrl(video))) {
            return true;
        }

        return Date.now() < forceSkipUntil && isShortFiniteVideo(video);
    };

    const dispatchMediaDone = (video) => {
        for (const eventName of ['timeupdate', 'ended', 'durationchange']) {
            runSafely(() => video.dispatchEvent(new Event(eventName)));
        }
    };

    const skipVideo = (video) => {
        runSafely(() => {
            video.muted = true;
            video.volume = 0;
        });
        runSafely(() => {
            if (video.playbackRate < 16) {
                video.playbackRate = 16;
            }
        });
        runSafely(() => {
            if (Number.isFinite(video.duration) && video.duration > 0) {
                video.currentTime = Math.min(
                    video.duration,
                    Math.max(video.currentTime + 10, video.duration - 0.05),
                );
            } else if (video.seekable && video.seekable.length > 0) {
                video.currentTime = video.seekable.end(video.seekable.length - 1);
            } else {
                video.currentTime += 10;
            }
        });

        if (video.id === 'adVideo') {
            runSafely(() => {
                video.removeAttribute('src');
                video.src = '';
                video.load();
            });
            dispatchMediaDone(video);
        }
    };

    const hideAdChrome = () => {
        for (const selector of removableSelectors) {
            for (const element of document.querySelectorAll(selector)) {
                runSafely(() => {
                    element.style.setProperty('display', 'none', 'important');
                    element.style.setProperty('visibility', 'hidden', 'important');
                });
            }
        }
    };

    const evaluateVideo = (video) => {
        if (shouldSkipVideo(video)) {
            skipVideo(video);
        }
    };

    const watchVideo = (video) => {
        if (!video || video.dataset.kawaiSoopAdWatched === 'true') {
            return;
        }

        video.dataset.kawaiSoopAdWatched = 'true';
        for (const eventName of videoEvents) {
            video.addEventListener(eventName, () => evaluateVideo(video), true);
        }
        evaluateVideo(video);
    };

    const scan = () => {
        hideAdChrome();
        for (const video of document.querySelectorAll('video')) {
            watchVideo(video);
            evaluateVideo(video);
        }
    };

    const trySkipAdTarget = (target) => {
        const candidates = [
            target,
            target && target.currentAd,
            target && target._currentAd,
            target && target.ad,
            target && target._ad,
            target && target._client,
            target && target._client && target._client.currentAd,
        ].filter(Boolean);

        for (const candidate of candidates) {
            for (const methodName of ['skipAd', 'skip', 'stopAd']) {
                const method = candidate && candidate[methodName];
                if (typeof method !== 'function') {
                    continue;
                }

                runSafely(() => {
                    const result = method.call(candidate);
                    if (result && typeof result.catch === 'function') {
                        result.catch(() => {});
                    }
                });
            }
        }
    };

    const triggerAdSkip = (target) => {
        forceSkipUntil = Date.now() + 15000;
        trySkipAdTarget(target);
        scan();
    };

    const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (event) {
        if (event && adEventTypes.has(event.type)) {
            window.setTimeout(() => triggerAdSkip(this), 0);
        }

        return originalDispatchEvent.call(this, event);
    };

    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'style', 'class'],
    });

    const interval = window.setInterval(scan, 500);
    window[KEY] = { observer, interval, scan };
    scan();
})();
`;

const SOOP_GRID_BYPASS_SCRIPT = String.raw`
(() => {
    const KEY = '__KAWAI_SOOP_GRID_BYPASS__';
    const state = window[KEY] || {};

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

    const patchCurrent = () => {
        try {
            if (window.LivePlayer) {
                patchLivePlayer(window.LivePlayer);
            }
            if (window.livePlayer) {
                forceHls(window.livePlayer);
            }

            const protocol =
                window.livePlayer &&
                window.livePlayer.streamConnector &&
                window.livePlayer.streamConnector.streamer &&
                window.livePlayer.streamConnector.streamer.streamer &&
                window.livePlayer.streamConnector.streamer.streamer.protocol;

            if (protocol === 'P2P_HLS' && !state.reloadedFromP2p) {
                state.reloadedFromP2p = true;
                window.livePlayer.reloadBroad(true);
            }
        } catch (_) {}
    };

    if (!state.interval) {
        state.interval = window.setInterval(patchCurrent, 1000);
        document.addEventListener('DOMContentLoaded', patchCurrent);
    }

    state.forceHls = forceHls;
    state.patchCurrent = patchCurrent;
    window[KEY] = state;
    patchCurrent();
})();
`;

function executeMainWorldScript(
    browser: Electron.BrowserWindow,
    script: string,
    label: string,
) {
    if (browser.isDestroyed() || browser.webContents.isDestroyed()) {
        return;
    }

    browser.webContents.executeJavaScript(script).catch((error) => {
        log.info(`${label} script injection failed`, error);
    });
}

@connectToShortcut('goto_netflix')
@connectToMenu('menu_netflix')
@registerKawaiSiteDescriptor
export class KawaiNetflixDesc extends KawaiAbstractSiteDescriptor {
    id: string = 'netflix';
    category: string | undefined = 'ott';
    shortcut_id: string = 'goto_netflix';

    _LoginBtnInjectFn: (() => void) | null = null;
    _customCallback: ((e: Electron.IpcMainEvent, tag: string) => void) | null =
        null;

    onBeforeSendHeaders(detail: Electron.OnBeforeSendHeadersListenerDetails) {}

    async _preload(view: Electron.BrowserWindow, action: KawaikaraViewAction) {
        const syncCookies = async (targetPage: Page) => {
            try {
                const cookies = await targetPage.context().cookies();
                // map보다는 for...of나 Promise.all을 써야 모든 쿠키가 세팅되는 것을 보장합니다.
                await Promise.all(
                    cookies.map(async (cookie) => {
                        const electronCookie =
                            await convertPlayWrightCookieToElectron(cookie);
                        return session.defaultSession.cookies.set(
                            electronCookie,
                        );
                    }),
                );
                console.log('Cookies synced to Electron successfully.');
            } catch (e) {
                console.error('Failed to sync cookies:', e);
            }
        };

        let html_path = cvrt_electron_path(
            path.resolve(script_root_path, './pages/redirect.html'),
        );
        view.loadURL(
                process.env.KAWAI_RENDERER_DEV_SERVER
                    ? 'http://localhost:3000/redirect.html'
                    : html_path,
        );
        const page = await launchExternalBrowser({
            persist: true,
            headless: false,
        });

        if (page) {
            closeOnTargetURL(
                page,
                /\/(browse)/,
                async (targetPage: Page) => {
                    await syncCookies(targetPage);
                    closeAllExtenalBrowser();
                    action.resume();
                },
                async (targetPage: Page) => {
                    closeAllExtenalBrowser();
                    action.resume();
                },
            );
        }
        try {
            await page?.goto('https://www.netflix.com/login');
            console.log('external launch');
        } catch (e) {
            console.log(`goto failed, ignore exception ${e}`);
        }

        await action.wait(async () => {
            console.log('abroted!!!');
            closeAllExtenalBrowser();
        });
    }

    _attachCustomCallbacks(browser: Electron.BrowserWindow) {
        this._LoginBtnInjectFn = () => {
            console.log('inject install');
            const loginAnchor = document.querySelector(
                'a[data-uia="header-login-link"]',
            ) as HTMLAnchorElement | undefined;

            if (loginAnchor && !loginAnchor.dataset.hack) {
                /**
                 * 1. CLONE NODE TO STRIP EVENT LISTENERS
                 * We clone the element to remove all existing event listeners attached by the original site.
                 * This is more reliable than stopPropagation() as it creates a "clean slate" element.
                 */
                const newAnchor = loginAnchor.cloneNode(
                    true,
                ) as HTMLAnchorElement;
                newAnchor.dataset.hack = `true`;
                /**
                 * 2. DISABLE DEFAULT NAVIGATION
                 * Setting href to 'javascript:void(0)' ensures the browser doesn't attempt
                 * to redirect or refresh the page, which often causes "Access Denied" errors
                 * or interrupts our custom logic.
                 */
                newAnchor.href = 'javascript:void(0)';

                newAnchor.addEventListener(
                    'click',
                    (e) => {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        console.log('ingoring click Event.');
                        if ((window as any).KAWAI_API) {
                            // @ts-ignore
                            window.KAWAI_API.custom.custom_callback(
                                'netflix:login',
                            );
                            console.log('load external coupang');
                        }
                    },
                    { capture: true },
                );

                newAnchor.style.setProperty(
                    'background-color',
                    '#FF00FF',
                    'important',
                );

                loginAnchor?.parentNode?.replaceChild(newAnchor, loginAnchor);
            }
        };
        // open external browwser
        this._customCallback = async (
            e: Electron.IpcMainEvent,
            tag: string,
        ) => {
            log.info('try to login netflix');
            if (tag.startsWith('netflix:login')) {
                console.log('test!!!');
                const controller =
                    KawaiViewManager.getInstance()._createController();
                await this._preload(browser, controller);
                browser.loadURL('https://www.netflix.com/');
                log.info('login netflix');
            }
        };

        ipcMain.on(
            KAWAI_API_LITERAL.custom.custom_callback,
            this._customCallback,
        );
        console.log(`(${this._LoginBtnInjectFn?.toString()})()`);
        browser.webContents.on('did-finish-load', async () => {
            console.log('attach inject code');
            browser.webContents.executeJavaScript(
                `(${this._LoginBtnInjectFn?.toString()})()`,
            );
        });
    }

    async loadUrl(browser: Electron.BrowserWindow) {
        this._attachCustomCallbacks(browser);
        browser.loadURL('https://netflix.com/');
    }

    async unload(browser: Electron.BrowserWindow): Promise<void> {
        await KawaiViewManager.getInstance()._abortCurrentController();
        if (this._LoginBtnInjectFn != null) {
            browser.webContents.removeListener(
                'did-finish-load',
                this._LoginBtnInjectFn,
            );
            this._LoginBtnInjectFn = null;
        }

        if (this._customCallback != null) {
            ipcMain.removeListener(
                KAWAI_API_LITERAL.custom.custom_callback,
                this._customCallback,
            );
            this._customCallback = null;
        }
    }
    LoadFaviconUrl(): string {
        return 'https://netflix.com/favicon.ico';
    }
}

@connectToShortcut('goto_laftel')
@connectToMenu('menu_laftel')
@registerKawaiSiteDescriptor
export class KawaiLaftelDesc extends KawaiAbstractSiteDescriptor {
    shortcut_id = 'goto_laftel';
    id = 'laftel';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://laftel.net/');
    }

    LoadFaviconUrl(): string {
        return 'https://static.laftel.net/favicon.ico';
    }

    // onNewWindowCreated(url: string): 'external' | 'open' | 'suppress' | 'basic' {
    //     return 'basic';
    // }
}

@connectToShortcut('goto_disney')
@connectToMenu('menu_disney')
@registerKawaiSiteDescriptor
export class KawaiDisneyDesc extends KawaiAbstractSiteDescriptor {
    id = 'disneyplus';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.disneyplus.com/');
    }
    LoadFaviconUrl(): string {
        return 'https://www.disneyplus.com/favicon.ico';
    }
}

@connectToShortcut('goto_youtube')
@connectToMenu('menu_youtube')
@registerKawaiSiteDescriptor
export class KawaiYoutubeDesc extends KawaiAbstractSiteDescriptor {
    id = 'youtube';

    event_: any = null; // add button callback
    event2_: any = null; // donwload callback

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://youtube.com/');

        this.event_ = async () => {
            log.info('apply this');
            await browser.webContents.executeJavaScript(`
                const observer = new MutationObserver((mutations) => {
    if (
        document.querySelector(
            'div.ytp-popup.ytp-contextmenu div.ytp-panel-menu',
        )
    ) {
        console.log('video 태그가 생성되었습니다!');

        const newItem = window.document.createElement('div');
        newItem.classList.add('ytp-menuitem');
        // 아이콘 생성
        const icon = window.document.createElement('div');
        icon.classList.add('ytp-menuitem-icon');

        // 라벨(텍스트) 생성
        const label = window.document.createElement('div');
        label.classList.add('ytp-menuitem-label');
        label.textContent = 'Download Video'; // ✅ Trusted DOM 정책을 위반하지 않음

        // 내용 생성
        const content = window.document.createElement('div');
        content.classList.add('ytp-menuitem-content');

        // 요소 추가
        newItem.appendChild(icon);
        newItem.appendChild(label);
        newItem.appendChild(content);
        newItem.onclick = (e) => {
            const ctxmenu = document.querySelector(
                'div.ytp-popup.ytp-contextmenu',
            );
            if (ctxmenu) {
                ctxmenu.style.display = 'none'; // 메뉴 닫기
            }
            // https://stackoverflow.com/questions/3452546/how-do-i-get-the-youtube-video-id-from-a-url
            const videoUrl = window.location.href;
            console.log(videoUrl)
            const yotube_regex =
            // \/^.*(?:(?:youtu\\.be\\/|v\\/|vi\/|u\\/\\w\\/|embed\\/|shorts\\/|live\\/)|(?:(?:watch)?\\?v(?:i)?=|\\&v(?:i)?=))([^#\\&\\?]*).*\/;
                 \/^.*(?:(?:youtu\.be\\/|v\\/|vi\\/|u\\/\\w\\/|embed\\/|shorts\\/|live\\/)|(?:(?:watch)?\\?v(?:i)?=|\\&v(?:i)?=))([^#\\&\\?]*).*\/;
            // this regex transform this https://www.youtube.com/watch?v=7qX8_vf7Yt4&ab_channel=%EB%AA%B0%EB%9D%BC as 7qX8_vf7Yt4;
            // if you want to create youtu.be link concat it yotu.be+"/"+7qX8_vf7Yt4
            console.log(videoUrl.match(yotube_regex)[1]);
            // 클릭 시 전파 방지 (필요한 경우)
            const url = videoUrl.match(yotube_regex)[1];
            e.stopPropagation();
            window.KAWAI_API.custom.custom_callback('youtube', url);
        };
        // get context panel code.
        const ctxmenu = window.document.querySelector(
            'div.ytp-popup.ytp-contextmenu div.ytp-panel-menu',
        );
        ctxmenu.appendChild(newItem);
        observer.disconnect(); // 감지가 완료되면 더 이상 감지할 필요 없으므로 중단
    }
});

// body 태그 아래의 모든 요소 변화를 감지
observer.observe(document.body, { childList: true, subtree: true });

                `);
            log.info('apply extention');
        };

        ((this.event2_ = async (
            e: Electron.IpcMainEvent,
            tag: string,
            youtube_video_tag: string,
        ) => {
            if (tag === 'youtube') {
                log.info(path.join(third_party_bin_path, 'yt-dlp'));
                try {
                    await fs.access(download_root_path);
                } catch {
                    await fs.mkdir(download_root_path, {
                        recursive: true,
                    });
                }

                log.info(path.resolve(data_root_path, './yt.txt'));
                const yt_cookie_pth = path.resolve(data_root_path, './yt.txt');
                const res = await getValidCookieFile(
                    '.youtube.com',
                    yt_cookie_pth,
                    'https://www.youtube.com/getAccountInfo',
                );

                switch (res.result) {
                    case 'success':
                        {
                            const bgtask = new KawaiYoutuebeBgChild(
                                'https://youtu.be/' + youtube_video_tag,
                                {
                                    merge_output_format: 'mp4',
                                    cookie_path: yt_cookie_pth,
                                    format: 'bestvideo+bestaudio',
                                    save_directory: download_root_path,
                                },
                            );

                            KawaiBgTaskManager.getInstance().registerBgTask(
                                bgtask,
                            );
                        }

                        break;
                    case 'fail':
                        break;
                }
            } else if (tag.startsWith('youtube:bg')) {
                const child_strings = tag.slice('youtube:bg'.length + 1);
            }
        }),
            ipcMain.on(KAWAI_API_LITERAL.custom.custom_callback, this.event2_));

        browser.webContents.on('did-finish-load', this.event_);
    }

    onNewWindowCreated(
        url: string,
    ): 'external' | 'open' | 'suppress' | 'basic' {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            if (
                /https?:\/\/(www\.)?youtube\.com\/(redirect\?|ads\/|pagead\/)/.test(
                    url,
                )
            ) {
                return 'external';
            }
            return 'open';
        } else {
            return 'external';
        }
    }

    async unload(browser: Electron.BrowserWindow): Promise<void> {
        if (this.event_ != null) {
            browser.webContents.removeListener('did-finish-load', this.event_);
        }
        if (this.event2_ != null) {
            ipcMain.removeListener(
                KAWAI_API_LITERAL.custom.custom_callback,
                this.event2_,
            );
        }
    }

    LoadFaviconUrl(): string {
        return 'https://youtube.com/favicon.ico';
    }
}
@connectToShortcut('goto_amazonprime')
@connectToMenu('menu_amazonprime')
@registerKawaiSiteDescriptor
export class KawaiAmazonPrimeDesc extends KawaiAbstractSiteDescriptor {
    id = 'amazonprime';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.primevideo.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.primevideo.com/favicon.ico';
    }
}
@connectToShortcut('goto_wavve')
@connectToMenu('menu_wavve')
@registerKawaiSiteDescriptor
export class KawaiWavveDesc extends KawaiAbstractSiteDescriptor {
    id = 'wavve';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.wavve.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.wavve.com/favicon.ico';
    }
}

@connectToShortcut('goto_watcha')
@connectToMenu('menu_watcha')
@registerKawaiSiteDescriptor
export class KawaiWatchaDesc extends KawaiAbstractSiteDescriptor {
    id = 'watcha';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://watcha.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://watcha.com/favicon.ico';
    }
}

@connectToShortcut('goto_coupangplay')
@connectToMenu('menu_coupangplay')
@registerKawaiSiteDescriptor
export class KawaiCoupangPlayDesc extends KawaiAbstractSiteDescriptor {
    id = 'coupangplay';
    _LoginBtnInjectFn: (() => void) | null = null;
    _customCallback: ((e: Electron.IpcMainEvent, tag: string) => void) | null =
        null;
    async loadUrl(browser: Electron.BrowserWindow) {
        this._LoginBtnInjectFn = () => {
            console.log('inject install');
            const loginAnchor = document.querySelector(
                'a[data-cy="loginBtn"]',
            ) as HTMLAnchorElement | undefined;

            if (loginAnchor && !loginAnchor.dataset.hack) {
                /**
                 * 1. CLONE NODE TO STRIP EVENT LISTENERS
                 * We clone the element to remove all existing event listeners attached by the original site.
                 * This is more reliable than stopPropagation() as it creates a "clean slate" element.
                 */
                const newAnchor = loginAnchor.cloneNode(
                    true,
                ) as HTMLAnchorElement;
                newAnchor.dataset.hack = `true`;
                /**
                 * 2. DISABLE DEFAULT NAVIGATION
                 * Setting href to 'javascript:void(0)' ensures the browser doesn't attempt
                 * to redirect or refresh the page, which often causes "Access Denied" errors
                 * or interrupts our custom logic.
                 */
                newAnchor.href = 'javascript:void(0)';

                newAnchor.addEventListener(
                    'click',
                    (e) => {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        console.log('ingoring click Event.');
                        if ((window as any).KAWAI_API) {
                            // @ts-ignore
                            window.KAWAI_API.custom.custom_callback(
                                'coupang:login',
                            );
                            console.log('load external coupang');
                        }
                    },
                    { capture: true },
                );

                const button = newAnchor?.querySelector('button');

                if (button) {
                    button.style.setProperty(
                        'background-color',
                        '#FF0000',
                        'important',
                    );
                }
                loginAnchor?.parentNode?.replaceChild(newAnchor, loginAnchor);
            }
        };
        // open external browwser
        this._customCallback = async (
            e: Electron.IpcMainEvent,
            tag: string,
        ) => {
            log.info('try to login coupang');
            if (tag.startsWith('coupang:login')) {
                console.log('test!!!');
                const controller =
                    KawaiViewManager.getInstance()._createController();
                await this.preload(browser, controller);
                browser.loadURL('https://www.coupangplay.com/');
                log.info('login coupang');
            }
        };

        ipcMain.on(
            KAWAI_API_LITERAL.custom.custom_callback,
            this._customCallback,
        );
        console.log(`(${this._LoginBtnInjectFn?.toString()})()`);
        browser.webContents.on('did-finish-load', async () => {
            console.log('attach inject code');
            browser.webContents.executeJavaScript(
                `(${this._LoginBtnInjectFn?.toString()})()`,
            );
        });

        browser.loadURL('https://www.coupangplay.com/');
    }

    async preload(
        view: Electron.BrowserWindow,
        action: KawaikaraViewAction,
    ): Promise<void> {
        const syncCookies = async (targetPage: Page) => {
            try {
                const cookies = await targetPage.context().cookies();
                // map보다는 for...of나 Promise.all을 써야 모든 쿠키가 세팅되는 것을 보장합니다.
                await Promise.all(
                    cookies.map(async (cookie) => {
                        const electronCookie =
                            await convertPlayWrightCookieToElectron(cookie);
                        return session.defaultSession.cookies.set(
                            electronCookie,
                        );
                    }),
                );
                console.log('Cookies synced to Electron successfully.');
            } catch (e) {
                console.error('Failed to sync cookies:', e);
            }
        };

        let html_path = cvrt_electron_path(
            path.resolve(script_root_path, './pages/redirect.html'),
        );
        view.loadURL(
                process.env.KAWAI_RENDERER_DEV_SERVER
                    ? 'http://localhost:3000/redirect.html'
                    : html_path,
        );
        // await setExternalBrowserDataPath('./useData');
        const page = await launchExternalBrowser({
            persist: true,
            headless: false,
        });

        if (page) {
            closeOnTargetURL(
                page,
                /\/(home|profile)/,
                async (targetPage: Page) => {
                    await syncCookies(targetPage);
                    closeAllExtenalBrowser();
                    action.resume();
                },
                async (targetPage: Page) => {
                    closeAllExtenalBrowser();
                    action.resume();
                },
            );
        }
        try {
            await page?.goto('https://www.coupangplay.com/');
            console.log('external launch');
        } catch (e) {
            console.log(`goto failed, ignore exception ${e}`);
        }

        await action.wait(async () => {
            console.log('abroted!!!');
            closeAllExtenalBrowser();
        });
        console.log('end!!!!');
    }

    LoadFaviconUrl(): string {
        return 'https://www.coupangplay.com/favicon.ico';
    }

    async unload(browser: Electron.BrowserWindow): Promise<void> {
        await KawaiViewManager.getInstance()._abortCurrentController();
        if (this._LoginBtnInjectFn != null) {
            browser.webContents.removeListener(
                'did-finish-load',
                this._LoginBtnInjectFn,
            );
            this._LoginBtnInjectFn = null;
        }

        if (this._customCallback != null) {
            ipcMain.removeListener(
                KAWAI_API_LITERAL.custom.custom_callback,
                this._customCallback,
            );
            this._customCallback = null;
        }
    }

    onBeforeSendHeaders(
        details: Electron.OnBeforeSendHeadersListenerDetails,
    ): void {
        details.requestHeaders['Sec-Ch-Ua'] =
            '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
        details.requestHeaders['User-Agent'] =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    }
}

@connectToShortcut('goto_tving')
@connectToMenu('menu_tving')
@registerKawaiSiteDescriptor
export class KawaiTvingDesc extends KawaiAbstractSiteDescriptor {
    id = 'tving';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.tving.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.tving.com/favicon.ico';
    }
}

@connectToShortcut('goto_twitch')
@connectToMenu('menu_twitch')
@registerKawaiSiteDescriptor
export class KawaiTwitchDesc extends KawaiAbstractSiteDescriptor {
    id = 'twitch';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.twitch.tv/');
    }

    LoadFaviconUrl(): string {
        return 'https://twitch.com/favicon.ico';
    }
}

@connectToShortcut('goto_appletv')
@connectToMenu('menu_appletv')
@registerKawaiSiteDescriptor
export class KawaiAppleTvDesc extends KawaiAbstractSiteDescriptor {
    id = 'appletv';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://tv.apple.com/', {
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        });
    }

    LoadFaviconUrl(): string {
        return 'https://tv.apple.com/favicon.ico';
    }
}
@connectToShortcut('goto_chzzk')
@connectToMenu('menu_chzzk')
@registerKawaiSiteDescriptor
export class KawaiChzzkDesc extends KawaiAbstractSiteDescriptor {
    id = 'chzzk';

    event_: any = null; // variable for anonymous event
    adfree_event: any = null;

    onBeforeRequest(details: Electron.OnBeforeRequestListenerDetails): {
        cancel?: boolean;
        redirectURL?: string;
    } {
        const url = details.url;

        if (CHZZK_AD_REQUEST_PATTERNS.some((pattern) => pattern.test(url))) {
            return { cancel: true };
        }

        if (/\.m3u8(?:\?|$)/.test(url) && url.includes('480p')) {
            return { redirectURL: url.replace(/480p/g, '1080p') };
        }

        return {};
    }

    async loadUrl(browser: Electron.BrowserWindow) {
        this.event_ = () => {
            executeMainWorldScript(
                browser,
                CHZZK_AD_SKIPPER_SCRIPT,
                'chzzk ad skipper',
            );
        };
        this.adfree_event = () => {
            executeMainWorldScript(
                browser,
                CHZZK_QUALITY_LABEL_SCRIPT,
                'chzzk quality label',
            );
        };

        browser.webContents.on('dom-ready', this.event_);
        browser.webContents.on('did-finish-load', this.event_);
        browser.webContents.on('did-navigate-in-page', this.event_);
        browser.webContents.on('dom-ready', this.adfree_event);
        browser.webContents.on('did-finish-load', this.adfree_event);
        browser.webContents.on('did-navigate-in-page', this.adfree_event);

        browser.loadURL('https://chzzk.naver.com/', {
            userAgent: STREAMING_VIEWER_USER_AGENT,
        });

        /*
        browser.webContents.executeJavaScript(`
            
            var FCG_attempt = 0;

console.log("[FUCK CHZZK GRID] script inject!");

function changeText() {
    if (FCG_attempt > 5) {
        console.log("[FUCK CHZZK GRID] Failed to inject - element not found");
        return;
    }
    FCG_attempt++;
    let qualitys = document.querySelectorAll(
        "div.pzp-setting-quality-pane > div:nth-child(2) > ul > li"
    );
    let qualityElement;
    // 480p 텍스트 찾기
    for (let i = 0; i < qualitys.length; i++) {
        let e = qualitys[i];
        if (e.innerText.trim().includes("480p")) {
            qualityElement = e;
            break;
        }
    }
    let video = document.querySelector(
        "div[class^='live_information_details']"
    );

    if (!!video && !!qualityElement) {
        qualityElement.querySelector(
            "li > div:nth-child(2) > span > div"
        ).innerHTML =
            '<span class="pzp-pc-ui-setting-quality-item__prefix">1080p&nbsp;<div class="pzp-ui-track-badge"><em style="vertical-align:super;" class="pzp-ui-track-badge__badge">with FUCK GRID™</em> <!----></div></span>';
        console.log("[FUCK CHZZK GRID] inject complete!");
    } else setTimeout(changeText, 500);



    console.log("script done")
}

changeText();
            `);

        //add free scripts
        net.fetch(
            'https://raw.githubusercontent.com/krkarma777/UltraFastAdSkipperFromCHZZK/main/CHZZK-Ad-Blocker.user.js',
        )
            .then((response) => response.text())
            .then((script) => {
                this.event_ = () => {
                    browser.webContents.executeJavaScript(script);
                };
                browser.webContents.on('did-finish-load', this.event_);
                log.info('load scripts succ');
            })
            .catch(() => {
                log.info('error when download script.');
            });
        */
    }

    async unload(browser: Electron.BrowserWindow): Promise<void> {
        if (this.event_ != null) {
            browser.webContents.removeListener('dom-ready', this.event_);
            browser.webContents.removeListener('did-finish-load', this.event_);
            browser.webContents.removeListener(
                'did-navigate-in-page',
                this.event_,
            );
            this.event_ = null;
        }
        if (this.adfree_event != null) {
            browser.webContents.removeListener('dom-ready', this.adfree_event);
            browser.webContents.removeListener(
                'did-finish-load',
                this.adfree_event,
            );
            browser.webContents.removeListener(
                'did-navigate-in-page',
                this.adfree_event,
            );
            this.adfree_event = null;
        }
    }

    LoadFaviconUrl(): string {
        return 'https://chzzk.naver.com/favicon.ico';
    }
}

// @connectToShortcut('goto_soop')
// @connectToMenu('menu_soop')
// @registerKawaiSiteDescriptor
// export class KawaiSoopDesc extends KawaiAbstractSiteDescriptor {
//     id = 'soop';

//     onBeforeRequest(details: Electron.OnBeforeRequestListenerDetails): {
//         cancel?: boolean;
//         redirectURL?: string;
//     } {
//         function changeResolutionIfExists(
//             url: string,
//             newResolution: string,
//         ): string | null {
//             // Check if the resolution exists in the URL
//             if (url.includes('960x540')) {
//                 // If it exists, replace 480p with the new resolution
//                 return url.replace('960x540', `${newResolution}`);
//             } else if (url.includes('640x360')) {
//                 return url.replace('640x360', `${newResolution}`);
//             } else {
//                 // If it doesn't exist, return the original URL
//                 // console.log('Resolution 480p not found in URL.');
//                 return null;
//             }
//         }
//         const url = details.url;
//         if (!url.includes('preview')) {
//             const new_url = changeResolutionIfExists(url, '640x360');
//             if (new_url == null) {
//                 return {};
//             }
//             return { redirectURL: new_url };
//         } else {
//             return {};
//         }
//     }

//     async loadUrl(browser: Electron.BrowserWindow) {
//         browser.loadURL('https://www.sooplive.co.kr/', {
//             userAgent:
//                 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
//         });
//     }

//     onBeforeSendHeaders(
//         details: Electron.OnBeforeSendHeadersListenerDetails,
//     ): void {
//         if (typeof details.url === 'undefined') {
//             return;
//         }
//         try {
//             if (details.url.includes('play.sooplive.co.kr')) {
//                 // details.requestHeaders['Referer'] = 'https://play.sooplive.co.kr'; // 원하는 Referer로 변경
//                 // details.requestHeaders['Origin'] = 'https://play.sooplive.co.kr'; // CORS 우회용 Origin 수정
//                 const pth = details.requestHeaders['path'];
//                 if (pth.includes('640x360')) {
//                     pth.replace('960x540', '1920x1080');
//                 } else if (pth.includes('960x540'))
//                     pth.replace('960x540', '1920x1080');
//                 details.requestHeaders['path'] = pth;
//             }
//         } catch (err) {
//             console.log(err);
//         }
//     }

//     LoadFaviconUrl(): string {
//         return 'https://www.sooplive.co.kr/favicon.ico';
//     }
// }

@connectToShortcut('goto_soop')
@connectToMenu('menu_soop')
@registerKawaiSiteDescriptor
export class KawaiSoopDesc extends KawaiAbstractSiteDescriptor {
    id = 'soop';

    event_: any = null;

    onBeforeRequest(details: Electron.OnBeforeRequestListenerDetails): {
        cancel?: boolean;
        redirectURL?: string;
    } {
        const url = details.url;
        if (SOOP_AD_REQUEST_PATTERNS.some((pattern) => pattern.test(url))) {
            return { cancel: true };
        }

        return {};
    }

    async loadUrl(browser: Electron.BrowserWindow) {
        this.event_ = () => {
            executeMainWorldScript(
                browser,
                SOOP_GRID_BYPASS_SCRIPT,
                'soop grid bypass',
            );
            executeMainWorldScript(
                browser,
                SOOP_AD_SKIPPER_SCRIPT,
                'soop ad skipper',
            );
        };

        browser.webContents.on('dom-ready', this.event_);
        browser.webContents.on('did-finish-load', this.event_);
        browser.webContents.on('did-navigate-in-page', this.event_);

        browser.loadURL('https://www.sooplive.com/', {
            userAgent: STREAMING_VIEWER_USER_AGENT,
        });
    }

    onNewWindowCreated(
        url: string,
    ): 'external' | 'open' | 'suppress' | 'basic' {
        if (/^https?:\/\/([^/]+\.)?(sooplive|afreecatv)\./i.test(url)) {
            return 'open';
        }

        return 'external';
    }

    async unload(browser: Electron.BrowserWindow): Promise<void> {
        if (this.event_ != null) {
            browser.webContents.removeListener('dom-ready', this.event_);
            browser.webContents.removeListener('did-finish-load', this.event_);
            browser.webContents.removeListener(
                'did-navigate-in-page',
                this.event_,
            );
            this.event_ = null;
        }
    }

    LoadFaviconUrl(): string {
        return 'https://res.sooplive.com/favicon.ico';
    }
}

@connectToShortcut('goto_applemusic')
@connectToMenu('menu_applemusic')
@registerKawaiSiteDescriptor
export class KawaiAppleMusicDesc extends KawaiAbstractSiteDescriptor {
    id = 'applemusic';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://music.apple.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://music.apple.com/favicon.ico';
    }
}

@connectToShortcut('goto_spotify')
@connectToMenu('menu_spotify')
@registerKawaiSiteDescriptor
export class KawaiSpotifyDesc extends KawaiAbstractSiteDescriptor {
    id = 'spotify';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://spotify.com');
    }

    LoadFaviconUrl(): string {
        return 'https://spotify.com/favicon.ico';
    }
}

@connectToShortcut('goto_youtubemusic')
@connectToMenu('menu_youtubemusic')
@registerKawaiSiteDescriptor
export class KawaiYoutubeMusicDesc extends KawaiAbstractSiteDescriptor {
    id = 'youtubemusic';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://music.youtube.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://music.youtube.com/favicon.ico';
    }

    async unload(browser: Electron.BrowserWindow) {
        // youtube music need to stop when change view.(I have no idea what reason it is)
        await browser.webContents.executeJavaScript(
            "window.document.querySelector('video').pause();",
        );
    }
}

@connectToShortcut('goto_main')
@connectToMenu('menu_main')
@registerKawaiSiteDescriptor
export class KawaiMainDesc extends KawaiAbstractSiteDescriptor {
    id = 'main';

    async loadUrl(browser: Electron.BrowserWindow) {
        let html_path = cvrt_electron_path(
            path.resolve(script_root_path, './pages/main.html'),
        );
        browser.loadURL(
            process.env.KAWAI_RENDERER_DEV_SERVER
                ? 'http://localhost:3000/main.html'
                : html_path,
        );
    }

    // LoadFaviconUrl(): string {
    //     return '';
    // }
}

@connectToShortcut('goto_crunchyroll')
@connectToMenu('menu_crunchyroll')
@registerKawaiSiteDescriptor
export class KawaiCrunchyrollDesc extends KawaiAbstractSiteDescriptor {
    id = 'crunchyroll';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.crunchyroll.com/');
    }

    LoadFaviconUrl(): string {
        return 'kawai://resources/icons/crunchyroll.png';
    }
}

// // TODO viewer html page is not ready.
// @connectToShortcut('goto_videoview')
// @connectToMenu('menu_videoview')
// @registerKawaiSiteDescriptor
// export class KawaiVideoViewDesc extends KawaiAbstractSiteDescriptor {
//     id = 'video';

//     async loadUrl(browser: Electron.BrowserWindow) {
//         let html_path = cvrt_electron_path(
//             path.resolve(script_root_path, './pages/videoview.html'),
//         );
//         browser.loadURL(
//             process.env.IS_DEV ? 'http://localhost:3000/videoview.html' : html_path,
//         );
//     }

//     LoadFaviconUrl(): string {
//         return 'kawai://resources/icons/crunchyroll.png';
//     }
// }
@connectToShortcut('goto_ridibooks')
@connectToMenu('menu_ridibooks')
@registerKawaiSiteDescriptor
export class KawaiRidibooksDesc extends KawaiAbstractSiteDescriptor {
    id = 'ridibooks';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://ridibooks.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://ridibooks.com/favicon.ico';
    }
}
