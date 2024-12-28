



@registerKawaiSiteDescriptor()
class KawaiNetflixDesc extends KawaiAbstractSiteDescriptor{

    id : string = "netflix"
    category: string | undefined = "ott";
    shortcut_id : string = "goto_netflix";

    onBeforeSendHeaders (detail:Electron.OnBeforeSendHeadersListenerDetails){
            
    }

    loadUrl (browser : Electron.BrowserWindow) {
        browser.loadURL("https://netflix.com/")
        
    }


    LoadFaviconUrl(): string {
        return "https://netflix.com/favicon.ico"
    }


}


@registerKawaiSiteDescriptor()
class KawaiLaftelDesc extends KawaiAbstractSiteDescriptor {
    shortcut_id = "goto_laftel";


    loadUrl(browser : Electron.BrowserWindow){
        browser.loadURL("https://laftel.net/")
        
    }
    
    LoadFaviconUrl(): string {
        return "https://laftel.net/favicon.ico"
    }

}

@registerKawaiSiteDescriptor()
class KawaiDisneyDesc extends KawaiAbstractSiteDescriptor{
    shortcut_id = "goto_disney"
    loadUrl (browser : Electron.BrowserWindow) {

        browser.loadURL("https://www.disneyplus.com/")

    }
}

@registerKawaiSiteDescriptor()
class KawaiYoutubeDesc extends KawaiAbstractSiteDescriptor{
    shortcut_id = "goto_youtube"
    loadUrl (browser : Electron.BrowserWindow) {
        browser.loadURL("https://youtube.com/")
    }

    LoadFaviconUrl(): string {
        return "https://youtube.com/favicon.ico"
    }

    
}
@registerKawaiSiteDescriptor()
class KawaiAmazonPrimeDesc extends KawaiAbstractSiteDescriptor{
    shortcut_id = "goto_amazonprime"
    
    loadUrl (browser : Electron.BrowserWindow){
        browser.loadURL("https://www.primevideo.com/")
    }

    LoadFaviconUrl(): string {
        return "https://www.primevideo.com/favicon.ico"
    }
}
@registerKawaiSiteDescriptor()
class KawaiWavveDesc extends KawaiAbstractSiteDescriptor{
    shortcut_id = "goto_wavve"
    loadUrl (browser : Electron.BrowserWindow) {
        browser.loadURL("https://www.wavve.com/")
    }

    LoadFaviconUrl(): string {
        return "https://www.wavve.com/favicon.ico"
    }
}
@registerKawaiSiteDescriptor()
class KawaiWatchaDesc extends KawaiAbstractSiteDescriptor
{
    shortcut_id = "goto_watcha";
    loadUrl (browser : Electron.BrowserWindow){
        browser.loadURL("https://watcha.com/")
    }

    LoadFaviconUrl(): string {
        return "https://watcha.com/favicon.ico"
    }

  
}
@registerKawaiSiteDescriptor()
class KawaiCounpangPlayDesc extends KawaiAbstractSiteDescriptor{
    shortcut_id  = "goto_coupangplay";
    loadUrl (browser : Electron.BrowserWindow) {
        browser.loadURL("https://www.coupangplay.com/")
    }

    LoadFaviconUrl(): string {
        return "https://www.coupangplay.com/favicon.ico"
    }
}

@registerKawaiSiteDescriptor()
class KawaiTvingDesc extends KawaiAbstractSiteDescriptor{
    shortcut_id = "goto_tving";
    
    loadUrl (browser : Electron.BrowserWindow) {
        browser.loadURL("https://www.tving.com/")
    }

    LoadFaviconUrl(): string {
        return "https://www.tving.com/favicon.ico"
    }

}






