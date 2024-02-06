


import {GlobalObject, CItem, CPiPLocation, CGeneral, CShortcut, Configure, CWindowSize, Locale, getProperty} from "../definitions/types"
import { BrowserWindow, app } from "electron"

import * as path from "node:path"
import * as fs from "node:fs"
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
    function read_locale_conf(){
        let jsonData : any;
        console.log(app.getPath("appData"))
        try {
          let rawData = fs.readFileSync(file_path, 'utf8');
          jsonData = JSON.parse(rawData);
      
        } catch (err) {
          console.log("err : read failed.")
        }

        return jsonData
      }
      


    let locale_json_root = read_locale_conf();
    if (typeof locale_json_root !== "undefined"){
        let this_name = conf.name
        let locale = locale_json_root
        for(let item of conf.item){
            item.name
            getProperty(conf, this_name)
            let id = item.id
            let locale_name :string = locale[id]
            item.name = locale_name;
        }

        
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


