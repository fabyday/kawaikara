// import {create} from "zustand"
// import { KawaiConfig } from "../../typescript_src/definitions/setting_types";
// import { KawaiLocale } from "../../typescript_src/definitions/setting_types";

// let context = (set :set_type, get : get_type)=>({
//     configure : undefined,
//     locale : undefined,
//     is_changed : (new_ : Configure)=>{
//         let c = get()
//         if(typeof c.configure === "undefined")
//             // return typeof new_ === "undefined"
//             return false
//         return isEqualConfigure(c.configure, new_) 
//     },
//     fetch_locale : async (  f : ()=>Promise<any>) =>{

//     },
    
//     fetch_favorites : async (  f : ()=>Promise<any>) =>{

//     },
//     recieve_changed : async (f : ()=>Promise<any>)=>{

//     },
//     set_locale: (data:any)=>{},
//     set_favorites: (data:any)=>{},
//     get_locale: (data:any)=>{},
//     get_favorites: (data:any)=>{},
    
//     copy_from : (conf : Configure)=>{
//         set((state)=>({
//             ...state ,
//             configure : lodash.cloneDeep(conf)
//         }))
//         let t= get().configure 
//         if(typeof t !== 'undefined'){
//             console.log("console.log : copy from is called" )

//         }
//     },
//     get_property : (id:string)=>{
//         let conf = get().configure
//         if(typeof conf !== "undefined"){
//             let item = getProperty(conf, id)
//             return item;
//         }
//         return undefined
//     },
//     set_property : (id: string, item_value : ItemType)=>{
//         set((state)=>{
//             if(typeof state.configure !== "undefined"){
//                 let porperty = getProperty(state.configure, id)
//                 if(typeof porperty !== "undefined"){
//                     porperty.item = item_value
//                     return  lodash.cloneDeep(state)
//                 }
//             }
//             return state;
//         })
//     },
// });

// export const useCurConfigureStore = create<KawaiConf>(context)
