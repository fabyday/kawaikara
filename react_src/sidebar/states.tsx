import {create} from "zustand"
import { CItem, Configure, ItemType, getProperty, isCItemArray, isEqualConfigure } from "../../typescript_src/definitions/types"
import produce from 'immer';
import lodash from "lodash"


interface KawaiConfTmp {
    configure :  Configure | undefined;


    initialize : (f : ()=>Promise<any>) => void;
    update_favorites : ()=>void;
    change_favorites_order : ()=>void ;
    listen_shortcut_update : ()=>void;
}
interface KawaiConf {
    configure :  Configure | undefined;


    initialize : (f : ()=>Promise<any>) => void;
    update_favorites : ()=>void;
    change_favorites_order : ()=>void ;

}

type set_type = (partial: KawaiConf | Partial<KawaiConf> | ((state: KawaiConf) => KawaiConf | Partial<KawaiConf>), replace?: boolean | undefined) => void
type get_type = ()=>KawaiConf
let context = (set :set_type, get : get_type)=>({
    configure : undefined,
    
    initialize : async (f :  ()=>Promise<any>)=>{
        const response : Configure = ((await f()) as Configure);
        set((state)=>({...state, configure : response}))
    },
    change_favorites_order : ()=>{

    },
    update_favorites : ()=>{}
});

export const useCurConfigureStore = create<KawaiConf>(context)

