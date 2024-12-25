import { app, BrowserWindow, BrowserView } from "electron"
import lodash from 'lodash';






export type kawaiProperty = {
    id : string,
    parent_id : string
}


export type KawaiTemplateValue<T> = {value : T}
// default property
export type KawaiBoolProperty = kawaiProperty & KawaiTemplateValue<boolean>
export type KawaiStringProperty = kawaiProperty & KawaiTemplateValue<string>
export type KawaiNumberProperty = kawaiProperty & KawaiTemplateValue<number>


//this is alias
export type KawaiId = kawaiProperty & KawaiTemplateValue<string>




// export type ItemType = CItem | CItem[] | number | boolean | string[] | string;

// enum item_meta{
//     bool  = "boolean",
//     CItem  = "CItem",
//     CItemList  = "CItemList",
//     number = "number",
//     stringList = "StringLIst",
//     string = "string",
// }

// // item_meta : item_meta
// export type CItem = {
//     [key: string]:  ItemType,
//     id : string;
//     name : string;
//     item : ItemType;
// }
// export enum Locale{
//     KR = "KR",
//     EN = "EN",
//     Sys = "System Locale"
// }

// export type LocaleItemType = LocaleItem | LocaleItem [] | LocaleItem| string 

// export type LocaleRoot = {
//     [key: string]: LocaleItemType
//     id : string,
//     name : string, 
//     locale: string
//     item : LocaleItem | LocaleItem[]
// }
// export type LocaleItem = {
//     id:string,
//     name : string,
//     item? : LocaleItem | LocaleItem[]
// }

// export function isLocale(obj : any) : obj is LocaleItem{
//     return (obj as LocaleItem).name !== undefined && (obj as LocaleItem).id !== undefined
// }

// export function isLocaleRoot(obj : any) : obj is LocaleRoot{
//     return (obj as LocaleRoot).locale !== undefined 
// }
// export function isLocaleList(obj : any) : obj is LocaleItem[]{
    
//     return Array.isArray(obj) && obj.every(it => isLocale((it) ))
// }
// export function getLocaleProps(obj : LocaleRoot | LocaleItem | LocaleItem[], id : string[] | string) : LocaleRoot | LocaleItem | undefined{
//     let id_list : string[]
//     if(typeof id === "string"){
//         id_list = id.split(".")
//     }else{
//         id_list = id
//     }
//     let key :string
//     let next_id : string[] = []
//     let id_length = id_list.length;

//     if(id_length >= 1){

//         key = id_list[0]
//         if(id_length > 1)
//             next_id = id_list.slice(1)
//     }else{
//         return undefined;
//     }
    
    
//     let next_id_length = next_id.length
//     if(isLocaleRoot(obj)){
//         if(key === obj.id){
//             if(next_id_length === 0){
//                 return obj
//             }
//             else{
//                 return getLocaleProps(obj.item, next_id)
//             }
//         }

//     }
//     else if(isLocale(obj)){

//         if(key === obj.id){
//             if(next_id_length === 0){
//                 return obj 
//             }
//             else{
//                 if(isLocale(obj.item) || isLocaleList(obj.item)){
//                     return getLocaleProps(obj.item, next_id)
//                 }
//             }
//         }

//     }
//     else if(isLocaleList(obj)){
//         let q : undefined | LocaleItem
//         for(let t of obj){
//             if(t.id === key){
//                 q = t;
//                 break
//             }
//         }
        
//         if (typeof q === "undefined"){
//             return undefined
//         }
        
//         if(next_id_length === 0){
//             return q;
//         }else{
//             if(isLocale(q.item) || isLocaleList(q.item)){
//                 return getLocaleProps(q.item, next_id);
//             }
//         }
//     }
    
//     return undefined
// }



// export type Configure = {
//     [key: string]: ItemType;
//     id:string,
//     name : string,
//     item : CItem[]
// }

// export function combineKey(...keys:string[]) : string{
//     return keys.reduce((a,b)=>a+"."+b)
// }

// export function isCItem(obj : any): obj is CItem{
//     return (obj as CItem).id !== undefined && (obj as CItem) !== undefined && (obj as CItem).item !== undefined
// }

