import {create} from "zustand"
import { CItem, Configure, ItemType, getProperty, isCItemArray, isEqualConfigure } from "../../typescript_src/definitions/types"
import produce from 'immer';
import lodash from "lodash"

let t = new Map<string, Set<string>>()
interface save_flag {
    valid_save : boolean
    shortcut_to_id_map :  Map<string, Set<String>>; // [shortcut string, set of id strings ]
    shortcut_id_to_shortcut_map :  Map<string, string>; // [shortcut string, set of id strings ]
    check_dupshortcut : (id:string, shortcut:string)=>boolean;
    check_whole_shortcut : ()=>boolean
    reset_from_conf : (Configure : Configure)=>void
    // check_dupshortcut : (id : string, shortcut : string)=>boolean
}
export let save_flag = create<save_flag>((set, get)=>({
    valid_save : true,
    shortcut_to_id_map : new Map<string, Set<string>>(),
    shortcut_id_to_shortcut_map : new Map<string, string>(),
    check_dupshortcut : (id:string, shortcut_text:string)=>{
        let tmp = get().shortcut_to_id_map
        let tmp_id2shortcut = get().shortcut_id_to_shortcut_map
        let flag = false 
        if(tmp.has(shortcut_text)){
            let the_set = tmp.get(shortcut_text)
            let last_size = the_set!.size
            the_set!.add(id)

            let item = tmp_id2shortcut.get(id)
            tmp.get(item!)?.delete(id)

            tmp_id2shortcut.set(id, shortcut_text)
            if( the_set!.size > 0 && the_set!.size > last_size ){
                flag = true
            }else{
                flag = false
            }
                
        }else{
            tmp_id2shortcut.set(id, shortcut_text)
            tmp.set(shortcut_text, new Set<string>(id))
            flag = false
        }

        set(state=>({...state, 
            shortcut_id_to_shortcut_map : lodash.cloneDeep(tmp_id2shortcut), 
            shortcut_to_id_map : lodash.cloneDeep(tmp)}
        ))
        return flag
    },
    check_whole_shortcut : ()=>{
        let flag = true
        for(let item of Array.from(get().shortcut_to_id_map)){
            flag &&= item[1].size === 1
        }
        set((state)=>({...state, valid_save : flag}))
        return flag
    },
    reset_from_conf : (conf :Configure) =>{
        let shortcut_list = getProperty(conf, "configure.shortcut")?.item
        let tmp_id_2_sc = get().shortcut_id_to_shortcut_map
        let tmp_sc_2_id = get().shortcut_to_id_map
        tmp_id_2_sc.clear()
        tmp_sc_2_id.clear()
        if(typeof shortcut_list !== "undefined"){
            if( isCItemArray(shortcut_list)){
                shortcut_list.map(vv=>{ 
                    if(tmp_sc_2_id.size === 0){
                        tmp_sc_2_id.set(vv.item as string, new Set<string>(vv.id as string))
                        tmp_id_2_sc.set(vv.id as  string, vv.item as string)
                    }
                    else{
                            tmp_sc_2_id.get(vv.item as string)!.add(vv.id as string)
                            tmp_id_2_sc.set(vv.id as string, vv.item as string)

                        }
                    }
                )
            }
        }

        set(state=>({...state, shortcut_id_to_shortcut_map : tmp_id_2_sc, shortcut_to_id_map : tmp_sc_2_id  }))
        
        set(state=>({...state,valid_save : get().check_whole_shortcut() }))
    }
   

}))
interface KawaiConf {
    configure :  Configure | undefined;

    is_changed : (new_ : Configure)=>boolean;
    fetch : (f:()=>Promise<any>)=>void;
    get_property : (id : string)=>CItem | undefined;
    set_property : (id: string, item_value : ItemType) => void
    copy_from : (conf : Configure)=>void;
    
}

type set_type = (partial: KawaiConf | Partial<KawaiConf> | ((state: KawaiConf) => KawaiConf | Partial<KawaiConf>), replace?: boolean | undefined) => void
type get_type = ()=>KawaiConf
let context = (set :set_type, get : get_type)=>({
    configure : undefined,
    is_changed : (new_ : Configure)=>{
        let c = get()
        if(typeof c.configure === "undefined")
            return typeof new_ === "undefined"
        return isEqualConfigure(c.configure, new_) 
    },
    fetch : async (f :  ()=>Promise<any>)=>{
        const response : Configure = ((await f()) as Configure);
        set((state)=>({...state, configure : response}))
    },
    copy_from : (conf : Configure)=>{
        set((state)=>({
            ...state ,
            configure : lodash.cloneDeep(conf)
        }))
        let t= get().configure 
        if(typeof t !== 'undefined'){
            console.log("console.log : copy from is called" )

        }
    },
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
});

export const useCurConfigureStore = create<KawaiConf>(context)

export const usePrevConfigureStore = create<KawaiConf>(context)

