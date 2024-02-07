import { app, BrowserWindow } from "electron"

export type GlobalObject = {
    mainWindow? : BrowserWindow 
    pipWindow? : BrowserWindow 
    preferenceWindow? : BrowserWindow
    config? : Configure
    menu? : Object
}
type ItemType = CItem | CItem[] | number | boolean | string[] | string;

export type CItem = {
    [key: string]:  ItemType,

    id : string;
    name : string;
    item : ItemType;
}
export enum Locale{
    KR = "KR",
    EN = "EN"
}
export type LocaleItemType = LocaleItem | LocaleItem [] | LocaleItem| string 

export function isLocale(obj : any) : obj is LocaleItem{
    return (obj as LocaleItem).name !== "undefined" && (obj as LocaleItem).id !== "undefined"
}

export function isLocaleRoot(obj : any) : obj is LocaleRoot{
    return (obj as LocaleRoot).locale !== "undefined"
}
export function isLocaleList(obj : any) : obj is LocaleItem[]{
    return Array.isArray(obj) && obj.every(it => isLocale((it) ))
}
export function getLocaleProps(obj : LocaleRoot | LocaleItem | LocaleItem[], id : string[] | string) : LocaleRoot | LocaleItem | undefined{
    console.log("locale id : " , id)
    let id_list : string[]
    if(typeof id === "string"){
        id_list = id.split(".")
    }else{
        id_list = id
    }
    let key :string
    let next_id : string[] = []
    let id_length = id_list.length;

    if(id_length >= 1){

        key = id_list[0]
        if(id_length > 1)
            next_id = id_list.slice(1)
    }else{
        return undefined;
    }
    console.log("key", key)
    let next_id_length = next_id.length
    if(isLocaleRoot(obj)){
        if(key === obj.id){
            if(next_id_length === 0){
                console.log("locale root return")
                return obj
            }
            else{
                console.log("find from locale root items")
                return getLocaleProps(obj.item, next_id)
            }
        }

    }else if(isLocale(obj)){
        if(key === obj.id){
            if(next_id_length === 0){
                console.log("return Locale", obj.id)
                return obj 
            }
            else{
                console.log("check available locale item or list", obj.id)
                if(isLocale(obj.item) || isLocaleList(obj.item)){
                    console.log("searching locale item or list", obj.id)
                    return getLocaleProps(obj.item, next_id)
                }
            }
        }

    }else if(isLocaleList(obj)){
        let q : undefined | LocaleItem
        console.log("check locale list")
        for(let t of obj){
            if(t.id === key){
                q = t;
                break
            }
        }
        
        if (typeof q === "undefined"){
            console.log("fund q but undeinfed")
            return undefined
        }
        console.log("find q", q.id)
        
        if(next_id_length === 0){
            console.log("return it q", q.id)
            return q;
        }else{
            console.log("try to find inner item")
            if(isLocale(q.item) || isLocaleList(q.item)){
                console.log("going in")
                return getLocaleProps(q.item, next_id);
            }
        }
    }
    console.log("im gone")

    return undefined
}


export type LocaleRoot = {
    [key: string]: LocaleItemType
    id : string,
    name : string, 
    locale: string
    item : LocaleItem | LocaleItem[]
}
export type LocaleItem = {
    id:string,
    name : string,
    item? : LocaleItem
}

export type Configure = {
    [key: string]: ItemType;
    id:string,
    name : string,
    locale : string,
    item : CItem[]
}

export function combineKey(...keys:string[]) : string{
    return keys.reduce((a,b)=>a+"."+b)
}

export function isCItem(obj : any): obj is CItem{
    return (obj as CItem).id !== undefined && (obj as CItem) !== undefined && (obj as CItem).item !== undefined
}

export function isConfigure(obj : any) :obj is Configure {
    return (obj as Configure).locale !== undefined
}
export function isCItemArray(obj : any) :obj is CItem[] {
    return Array.isArray(obj) && obj.every(it => isCItem((it) ))
}

export function getProperty(obj : CItem | CItem[] | Configure, id : string | string[]) : undefined  | CItem {
    let re_flag = false
    let id_list : string[]
    if(typeof id === "string"){
        id_list = id.split(".")
    }else{
        id_list = id
    }
    let key :string
    let next_id : string[] = []
    let id_length = id_list.length;

    if(id_length >= 1){

        key = id_list[0]
        if(id_length > 1)
            next_id = id_list.slice(1)
    }else{
        return undefined;
    }
    let next_id_length = next_id.length
    if(isConfigure(obj)){
        if(key === obj.id){
            if(next_id_length === 0){
                return obj
            }
            else{
                return getProperty(obj.item, next_id)
            }
        }

    }else if(isCItem(obj)){
        if(key === obj.id){
            if(next_id_length === 0){
                return obj 
            }
            else{
                if(isCItem(obj.item) || isCItemArray(obj.item)){
                    return getProperty(obj.item, next_id)
                }
            }
        }

    }else if(isCItemArray(obj)){
        let q : undefined | CItem
        for(let t of obj){
            if(t.id === key){
                q = t;
                break
            }
        }
        
        if (typeof q === "undefined"){
            return undefined
        }
        
        if(next_id_length === 0){
            return q;
        }else{
            if(isCItem(q.item) || isCItemArray(q.item)){

                return getProperty(q.item, next_id);
            }
        }
    }
    
    return undefined
}


export type CWindowSize = {
    [key: string]: ItemType,

    preset_list : CItem,
    width : CItem ,
    height : CItem
}

export type CPiPLocation = {

    [key: string]: ItemType,
    preset_location_list : CItem,
    preset_monitor_list : CItem,
    location : CItem ,
    monitor : CItem 
}






