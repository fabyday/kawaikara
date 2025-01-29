// export type KawaiSiteDescriptor={
//     id : string, // id_name
//     loadurl : (browser : Electron.BrowserWindow ) => void ; // default values
//     onBeforeSendHeaders? : (details : Electron.OnBeforeSendHeadersListenerDetails ) => void ;
// }

import Logger from 'electron-log';
import log from 'electron-log/main';
import { exit } from 'node:process';
import { global_object } from '../data/context';

export class KawaiAbstractSiteDescriptor {
    readonly id: string | undefined; // descriptor id.
    readonly category: string | undefined; // category info on menubar
    readonly shortcut_id: string | undefined; // connected shortcut ID

    onBeforeSendHeaders(
        details: Electron.OnBeforeSendHeadersListenerDetails,
    ): void {
        // do nothing in abstract class
    }

    loadUrl(borwser: Electron.BrowserWindow): void {
        // do nothing in abstract class
    }

    LoadFaviconUrl(): string {
        return '';
    }
}





