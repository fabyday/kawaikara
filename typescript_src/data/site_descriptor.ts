



@registerKawaiSiteDescriptor()
class KawaiNetflixDesc extends KawaiAbstractSiteDescriptor{

    readonly id : string = "goto_netflix";

    onBeforeSendHeaders (detail:Electron.OnBeforeSendHeadersListenerDetails){
            
    }

    loadurl (browser : Electron.BrowserWindow) {
        browser.loadURL("https://netflix.com/")
        
    }


}


@registerKawaiSiteDescriptor()
class KawaiLaftelDesc extends KawaiAbstractSiteDescriptor {
    id = "goto_laftel";
    loadurl(browser : Electron.BrowserWindow){
        browser.loadURL("https://laftel.net/")
    }
}

@registerKawaiSiteDescriptor()
class KawaiDisneyDesc extends KawaiAbstractSiteDescriptor{
    id = "goto_disney"
    loadurl (browser : Electron.BrowserWindow) {

        browser.loadURL("https://www.disneyplus.com/")

    }
}

@registerKawaiSiteDescriptor()
class KawaiYoutubeDesc extends KawaiAbstractSiteDescriptor{
    id = "goto_youtube",
    loadurl (browser : Electron.BrowserWindow) {
        browser.loadURL("https://youtube.com/")
    }
}
@registerKawaiSiteDescriptor()
class KawaiAmazonPrimeDesc extends KawaiAbstractSiteDescriptor{
    id = "goto_amazonprime"
    
    loadurl (browser : Electron.BrowserWindow){
        browser.loadURL("https://www.primevideo.com/")
    }
}
@registerKawaiSiteDescriptor()
class KawaiWavveDesc extends KawaiAbstractSiteDescriptor{
    id = "goto_wavve"
    loadurl (browser : Electron.BrowserWindow) {
        browser.loadURL("https://www.wavve.com/")
    }
}
@registerKawaiSiteDescriptor()
class KawaiWatchaDesc extends KawaiAbstractSiteDescriptor
{
    id = "goto_watcha";
    loadurl (browser : Electron.BrowserWindow){
        browser.loadURL("https://watcha.com/")
    }
}
@registerKawaiSiteDescriptor()
class KawaiCounpangPlayDesc extends KawaiAbstractSiteDescriptor{
    id  = "goto_coupangplay";
    loadurl (browser : Electron.BrowserWindow) {
        browser.loadURL("https://www.coupangplay.com/")
    }
}

@registerKawaiSiteDescriptor()
class KawaiTvingDesc extends KawaiAbstractSiteDescriptor{
    id = "goto_tving";
    
    loadurl (browser : Electron.BrowserWindow) {
        browser.loadURL("https://www.tving.com/")
    }

}






