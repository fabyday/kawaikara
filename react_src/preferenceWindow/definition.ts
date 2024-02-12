import {create} from "zustand"
import { CItem, Configure, ItemType, getProperty } from "../../typescript_src/definitions/types"
import produce from 'immer';
import lodash from "lodash"

interface testobj{
    bear : number 
    test : string
}


interface test {
    bear : testobj;

    add : ()=>void,
    get_bear : ()=>number
    
}
export let testa = create<test>((set, get)=>({
    bear : {bear : 0, test : ""},
    add : ()=> { 
        console.log("added occur!")
        set(( state )=>{
            let tets = lodash.cloneDeep(state)
            tets.bear.bear += 1
            return tets;
        }) 
        

    },
    get_bear : ()=>get().bear.bear

}))
interface KawaiConf {
    configure :  Configure | undefined;

    is_changed : (old : Configure, new_ : Configure)=>boolean;
    fetch : (f:()=>Promise<any>)=>void;
    get_property : (id : string)=>CItem | undefined;
    set_property : (id: string, item_value : ItemType) => void
    copy_from : (conf : Configure)=>void;
    
}

type set_type = (partial: KawaiConf | Partial<KawaiConf> | ((state: KawaiConf) => KawaiConf | Partial<KawaiConf>), replace?: boolean | undefined) => void
type get_type = ()=>KawaiConf
let context = (set :set_type, get : get_type)=>({
    configure : undefined,
    is_changed : (old : Configure, new_ : Configure)=> (get().configure !== new_),
    fetch : async (f :  ()=>Promise<any>)=>{
        const response : Configure = ((await f()) as Configure);
        set((state)=>({...state, configure : response}))
    },
    copy_from : (conf : Configure)=>{
        set((state)=>({
            ...state ,
            configure : lodash.cloneDeep(conf)
        }))
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

