// export type KawaiSiteDescriptor={
//     id : string, // id_name
//     loadurl : (browser : Electron.BrowserWindow ) => void ; // default values
//     onBeforeSendHeaders? : (details : Electron.OnBeforeSendHeadersListenerDetails ) => void ;
// }

import Logger from 'electron-log';
import log from 'electron-log/main';
import { exit } from 'node:process';

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

export class KawaiSiteDescriptorManager {
    // singleton pattern
    private static _instance: KawaiSiteDescriptorManager;
    private m_registered_descriptors: Map<string, KawaiAbstractSiteDescriptor>;
    private constructor() {
        this.m_registered_descriptors = new Map<
            string,
            KawaiAbstractSiteDescriptor
        >();
    }

    public async initializeDefaultSitesDescriptor() {
        await import('../data/site_descriptor'); // do nothing just load desc.
    }
    public static getInstance(): KawaiSiteDescriptorManager {
        if (!KawaiSiteDescriptorManager._instance) {
            KawaiSiteDescriptorManager._instance =
                new KawaiSiteDescriptorManager();
        }
        return KawaiSiteDescriptorManager._instance;
    }

    register(cls: KawaiAbstractSiteDescriptor) {
        this.m_registered_descriptors.set(cls.id as string, cls);
    }

    qeury_site_descriptor_by_name(
        id: string,
    ): KawaiAbstractSiteDescriptor | undefined {
        const id_list: string[] = id.split('.');
        const target_id: string = id_list[id_list.length - 1];
        return this.m_registered_descriptors.get(target_id);
    }
}

export function registerKawaiSiteDescriptor<
    T extends { new (...args: any[]): KawaiAbstractSiteDescriptor },
>(constructor: T) {
    const class_object = new constructor();
    Logger.info('init... ', class_object.id);
    KawaiSiteDescriptorManager.getInstance().register(class_object);
    return constructor;
}
