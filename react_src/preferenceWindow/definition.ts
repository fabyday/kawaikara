import {create} from "zustand"
import { CItem, Configure, ItemType, getProperty, isCItemArray, isEqualConfigure } from "../../typescript_src/definitions/types"
import produce from 'immer';
import lodash from "lodash"

interface save_flag {
    shortcut_validation : boolean
    shortcut_to_id_map :  Map<string, Set<String>>; // [shortcut string, set of id strings ]
    shortcut_id_to_shortcut_map :  Map<string, string>; // [shortcut string, set of id strings ]
    check_duplication_shortcut : (id:string, shortcut:string)=>boolean;
    check_whole_shortcut : ()=>boolean
    reset_from_conf : (Configure : Configure)=>void
    // check_dupshortcut : (id : string, shortcut : string)=>boolean
}
export let save_flag = create<save_flag>((set, get)=>({
    shortcut_validation : true,
    shortcut_to_id_map : new Map<string, Set<string>>(),
    shortcut_id_to_shortcut_map : new Map<string, string>(),
    check_duplication_shortcut : (id:string, shortcut_text:string)=>{
        // if duplication problem exsits, then return true
        // else return false
        let shortcut_id_to_key = lodash.cloneDeep(get().shortcut_id_to_shortcut_map)
        let shortcut_key_to_id = lodash.cloneDeep(get().shortcut_to_id_map)

        let prev_shortcut_key = shortcut_id_to_key.get(id)
        shortcut_id_to_key.set(id, shortcut_text)
        let ids_duplicate_shortcut_key  = shortcut_key_to_id.get(shortcut_text)
 
        let re_flag = false
        
        
        // if prev shortcut key exists, then delete this infos.
        // and I don't track "" and undefined.
        if(prev_shortcut_key !== "" && prev_shortcut_key !== undefined){
            let prev_ids_duplicate_shortcut_key = shortcut_key_to_id.get(prev_shortcut_key)
            if(prev_ids_duplicate_shortcut_key !== undefined){
                prev_ids_duplicate_shortcut_key.delete(id)
                if(prev_ids_duplicate_shortcut_key.size === 0)
                    shortcut_key_to_id.delete(prev_shortcut_key)
        }
    }
        if(ids_duplicate_shortcut_key === undefined || ids_duplicate_shortcut_key.size == 0){
            shortcut_key_to_id.set(shortcut_text, new Set<string>())
            // re flag is false
            re_flag = false
        }
        if(shortcut_text !== "" && shortcut_text !== undefined){
            ids_duplicate_shortcut_key = shortcut_key_to_id.get(shortcut_text)
            ids_duplicate_shortcut_key!.add(id)
            let size = ids_duplicate_shortcut_key!.size
            if (size >1 ){
                re_flag = true
            }
        }

        set(state=>({...state, shortcut_id_to_shortcut_map : shortcut_id_to_key,  shortcut_to_id_map : shortcut_key_to_id}))
        return re_flag;
    },

    check_whole_shortcut : ()=>{
        let flag  = true
        let shortcut_to_id = get().shortcut_to_id_map
        for( let s of shortcut_to_id){
            if(s[1].size > 1){
                flag &&= false
            }
        }
        return flag;
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
                    if(vv.item as string !== ""){

                        if(tmp_sc_2_id.get(vv.item as string)?.size === undefined){
                            tmp_sc_2_id.set(vv.item as string, new Set<string>())
                            tmp_sc_2_id.get(vv.item as string)?.add(vv.id as string)
                            tmp_id_2_sc.set(vv.id as  string, vv.item as string)
                        }
                        else{
                            tmp_sc_2_id.get(vv.item as string)!.add(vv.id as string)
                            tmp_id_2_sc.set(vv.id as string, vv.item as string)
                            
                        }
                    }
                    }
                )
            }
        }
        set(state=>({...state, shortcut_id_to_shortcut_map : tmp_id_2_sc, shortcut_to_id_map : tmp_sc_2_id  }))
        set(state=>({...state, shortcut_validation : get().check_whole_shortcut() }))
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

