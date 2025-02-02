import { create } from 'zustand';

import produce from 'immer';
import lodash from 'lodash';
import { KawaiLocale } from '../../typescript_src/definitions/setting_types';

export type KawaiMenuComponent = {
    id: string;
    name: string;
    favicon?: string ;
    favorite?: boolean;
};
type Id = string;

type MenuStates = {
    category_map: Map<Id, KawaiMenuComponent>;
    menu_map: Map<Id, Map<Id, KawaiMenuComponent>>;
    current_category: string | null;
    favorites?: Array<KawaiMenuComponent>;
    fetch: () => Promise<void>;
    set_current_category: (category: string) => void;
};
export function isBase64(str: string): boolean {
    const base64Pattern = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
    const res = base64Pattern.test(str);
    return res
}
type get_type = () => MenuStates;
type set_type = (
    partial:
        | MenuStates
        | Partial<MenuStates>
        | ((state: MenuStates) => MenuStates),
    replace?: boolean | undefined,
) => void;

const data_init_f = (menu_obj: any[], locale: KawaiLocale) => {
    const category_map = new Map();
    const menu_map = new Map();
    Object.keys(menu_obj).forEach((key: any) => {
        const category_id = menu_obj[key]['category'];
        const menu_id = menu_obj[key]['id'];
        const favicon = menu_obj[key]['favicon'];
        
        console.log(locale?.system_literal?.[menu_id]);
        console.log(locale);
        const name = locale?.system_literal?.[menu_id] ?? menu_id;
        if (!category_map.has(category_id)) {
            category_map.set(category_id, {
                id: category_id,
                name: category_id,
            });
        }
        if (!menu_map.has(category_id)) {
            menu_map.set(category_id, new Map());
        }
        menu_map
            .get(category_id)
            .set(menu_id, { id: menu_id, name: name, favicon: favicon ?? '' });
    });

    return { category_map: category_map, menu_map: menu_map };
};
export const menu_state = create<MenuStates>(
    (set: set_type, get: get_type) => ({
        category_map: new Map(),
        menu_map: new Map(),
        current_category: null,
        favorites: new Array(),
        fetch: async () => {
            const menu_items = JSON.parse(
                await window.KAWAI_API.menu.load_menu(),
            );
            const locale: KawaiLocale =
                await window.KAWAI_API.preference.load_locale();
            const favorites =
                await window.KAWAI_API.menu.load_favorites_list();
            
            // const locale : KawaiLocale = await window.KAWAI_API.preference.load_locale();
            const serialized_data = data_init_f(menu_items, locale);
            favorites.forEach((key : any)=>{
                if(serialized_data.menu_map.has(key.category)){
                    const menu_map = serialized_data.menu_map.get(key.category)
                    if(menu_map.has(key.id)){
                        (menu_map.get(key.id) as KawaiMenuComponent).favorite = true

                    }
                }
            })
            set((state) => ({
                ...state,
                ...serialized_data,
                favorites: favorites,
            }));
        },

        set_current_category: (cat: string) => {
            set((state) => ({ ...state, current_category: cat }));
        },
    }),
);
