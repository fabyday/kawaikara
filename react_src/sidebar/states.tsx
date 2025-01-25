import { create } from 'zustand';

import produce from 'immer';
import lodash from 'lodash';
import { KawaiLocale } from '../../typescript_src/definitions/setting_types';

export type KawaiMenuComponent = { id: string; name: string; favicon?: string };
type Id = string;

type MenuStates = {
    category_map: Map<Id, KawaiMenuComponent>;
    menu_map: Map<Id, Map<Id, KawaiMenuComponent>>;
    current_category: string | null;
    fetch: () => Promise<void>;
    set_current_category: (category: string) => void;
};

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
            .set(menu_id, { id: menu_id, name: menu_id, favicon: null });
    });

    return { category_map: category_map, menu_map: menu_map };
};
export const menu_state = create<MenuStates>(
    (set: set_type, get: get_type) => ({
        category_map: new Map(),
        menu_map: new Map(),
        current_category: null,
        fetch: async () => {
            const menu_items = JSON.parse(
                await window.KAWAI_API.menu.load_menu(),
            );
            const locale: KawaiLocale =
                await window.KAWAI_API.preference.load_locale();
            // const locale : KawaiLocale = await window.KAWAI_API.preference.load_locale();
            const serialized_data = data_init_f(menu_items, locale);
            set((state) => ({ ...state, ...serialized_data }));
        },

        set_current_category: (cat: string) => {
            set((state) => ({ ...state, current_category: cat }));
        },
    }),
);
