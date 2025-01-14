import { create } from 'zustand';
import produce from 'immer';
import { KawaiConfig, KawaiPreference } from '../../typescript_src/definitions/setting_types';
type set_type = (
    partial:
        | KawaiConfig
        | Partial<KawaiConfig>
        | ((state: KawaiConfig) => KawaiConfig | Partial<KawaiConfig>),
    replace?: boolean | undefined,
) => void;
type get_type = () => KawaiConfig ;

type Action = {
    fetch: () => Promise<void>;
    get_property :(...key: string[])=> any;
    set_property:(config: KawaiPreference) => void;
};

// let context = (set: set_type, get: get_type) => ({
//     configure: {},

//     fetch: async (f: () => Promise<KawaiConfig>) => {
//         const response: KawaiConfig = (await f()) as KawaiConfig;
//         set((state) => ({ ...state, ...response }));
//     },

//     get_property: (key: string) => {
//         return get()[key];
//     },

//     set_property: (config: KawaiConfig) => {
//         set((state) => {
//             return { ...state, ...config };
//         });
//     },
// });

export const config_states = create<Action & KawaiPreference>((set, get) => ({
    fetch: async () => {
        const value = await window.KAWAI_API.preference.load_config()
        console.log(value)
        set((state)=>{return {...state, ...value}});
        console.log("test")
    },
    get_property: (...key: string[]) => {
        return get().general?.window_preference?.window_size?.height?.value
    },
    set_property: (config: KawaiPreference) => {set((state)=>({...state, ...config}))},
}));
// export const usePrevConfigureStore = create<KawaiConf>(context)
