import {
    KawaiAbstractSiteDescriptor,
    registerKawaiSiteDescriptor,
} from '../definitions/SiteDescriptor';

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

@registerKawaiSiteDescriptor
export class KawaiLaftelDesc extends KawaiAbstractSiteDescriptor {
    shortcut_id = 'goto_laftel';
    id = 'laftel';
    category = 'ott';

    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://laftel.net/');
    }

    LoadFaviconUrl(): string {
        return 'https://laftel.net/favicon.ico';
    }
}

@registerKawaiSiteDescriptor
export class KawaiDisneyDesc extends KawaiAbstractSiteDescriptor {
    shortcut_id = 'goto_disney';
    id = 'disneyplus';
    category = 'ott';
    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.disneyplus.com/');
    }
}

@registerKawaiSiteDescriptor
export class KawaiYoutubeDesc extends KawaiAbstractSiteDescriptor {
    shortcut_id = 'goto_youtube';
    id = 'youtube';
    category = 'ott';
    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://youtube.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://youtube.com/favicon.ico';
    }
}
@registerKawaiSiteDescriptor
export class KawaiAmazonPrimeDesc extends KawaiAbstractSiteDescriptor {
    shortcut_id = 'goto_amazonprime';
    id = 'amazonprime';
    category = 'ott';

    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.primevideo.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.primevideo.com/favicon.ico';
    }
}

@registerKawaiSiteDescriptor
export class KawaiWavveDesc extends KawaiAbstractSiteDescriptor {
    shortcut_id = 'goto_wavve';
    id = 'wavve';
    category = 'ott';
    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.wavve.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.wavve.com/favicon.ico';
    }
}
@registerKawaiSiteDescriptor
export class KawaiWatchaDesc extends KawaiAbstractSiteDescriptor {
    shortcut_id = 'goto_watcha';
    id = 'watcha';
    category = 'ott';
    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://watcha.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://watcha.com/favicon.ico';
    }
}
@registerKawaiSiteDescriptor
export class KawaiCoupangPlayDesc extends KawaiAbstractSiteDescriptor {
    shortcut_id = 'goto_coupangplay';
    id = 'coupangplay';
    category = 'ott';
    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.coupangplay.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.coupangplay.com/favicon.ico';
    }
}

@registerKawaiSiteDescriptor
export class KawaiTvingDesc extends KawaiAbstractSiteDescriptor {
    shortcut_id = 'goto_tving';
    id = 'tving';
    category = 'ott';

    loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.tving.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.tving.com/favicon.ico';
    }
}
