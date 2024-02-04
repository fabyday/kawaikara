


import {GlobalObject, CItem, CGeneral, CShortcut, Configure, CWindowSize, Locale} from "../definitions/types"
import { BrowserWindow, app } from "electron"

import * as path from "node:path"

function apply_resize_window(gobj : BrowserWindow, size : CWindowSize){

}



function apply_pipmode(gobj : GlobalObject, enable : boolean){



}

function apply_autoupdate(gobj : GlobalObject, enable : boolean){



}

function apply_darkmode(gobj : GlobalObject, enable : boolean){

}

function apply_render_full_size_when_pip_running(gobj:GlobalObject, enable : boolean){

}




function apply_general(gobj : GlobalObject, general_conf : CGeneral){

}

function apply_shortcuts(gobj : GlobalObject, shortcuts : CShortcut){

}


function apply_locale_from_file(conf : Configure, file_path:string){
    
    let conf_key  = Object.keys(conf)
    let stack  : string[] = conf_key;
    let key :string = stack.pop() as string;
    console.log(key)
    let id_stack: string[] =  []
    while(key !== undefined){
        // console.log(conf)
        console.log(key)

        // console.log(conf[key])
        
        

    }


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


