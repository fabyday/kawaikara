import { connect } from 'http2';
import { KawaiAbstractSiteDescriptor } from '../definitions/SiteDescriptor';
import {
    registerKawaiSiteDescriptor,
    connectToMenu as connectToMenu,
    connectToShortcut,
} from '../logics/register';
import { script_root_path } from '../component/constants';
import path from 'path';

@connectToShortcut('goto_netflix')
@connectToMenu('menu_netflix')
@registerKawaiSiteDescriptor
export class KawaiNetflixDesc extends KawaiAbstractSiteDescriptor {
    id: string = 'netflix';
    category: string | undefined = 'ott';
    shortcut_id: string = 'goto_netflix';

    onBeforeSendHeaders(detail: Electron.OnBeforeSendHeadersListenerDetails) {}

    loadUrl(browser: Electron.BrowserWindow) {
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
    category = 'ott';

    loadUrl(browser: Electron.BrowserWindow) {
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
    category = 'ott';
    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.disneyplus.com/');
    }
}
@connectToShortcut('goto_youtube')
@connectToMenu('menu_youtube')
@registerKawaiSiteDescriptor
export class KawaiYoutubeDesc extends KawaiAbstractSiteDescriptor {
    id = 'youtube';
    category = 'ott';
    loadUrl(browser: Electron.BrowserWindow) {
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

    loadUrl(browser: Electron.BrowserWindow) {
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
    loadUrl(browser: Electron.BrowserWindow) {
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
    loadUrl(browser: Electron.BrowserWindow) {
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
    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.coupangplay.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.coupangplay.com/favicon.ico';
    }
}

@connectToShortcut('goto_tving')
@connectToMenu('menu_tving')
@registerKawaiSiteDescriptor
export class KawaiTvingDesc extends KawaiAbstractSiteDescriptor {
    id = 'tving';

    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.tving.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.tving.com/favicon.ico';
    }
}

@connectToShortcut('goto_chzzk')
@connectToMenu('menu_chzzk')
@registerKawaiSiteDescriptor
export class KawaiChzzkDesc extends KawaiAbstractSiteDescriptor {
    id = 'chzzk';
    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.tving.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.tving.com/favicon.ico';
    }
}

@connectToShortcut('goto_applemusic')
@connectToMenu('menu_applemusic')
@registerKawaiSiteDescriptor
export class KawaiAppleMusicDesc extends KawaiAbstractSiteDescriptor {
    id = 'applemusic';

    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.tving.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.tving.com/favicon.ico';
    }
}



@connectToShortcut('goto_applemusic')
@connectToMenu('menu_applemusic')
@registerKawaiSiteDescriptor
export class KawaiMainDesc extends KawaiAbstractSiteDescriptor {
    id = 'applemusic';

    loadUrl(browser: Electron.BrowserWindow) {
        let html_path = path.resolve(script_root_path, './pages/main.html');
        browser.loadURL(process.env.IS_DEV
            ? 'http://localhost:3000/main.html'
            : html_path);
    }

    LoadFaviconUrl(): string {
        return 'https://www.tving.com/favicon.ico';
    }
}
