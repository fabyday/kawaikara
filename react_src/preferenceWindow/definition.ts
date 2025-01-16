import { create } from 'zustand';
import produce from 'immer';
import {
    KawaiConfig,
    KawaiPreference,
} from '../../typescript_src/definitions/setting_types';
type set_type = (
    partial:
        | KawaiConfig
        | Partial<KawaiConfig>
        | ((state: KawaiConfig) => KawaiConfig | Partial<KawaiConfig>),
    replace?: boolean | undefined,
) => void;
type get_type = () => KawaiConfig;

type Action = {
    fetch: () => Promise<void>;
    get_property: () => KawaiPreference;
    set_property: (path : string, new_value : any)=>void;
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

type PreferenceState = {
    perference: KawaiPreference;
} & Action;
export const config_states = create<PreferenceState>((set, get) => ({
    perference: {},
    fetch: async () => {
        const config_ = await window.KAWAI_API.preference.load_config();
        const locale  = await window.KAWAI_API.preference.load_locale();
        console.log(config_);
        console.log(locale);


        set((state) => {
            return { ...state, perference: { ...config_, ...locale} };
        });
        console.log('test');
    },
    
    get_property: (): KawaiPreference => {
        return get().perference;
    },
    set_property: (path : string, new_value : any ) => {
      
        set(produce((state : PreferenceState)=>{ 
            const keys = path.split(".");
            if(keys.length === 0){
                return;
            }

            const key = keys.pop()
            var tmp = state.perference
            if(keys.length > 1){
                keys.forEach((v, i)=>{
                    
                    if(typeof tmp[v] === "undefined")
                        tmp[v] = {};
                    tmp = tmp[v] as any;
                })
            }
            tmp[key!]  = new_value;
        }))
        
    },
}));
// export const usePrevConfigureStore = create<KawaiConf>(context)
