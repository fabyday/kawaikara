import { get_menu_instance } from '../component/menu';
import { get_flogger, log } from '../logging/logger';
import { global_object } from '../data/context';
import {
    IKawaiMenu,
    KawaiCategoryBase,
    KawaiMenuBase,
} from '../definitions/menu_def';
import EventEmitter, { on, once } from 'node:events';
import { rejects } from 'node:assert';
import { KawaiStringProperty } from '../definitions/setting_types';
import { KAWAI_API_LITERAL } from '../definitions/api';

const flog = get_flogger('MenuLogger', 'menumanager', 'debug');
type EventLiteral = 'menu-selected' | 'registered-menu';
export class MenuManager {
    static __instance: MenuManager | undefined;
    private m_category_items: Map<string, KawaiCategoryBase>;
    private m_menu_item: Map<string, IKawaiMenu>;
    private m_category_menu_map: Map<string, string[]>;

    private m_favicon_meta: Map<string, string>;
    private m_event_emitter = new EventEmitter();

    private constructor() {
        this.m_category_items = new Map<string, KawaiCategoryBase>();
        this.m_menu_item = new Map<string, KawaiMenuBase>();
        this.m_category_menu_map = new Map<string, string[]>();
        this.m_event_emitter.setMaxListeners(30);
        this.m_favicon_meta = new Map<string, string>();
    }

    public static getInstance() {
        if (typeof MenuManager.__instance === 'undefined') {
            MenuManager.__instance = new MenuManager();
        }
        return MenuManager.__instance;
    }

    public async initialize() {
        log.info('initialize menu items');
        await import('../data/menu_data');
    }

    public hasCategory(category_id: string) {
        if (typeof this.m_category_items.get(category_id) === 'undefined')
            return false;
        return true;
    }

    public addFavorites(menu_id: string) {
        if (typeof global_object.config?.favorites === 'undefined') {
            global_object!.config!.favorites = {};
        }
        global_object!.config!.favorites[menu_id] = { value: menu_id };
        global_object.menu?.webContents.send(
            KAWAI_API_LITERAL.menu.notify_menu_update,
        );
        return;
    }
    public deleteFavorites(menu_id: string) {
        if (typeof global_object.config?.favorites === 'undefined') {
            return; //do nothing.
        }
        const favorites_object = global_object!.config!.favorites!;
        delete favorites_object[menu_id];
        global_object.menu?.webContents.send(
            KAWAI_API_LITERAL.menu.notify_menu_update,
        );
        return;
    }

    public getFavorites() {
        if (typeof global_object.config?.favorites === 'undefined') {
            return [];
        }
        const favaorites_list = Object.entries(
            global_object.config?.favorites ?? {},
        ).map(([key, value]: [string, KawaiStringProperty | undefined]) => {
            const reval = {
                id: key,
                name: global_object?.locale?.system_literal?.[key] ?? key,
                category: this.m_menu_item.get(key)?.category ?? '',
            };
            if (this.m_menu_item.has(key)) {
                const item = this.m_menu_item.get(key);
                if (typeof item?.getFaviconUrl !== 'undefined') {
                    (reval as any)['favicon'] = item?.getFaviconUrl();
                } else if (this.m_favicon_meta.has(key)) {
                    (reval as any)['favicon'] = this.m_favicon_meta.get(key);
                }
            }
            return reval;
        });
        return favaorites_list ?? [];
    }

    public getMenuItemsByJson() {
        // const mapObject: { [key: string]: any } = Object.fromEntries(
        //     this.m_menu_item,
        // );
        const mapObject = new Map();
        this.m_menu_item.forEach((value, key) => {
            console.log('key', value);

            if (typeof value.getFaviconUrl !== 'undefined') {
                mapObject.set(key, {
                    id: value.id,
                    name:
                        global_object?.locale?.system_literal?.[value.id] ??
                        value.id,
                    category: value.category,
                    favicon: value.getFaviconUrl(),
                });
            } else if (this.m_favicon_meta.has(key)) {
                mapObject.set(key, {
                    id: value.id,
                    name:
                        global_object?.locale?.system_literal?.[value.id] ??
                        value.id,
                    category: value.category,
                    favicon: this.m_favicon_meta.get(key),
                });
            } else {
                mapObject.set(key, {
                    id: value.id,
                    name:
                        global_object?.locale?.system_literal?.[value.id] ??
                        value.id,
                    category: value.category,
                });
            }
        });

        // const jsonString = JSON.stringify(mapObject);
        const jsonString = JSON.stringify(Object.fromEntries(mapObject));
        flog.debug(jsonString);
        return jsonString;
    }

    public add_category(item: KawaiCategoryBase | string) {
        // if(this.m_category_items.has(item.id)){
        //     throw new Error("this category id was existed in manager.")
        // }
        if (typeof item === 'string') {
            if (this.m_category_items.has(item)) {
                return; // well it is done.
            }
            this.m_category_items.set(item, new KawaiCategoryBase(item));
        } else {
            this.m_category_items.set(item.id, item);
        }
    }

    public _add_meta(key: string, value: string) {
        this.m_favicon_meta.set(key, value);
    }

