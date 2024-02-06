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

export type Configure = {
    [key: string]: ItemType;
    id:string,
    name : string,
    locale : string,
    item : CItem[]
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

export function getProperty(obj : CItem | CItem[] | Configure, id : string) : undefined  | CItem {
    let re_flag = false
    let id_list = id.split(".")
    let key = id_list[0]
    let next_id = ""
    let id_length = id_list.length;
    if(id_length === 1){
        ;
    }else{
        id_list.slice(1).forEach((v)=>next_id+=v)
    }
    
    if(isConfigure(obj)){
        if(key === obj.id){
            if(id_length === 1)
                return obj
            else
                return getProperty(obj.item, next_id)
        }

    }else if(isCItem(obj)){
        if(key === obj.id){
            if(id_length === 1){
                return obj 
            }
            else{
                if(isCItem(obj.item) && isCItemArray(obj.item))
                    return getProperty(obj.item, next_id)
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

        if(id_length === 1){
            return q;
        }else{
             if(isCItem(q.item) && isCItemArray(q.item))
                return getProperty(q.item, next_id);
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






