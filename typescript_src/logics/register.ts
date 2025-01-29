import { keyActionListenable } from '../definitions/action';
import { KawaiMenuBase } from '../definitions/menu_def';
import { KawaiAbstractSiteDescriptor } from '../definitions/SiteDescriptor';
import { get_flogger, get_logger } from '../logging/logger';
import { MenuManager } from '../manager/menu_manager';
import { ShortcutManager } from '../manager/shortcut_manager';
import { KawaiSiteDescriptorManager } from '../manager/site_descriptor_manager';
import 'reflect-metadata';

const flog = get_flogger('register', 'register_info', 'debug');

export function registerKawaiSiteDescriptor<
    T extends { new (...args: any[]): KawaiAbstractSiteDescriptor },
>(constructor: T) {
    const class_object = new constructor();
    flog.info(`register ${class_object.id}`);
    KawaiSiteDescriptorManager.getInstance().register(class_object);
    return constructor;
}

export function RegisterShortcut<
    T extends { new (...args: any[]): keyActionListenable },
>(constructor: T) {
    constructor;
    const class_object = new constructor();
    ShortcutManager.getInstance().register(class_object);
    return constructor;
}

export function registerKawaiMenuItem(_category_id: string, _id: string) {
    const wrapper = <T extends new (...args: any[]) => KawaiMenuBase>(
        constructor: T,
    ) => {
        const newConstructor = class extends constructor {
            id: string;
            category: string;
            constructor(...args: any[]) {
                super(...args);
                this.category = _category_id;
                this.id = _id;
            }
        };
        const class_object = new newConstructor();
        MenuManager.getInstance().add_menuitem(class_object);
        return newConstructor;
    };
    return wrapper;
}

export function connectToShortcut(id: string) {
    const wrapper_decorator = <
        T extends new (...args: any[]) => KawaiAbstractSiteDescriptor,
    >(
        s: T,
    ) => {
        
        return s;
    };

    return wrapper_decorator;
}

export function connectToMenu(id: string) {
    const wrapper_decorator = <
        T extends new (...args: any[]) => KawaiAbstractSiteDescriptor,
    >(
        s: T,
    ) => {
        if (s.prototype instanceof KawaiAbstractSiteDescriptor) {
            Reflect.defineMetadata(
                'menu_promise_meta',
                MenuManager.getInstance()._connectToMenu(id),
                s.prototype,
            );
            Reflect.defineMetadata(
                'desc_promise_meta',
                KawaiSiteDescriptorManager.getInstance()._getCallback(id),
                s.prototype,
            );
            const menu_meta = Reflect.getMetadata(
                'menu_promise_meta',
                s.prototype,
            );
            const desc_meta = Reflect.getMetadata(
                'desc_promise_meta',
                s.prototype,
            );

            Promise.resolve(desc_meta)
                .then((callback: () => void) => {
                    Promise.resolve(menu_meta)
                        .then((menu_id: string) => {
                            MenuManager.getInstance().connectToMenu(
                                menu_id,
                                callback,
                            );
                        })
                        .catch(() => {
                            Reflect.deleteMetadata(
                                'desc_promise_meta',
                                s.prototype,
                            );
                        });
                })
                .catch(() => {
                    Reflect.deleteMetadata('menu_promise_meta', s.prototype);
                });
        }

        return s;
    };
    return wrapper_decorator;
}
