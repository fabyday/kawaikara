import { get_menu_instance } from '../component/menu';
import { global_object } from '../data/context';
import { KawaiCategoryBase, KawaiMenuBase } from '../definitions/menu_def';

type KawaiMenuClickedEventCallback = (id: string) => void;

export class MenuManager {
    static __instance: MenuManager | undefined;
    private m_category_items: Map<string, KawaiCategoryBase>;
    private m_menu_item: Map<string, KawaiMenuBase>;
    private m_category_menu_map: Map<string, string[]>;
    private m_event_listener_map: Map<string, KawaiMenuClickedEventCallback[]>;

    private constructor() {
        this.m_category_items = new Map<string, KawaiCategoryBase>();
        this.m_menu_item = new Map<string, KawaiMenuBase>();
        this.m_category_menu_map = new Map<string, string[]>();
        this.m_event_listener_map = new Map<
            string,
            KawaiMenuClickedEventCallback[]
        >();
    }

    public static getInstance() {
        if (typeof MenuManager.__instance === 'undefined') {
            MenuManager.__instance = new MenuManager();
        }
        return MenuManager.__instance;
    }

    public async initialize() {
        await import('../data/menu_data');
    }

    public hasCategory(category_id: string) {
        if (typeof this.m_category_items.get(category_id) === 'undefined')
            return false;
        return true;
    }

    public getMenuItemsByJson() {}

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
    public add_menuitem(item: KawaiMenuBase) {
        if (this.m_menu_item.has(item.id)) {
            throw new Error('this category id was existed in manager.');
        }

        this.add_category(item.category);
        this.m_menu_item.set(item.id, item);
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

    public connectEventListener(
        menu_id: string,
        func: KawaiMenuClickedEventCallback,
    ) {
        if (this.m_event_listener_map.has(menu_id)) {
            this.m_event_listener_map.get(menu_id)?.push(func);
        } else {
            this.m_event_listener_map.set(menu_id, [func]);
        }
    }

    public onSelectItem(category_id: string, id: string) {
        const selected_callbacks: KawaiMenuClickedEventCallback[] | undefined =
            this.m_event_listener_map.get(id);
        if (typeof selected_callbacks === 'undefined') {
            return; // do nothing.
        }

        for (const callback of selected_callbacks) {
            callback(id);
        }
    }

    public openMenu() {
        const view = get_menu_instance();
        view?.webContents.focus();
    }

    public closeMenu() {
        global_object.mainWindow?.removeBrowserView(get_menu_instance()!);
    }
}

//
// decorators
//
export function registerKawaiMenuItem(_category_id: string, _id: string) {
    const wrapper = <T extends new (...args: any[]) => KawaiMenuBase>(
        constructor: T,
    ) => {
        const newConstructor = class extends constructor {
            id: string;
            category: string;
            constructor(...args: any[]) {
                super(...args);
                this.category = _id;
                this.id = _category_id;
            }
        };
        const class_object = new newConstructor();
        MenuManager.getInstance().add_menuitem(class_object);
        return newConstructor;
    };
    return wrapper;
}

export function registerKawaiCategory(_category_id: string) {
    const wrapper = <T extends new (...args: any[]) => KawaiMenuBase>(
        constructor: T,
    ) => {
        const newConstructor = class extends constructor {
            id: string;
            constructor(...args: any[]) {
                super(...args);
                this.id = _category_id;
            }
        };
        const class_object = new newConstructor();
        MenuManager.getInstance().add_category(class_object);
        return newConstructor;
    };
    return wrapper;
}
