import {create} from "zustand"
import { Configure } from "../../typescript_src/definitions/types"
import produce from 'immer';



interface KawaiConf extends Configure{
    is_changed : Function;
    fetch : Function;
    copy_from : Function;
    set_pip_mode : Function ;
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
    }

})

export const useCurConfigureStore = create<KawaiConf>(context)

export const usePrevConfigureStore = create<KawaiConf>(context)

const test = create<KawaiConf>((set, get)=>({

    is_changed : (old : Configure, new_ : Configure)=> (get() !== new_),
    fetch : async (f : Function)=>{
        console.log("fetch!!!!")
        const response : Configure = await f();
        console.log(response)
        console.log("test! end")
        console.log("fetch!!!! end")
        set(response)
    },
    copy_from : (conf : Configure)=>set(conf),
    set_pip_mode : (t)=>{}
})
)