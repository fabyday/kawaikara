import {create} from "zustand"
import { Configure } from "../../typescript_src/definitions/types"
import produce from 'immer';
import lodash from "lodash"


interface KawaiConf extends Configure{
    is_changed : Function;
    fetch : Function;
    copy_from : Function;
    set_pip_mode : Function ;

    set_general_item : Function ;
    set_item : Function;
    
}

let context = (set : (partial: KawaiConf | Partial<KawaiConf> | ((state: KawaiConf) => KawaiConf | Partial<KawaiConf>), replace?: boolean | undefined) => void, 
    


    get : ()=>KawaiConf )=>({

    is_changed : (old : Configure, new_ : Configure)=> (get() !== new_),
    fetch : async (f : Function)=>{
        const response : Configure = await f();
        set(response)
    },
    copy_from : (conf : Configure)=>set(conf),
// see
// https://stackoverflow.com/questions/66869106/how-to-set-object-key-in-state-using-zustand
    set_pip_mode : (bool : boolean)=>
    { 
        set( (state) =>({"general" : {...state.general, pip_mode : bool}, "shortcut" : state.shortcut}) )
    },

    set_item : ( key : string, value : any) =>{

        let id_segs : string[] = key.split(".")
        console.log("key", key)
        console.log("va", value)
        console.log("id_segs", id_segs)
        
        set((state)=>{
            let res = lodash.cloneDeep(state)
            let component = res;
            console.log(res)
            let i = 0;
            console.log(i, component)
            for(; i < id_segs.length -1; i++){
                component = component[id_segs[i]]
                console.log(i, component)
                
            }
            console.log(i)
            component[id_segs[i]] = value;
            console.log(i, component)
            console.log("my teste")
            console.log(state.general)
            console.log(state.shortcut)
            return res;

        }
            
            
        )

    }
})

export const useCurConfigureStore = create<KawaiConf>(context)

export const usePrevConfigureStore = create<KawaiConf>(context)

