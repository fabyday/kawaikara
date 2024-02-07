import {create} from "zustand"
import { CItem, Configure, ItemType, getProperty } from "../../typescript_src/definitions/types"
import produce from 'immer';
import lodash from "lodash"


interface KawaiConf {
    configure : Configure | undefined;

    is_changed : (old : Configure, new_ : Configure)=>boolean;
    fetch : (f:()=>Promise<any>)=>void;
    get_property : (id : string)=>CItem | undefined;
    set_property : (id: string, item_value : ItemType) => void
    copy_from : (conf : Configure)=>void;
    
}
let context = create<KawaiConf>((set, get)=>({
    configure : undefined,
    is_changed : (old : Configure, new_ : Configure)=> (get().configure !== new_),
    fetch : async (f :  ()=>Promise<any>)=>{
        const response : Configure = ((await f()) as Configure);
        set((state)=>{
            state.configure = response
            return state;
        })
    },
    copy_from : (conf : Configure)=>set((state)=>{
        let copy_conf = lodash.cloneDeep(conf)
        state.configure = copy_conf;
        return state;
    }),
    get_property : (id:string)=>{
        let conf = get().configure
        if(typeof conf !== "undefined"){
            let item = getProperty(conf, id)
            return item;
        }
        return undefined
    },
    set_property : (id: string, item_value : ItemType)=>{
        set((state)=>{
            if(typeof state.configure !== "undefined"){
                let porperty = getProperty(state.configure, id)
                if(typeof porperty !== "undefined"){
                    porperty.item = item_value
                    return  lodash.cloneDeep(state)
                }
            }
            return state;
        })
    },
}));


export const useCurConfigureStore = create<KawaiConf>(context)

export const usePrevConfigureStore = create<KawaiConf>(context)