    public add_menuitem(item: KawaiMenuBase) {
        if (this.m_menu_item.has(item.id)) {
            flog.debug('add menu failed', item);
            flog.debug('full list', this.m_menu_item);

            throw new Error('this category id existed in manager.\n' + item);
        }
        this.add_category(item.category);
        this.m_menu_item.set(item.id, item);
        console.log('item!!!', item.id);
        this.m_event_emitter.emit('registered-menu', item.id);
    }

    protected addToCategory(item: KawaiMenuBase, category_id: string) {
        if (!this.m_category_items.has(category_id)) {
            throw new Error(
                "can't add MenuItem to Category. Because Category isn't existed in manager.",
            );
        }

        if (this.m_category_menu_map.has(category_id)) {
            const item_list = this.m_category_menu_map.get(category_id);
            item_list!.push(item.id);
        } else {
            this.m_category_menu_map.set(category_id, [item.id]);
        }
    }

    // public connectEventListener(
    //     menu_id: string,
    //     func: KawaiMenuClickedEventCallback,
    // ) {
    //     if (this.m_event_listener_map.has(menu_id)) {
    //         // this.m_event_listener_map.get(menu_id)?.push(func);
    //     } else {
    //         // this.m_event_listener_map.set(menu_id, [func]);
    //         this.m_event_emitter.on('menu-selected', func);
    //     }
    // }

    public onSelectItem(category_id: string, id: string) {
        // const selected_callbacks: KawaiMenuClickedEventCallback[] | undefined =
        //     this.m_event_listener_map.get(id);
        // console.log(this.m_menu_item);
        // const menuitem = this.m_menu_item.get(id);
        // console.log(menuitem);
        // if (typeof menuitem !== 'undefined') {
        //     menuitem.activate();
        // }
        // if (typeof selected_callbacks === 'undefined') {
        //     return; // do nothing.
        // }
        console.log('event emit ', id);
        const menu_item = this.m_menu_item.get(id)!;

        if (typeof menu_item.activate === 'undefined') {
            this.m_event_emitter.emit('menu-selected', id);
        } else {
            menu_item.activate();
        }
    }

    public openMenu() {
        const view = get_menu_instance();
        view?.webContents.focus();
    }

    public closeMenu() {
        global_object.mainWindow?.removeBrowserView(get_menu_instance()!);
    }

    _connectManager(
        event_literal: EventLiteral,
        callback: (id: string) => void,
    ) {
        this.m_event_emitter.on(event_literal, callback);
    }

    // public connectToMenu(id: string, callback: () => void) {
    //     this.m_event_emitter.on('menu-selected', (selected_id: string) => {
    //         if (selected_id === id) {
    //             callback();
    //         }
    //     });
    // }

    // // do not use it directly.
    // public _connectToMenu(id: string) {
    //     const registerConnection = this.connectToMenu;
    //     console.log('register id ', id);
    //     new Promise(async (resolve, rejects) => {
    //         const timeout_object = setTimeout(() => {
    //             this.m_event_emitter.removeListener(
    //                 'register-menu',
    //                 eventHandler,
    //             );
    //             rejects();
    //         }, 30000);

    //         if (this.m_menu_item.has(id)) {
    //             console.log('menu is existsed');
    //             return resolve(this.m_menu_item.get(id));
    //         }

    //         const eventHandler = (menu_id: string) => {
    //             console.log('🔔 Received event:', menu_id);
    //             if (menu_id === id) {
    //                 clearTimeout(timeout_object); // clear timer
    //                 if (id === menu_id) {
    //                     this.m_event_emitter.removeListener(
    //                         'register-menu',
    //                         eventHandler,
    //                     ); // remove listener
    //                     console.log('resoved');
    //                     resolve(menu_id);
    //                 }
    //             }
    //         };

    //         this.m_event_emitter.on('register-menu', eventHandler);
    //     });
    // }
}

//
// decorators
//

// export function registerKawaiCategory(_category_id: string) {
//     const wrapper = <T extends new (...args: any[]) => KawaiMenuBase>(
//         constructor: T,
//     ) => {
//         const newConstructor = class extends constructor {
//             id: string;
//             constructor(...args: any[]) {
//                 super(...args);
//                 this.id = _category_id;
//             }
//         };
//         const class_object = new newConstructor();
//         MenuManager.getInstance().add_category(class_object);
//         return newConstructor;
//     };
//     return wrapper;
// }

// export function connect_menu(menu_id: string) {
//     const wrapper_deco = (target_function : ()=>{}) => {
//         MenuManager.getInstance().connectEventListener(menu_id, target_function);

//     };

//     return wrapper_deco;
// }
/**
 *
 * @param menu_id menu id.
 * @returns
 */
// export function connect_menu(menu_id: string) {
//     return function (
//         target: any,
//         propertyKey: string | symbol,
//         descriptor: PropertyDescriptor,
//     ) {
//         const originalMethod = descriptor.value;

//         descriptor.value = function (...args: any[]) {
//             // 원본 메서드를 호출하기 전에 원하는 작업을 할 수 있음
//             MenuManager.getInstance().connectEventListener(
//                 menu_id,
//                 originalMethod,
//             );

//             // 원본 메서드를 호출
//             return originalMethod.apply(this, args);
//         };

//         return descriptor; // 수정된 디스크립터 반환
//     };
// }
