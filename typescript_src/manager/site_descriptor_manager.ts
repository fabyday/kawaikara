import { EventEmitter } from 'stream';
import { global_object } from '../data/context';
import { KawaiAbstractSiteDescriptor } from '../definitions/SiteDescriptor';
import { KawaiViewManager } from './view_manager';
import { once } from 'events';

export class KawaiSiteDescriptorManager {
    // singleton pattern
    private static _instance: KawaiSiteDescriptorManager;
    private m_registered_descriptors: Map<string, KawaiAbstractSiteDescriptor>;
    private m_event_emitter = new EventEmitter();
    private constructor() {
        this.m_registered_descriptors = new Map<
            string,
            KawaiAbstractSiteDescriptor
        >();
        this.m_event_emitter.setMaxListeners(30);
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
        this.m_event_emitter.emit('register-desc', cls.id);
    }

    qeury_site_descriptor_by_name(
        id: string,
    ): KawaiAbstractSiteDescriptor | undefined {
        const id_list: string[] = id.split('.');
        const target_id: string = id_list[id_list.length - 1];
        return this.m_registered_descriptors.get(target_id);
    }

    /// return
    getRegisteredDescriptorIds() {
        const descIdList = Array.from(this.m_registered_descriptors.keys());
        const literal = global_object.locale?.system_literal;
        let localed_added_id = [];
        console.log(global_object.locale);
        if (typeof literal !== 'undefined') {
            localed_added_id = descIdList.map((desc_id) => {
                return { id: desc_id, name: literal[desc_id] ?? desc_id };
            });
        } else {
            localed_added_id = descIdList.map((desc_id) => {
                return { id: desc_id, name: desc_id };
            });
        }
        return localed_added_id;
    }

    public _getCallback(id: string) {
        const promise: Promise<() => void> = new Promise(
            async (resolve, reject) => {
                const timer = setTimeout(() => {
                    this.m_event_emitter.removeListener(
                        'register-desc',
                        eventHandler,
                    );
                    reject();
                }, 30000); // reject if timeouted.

                const callback = () => {
                    KawaiViewManager.getInstance().loadUrl(id);
                };

                if (
                    typeof this.qeury_site_descriptor_by_name(id) ===
                    'undefined'
                ) {
                    return resolve(callback);
                }
                const eventHandler = (desc_id: string) => {
                    if (id === desc_id) {
                        clearTimeout(timer);
                        this.m_event_emitter.removeListener(
                            'register-desc',
                            eventHandler,
                        );
                        resolve(callback);
                    }
                };
                this.m_event_emitter.on('register-desc', eventHandler);
            },
        );

        return promise;
    }
}
