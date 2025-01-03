import { get_menu_instance } from '../component/menu';
import { global_object } from '../data/context';
import { KawaiCategoryBehavior as KawaiMenuBehavior } from '../definitions/menu_def';

export class MenuManager {
    static __instance: MenuManager | undefined;
    private m_category_items: Map<string, KawaiMenuBehavior>;
    private m_menu_item : Map<string, KawaiMenuBehavior>;
    private m_category_menu_map : Map<string, string[]>;

    private constructor() {
        this.m_category_items = new Map<string, KawaiMenuBehavior>();
        this.m_menu_item = new Map<string, KawaiMenuBehavior>();
        this.m_category_menu_map = new Map<string,  string[]>();
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

    public add_category(item : KawaiMenuBehavior) {
        this.m_category_items.set(item.id, item )
    }
    public add_menuitem(item : KawaiMenuBehavior) {

    }

    public selectItem(id:string) {
        
    };


    public openMenu(){
       get_menu_instance()
    }
}
