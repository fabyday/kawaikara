import { connect } from 'http2';
import { KawaiAbstractSiteDescriptor } from '../definitions/SiteDescriptor';
import {
    registerKawaiSiteDescriptor,
    connectToMenu as connectToMenu,
    connectToShortcut,
} from '../logics/register';
import { script_root_path } from '../component/constants';
import path from 'path';
import { log } from '../logging/logger';
import * as fs from 'fs';
import { net } from 'electron';

@connectToShortcut('goto_netflix')
@connectToMenu('menu_netflix')
@registerKawaiSiteDescriptor
export class KawaiNetflixDesc extends KawaiAbstractSiteDescriptor {
    id: string = 'netflix';
    category: string | undefined = 'ott';
    shortcut_id: string = 'goto_netflix';

    onBeforeSendHeaders(detail: Electron.OnBeforeSendHeadersListenerDetails) {}

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://netflix.com/');
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
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://youtube.com/');
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
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.coupangplay.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.coupangplay.com/favicon.ico';
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
        browser.loadURL('https://www.twitch.tv/', {
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        });
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
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://chzzk.naver.com/', {
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        });

        //add free scripts
        net.fetch(
            'https://raw.githubusercontent.com/krkarma777/UltraFastAdSkipperFromCHZZK/main/CHZZK-Ad-Blocker.user.js',
        )
            .then((response) => response.text())
            .then((script) => {
                browser.webContents.once('did-finish-load', () => {
                    browser.webContents.executeJavaScript(script);
                });
                log.info('load scripts succ');
            })
            .catch(() => {
                log.info('error when download script.');
            });
    }

    LoadFaviconUrl(): string {
        return 'https://chzzk.naver.com/favicon.ico';
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
        browser.webContents.executeJavaScript(
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
        let html_path = path.resolve(script_root_path, './pages/main.html');
        browser.loadURL(
            process.env.IS_DEV ? 'http://localhost:3000/main.html' : html_path,
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
