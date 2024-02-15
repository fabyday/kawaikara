


import { GlobalObject, CItem, CPiPLocation, Configure, CWindowSize, Locale, getProperty, LocaleRoot, combineKey, isCItem, isCItemArray, getLocaleProps } from '../definitions/types';
import { BrowserWindow, app } from "electron"

import * as path from "node:path"
import * as fs from "node:fs"
import { Config } from "@cliqz/adblocker-electron";
function apply_resize_window(gobj : BrowserWindow, conf : Configure){

}



function apply_pipmode(gobj : GlobalObject, conf : Configure){



}

function apply_autoupdate(gobj : GlobalObject, conf : Configure){



}

function apply_darkmode(gobj : GlobalObject, conf : Configure){

}

function apply_render_full_size_when_pip_running(gobj:GlobalObject, conf : Configure){

}




function apply_general(gobj : GlobalObject, conf : CItem){

}

function apply_shortcuts(gobj : GlobalObject, conf : CItem){

}

export function apply_all(gobj : GlobalObject, conf : Configure){
    getProperty(conf, "configure.general")
    getProperty(conf, "configure.shortcut")
}

function apply_locale_from_file(conf : Configure, file_path:string){
    function read_locale_conf(){
        let jsonData : any;
        console.log(app.getPath("appData"))
        try {
          let rawData = fs.readFileSync(file_path, 'utf-8');
          jsonData = JSON.parse(rawData);
      
        } catch (err) {
          console.log("err : read failed.")
        }

        return jsonData
      }
      
    let locale_json_root : LocaleRoot = read_locale_conf();
    if (typeof locale_json_root !== "undefined"){
        let current_key_list = [conf.id]
        console.log("start at... ", current_key_list)
        while(true){
            // combineKey
            let key : undefined| string = current_key_list.pop()
            if(typeof key === "undefined")
                break;
            
            let prop = getProperty(conf, key)
            let locale_prop = getLocaleProps(locale_json_root, key)
            if(typeof prop !== "undefined"){
                if(typeof locale_prop !== "undefined"){
                    prop.name = locale_prop.name

                }
            
                if(isCItem(prop.item) ){
                    current_key_list.push(combineKey(key!,prop.item.id))
                    
                }else if(isCItemArray(prop.item)){
                    for(let item of prop.item){
                        current_key_list.push(combineKey(key!, item.id))
                    }
                }
                

            }
        }
    }
    console.log(conf.item[0])

    return conf;
}


export function apply_locale(conf : Configure, locale : (string | Locale)  ){
let locale_dir =  path.join(__dirname, "../../locales")
console.log(locale_dir)
    switch(locale){
        case Locale.KR:
            conf = apply_locale_from_file(conf, path.join(locale_dir, "KR.json"))
            break;
        case Locale.KR:
            conf = apply_locale_from_file(conf, path.join(locale_dir, "EN.json"))
            break;
        default : 
            break;
    }
    return conf;
}


export function apply_configure(gobj : GlobalObject, conf : Configure){
    // if(conf.general !== undefined){
    //     apply_general(gobj, conf.general)
    // }

    // if(conf.shortcut !== undefined){
    //     apply_shortcuts(gobj, conf.shortcut)
    // }
}