// export function isConfigure(obj : any) :obj is Configure {
//     return (obj as Configure).locale !== undefined
// }
// export function isCItemArray(obj : any) :obj is CItem[] {
//     return Array.isArray(obj) && obj.every(it => isCItem((it) ))
// }

// export function getProperty(obj : CItem | CItem[] | Configure, id : string | string[]) : undefined  | CItem {
//     let id_list : string[]
//     if(typeof id === "string"){
//         id_list = id.split(".")
//     }else{
//         id_list = id
//     }
//     let key :string
//     let next_id : string[] = []
//     let id_length = id_list.length;

//     if(id_length >= 1){
        
//         key = id_list[0]
//         if(id_length > 1)
//             next_id = id_list.slice(1)
//     }else{
//         return undefined;
//     }
//     let next_id_length = next_id.length
//     if(isConfigure(obj)){
//         if(key === obj.id){
//             if(next_id_length === 0){
//                 return obj
//             }
//             else{
//                 return getProperty(obj.item, next_id)
//             }
//         }

//     }else if(isCItem(obj)){
//         if(key === obj.id){
//             if(next_id_length === 0){
//                 return obj 
//             }
//             else{
//                 if(isCItem(obj.item) || isCItemArray(obj.item)){
//                     return getProperty(obj.item, next_id)
//                 }
//             }
//         }

//     }else if(isCItemArray(obj)){
//         let q : undefined | CItem
//         for(let t of obj){
//             if(t.id === key){
//                 q = t;
//                 break
//             }
//         }
        
//         if (typeof q === "undefined"){
//             return undefined
//         }
        
//         if(next_id_length === 0){
//             return q;
//         }else{
//             if(isCItem(q.item) || isCItemArray(q.item)){

//                 return getProperty(q.item, next_id);
//             }
//         }
//     }
    
//     return undefined
// }


// export type CWindowSize = {
//     [key: string]: ItemType,

//     preset_list : CItem,
//     width : CItem ,
//     height : CItem
// }

// export type CPiPLocation = {

//     [key: string]: ItemType,
//     preset_location_list : CItem,
//     preset_monitor_list : CItem,
//     location : CItem ,
//     monitor : CItem 
// }

// export function isEqualConfigure(conf1 : Configure, conf2 : Configure) : boolean{

//     conf1 = lodash.cloneDeep(conf1)
//     conf2 = lodash.cloneDeep(conf2)
//     const  isArrayOfStrings = (value: unknown): value is string[]=> {
//         return Array.isArray(value) && value.every(item => typeof item === "string");
//      }
//     const traveller_f = (o1 : ItemType, o2 : ItemType):boolean=>{
//         let flag = true
//         if(isCItemArray(o1) && isCItemArray(o2)){
//             if(o1.length !== o2.length)
//                 return false
            
//             let o1_ids = o1.map(v=>v.id)
//             let o2_ids = o2.map(v=>v.id)
            
//             for(let o2id of o2_ids)
//                 flag &&= o1_ids.includes(o2id)
            
//             if( !flag )
//                 return flag 

//             o1.sort((a,b)=>(a.id.toUpperCase() > b.id.toUpperCase() ? 1 : -1 ) )
//             o2.sort((a,b)=>(a.id.toUpperCase() > b.id.toUpperCase() ? 1 : -1 ) )
//             let o1_item = o1.map(v=>v.item)
//             let o2_item = o2.map(v=>v.item)

//             for(let i = 0; i < o2_item.length; i++){
//                 let o1item = o1_item[i]
//                 let o2item = o2_item[i]
//                 flag &&= traveller_f(o1item, o2item)
//             }
//         }else if(isCItem(o1) && isCItem(o2)){
//             if(o1.id !== o2.id)
//                 return false
            
//             let o1_item = o1.item
//             let o2_item = o2.item
//             flag &&= traveller_f(o1_item, o2_item)
//         }else{
//             if( isArrayOfStrings(o1) && isArrayOfStrings(o2)){ // string array
//                 if(o1.length !== o2.length)
//                     return false

//                 for(let item_elem of o1){
//                     flag &&= o2.includes(item_elem)
//                 }
//             }else{
//                 flag &&= o1 === o2
//             }
//         }
//         return flag
//     }

//     return traveller_f(conf1.item, conf2.item);
// }



