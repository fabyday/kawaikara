// export type KawaiSiteDescriptor={
//     id : string, // id_name
//     loadurl : (browser : Electron.BrowserWindow ) => void ; // default values
//     onBeforeSendHeaders? : (details : Electron.OnBeforeSendHeadersListenerDetails ) => void ;
// }



export class KawaiAbstractSiteDescriptor {
    readonly id: string | undefined; // descriptor id.
    readonly category: string | undefined; // category info on menubar
    readonly shortcut_id: string | undefined; // connected shortcut ID

    onBeforeSendHeaders(
        details: Electron.OnBeforeSendHeadersListenerDetails,
    ): void {
        // do nothing in abstract class
    }

    /**
     *
     * @param url requested url
     * @returns if return external, then url will be opened in external browser(Chrome, Firefox what you selected default.)
     * if return "open", then url will be opended in kawaikara mainView.
     * if return "suppress" then do nothing.
     * default value is suppress
     */
    onNewWindowCreated(url: string): 'external' | 'open' | 'suppress' {
        return 'suppress';
    }

    async loadUrl(borwser: Electron.BrowserWindow): Promise<void> {
        // do nothing in abstract class
    }

    async unload(browser: Electron.BrowserWindow): Promise<void> {}

    LoadFaviconUrl(): string {
        return '';
    }
}
