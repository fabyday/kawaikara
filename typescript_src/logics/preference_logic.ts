


import { GlobalObject, CItem, CPiPLocation, Configure, CWindowSize, Locale, getProperty, LocaleRoot, combineKey, isCItem, isCItemArray, getLocaleProps } from '../definitions/types';
import { BrowserWindow, app, nativeTheme } from "electron"

import * as path from "node:path"
import * as fs from "node:fs"
import { Config } from "@cliqz/adblocker-electron";
import { set_autoupdater, unset_autoupdater } from '../component/autoupdater';
function apply_resize_window(gobj : GlobalObject, conf : Configure){
    console.log("apply resize window")
    console.log(getProperty(conf, combineKey("configure.general.window_size.width"))?.item)
    console.log(getProperty(conf, combineKey("configure.general.Height"))?.item)

    gobj.mainWindow?.setSize(   getProperty(conf, combineKey("configure.general.window_size.width"))?.item as number ?? 800,  
                                getProperty(conf, combineKey("configure.general.window_size.height"))?.item as number ?? 600
                                )
}
function apply_pip_window_size(gobj : GlobalObject, conf : Configure){

}


function apply_pipmode(gobj : GlobalObject, conf : Configure){
//     gobj.mainWindow?.setAlwaysOnTop

    const pip_mode = getProperty(conf, "configure.general.pip_mode")!.item as boolean ?? false
    const width = getProperty(conf, "configure.general.pip_window_size.width")!.item as number ?? 800
    const height = getProperty(conf, "configure.general.pip_window_size.height")!.item as number ?? 600
// var pip_mode = false;
// var cur_loc = null;
// function pip_event(mitem, win, event){
//   pip_mode = !pip_mode
  
//   const winBounds = win.getBounds();
//   const whichScreen = screen.getDisplayNearestPoint({x: winBounds.x, y: winBounds.y});
//   if (pip_mode){
//     cur_loc = winBounds
//     new_x = whichScreen.bounds.width - winBounds.width 
//     new_y = 0
//     console.log(new_x)
//     console.log(new_y)
    
//     // Returns the screen where your window is located
//     console.log(winBounds)
//     console.log(whichScreen)
//     win.setPosition(new_x, new_y)  
//     // normal, floating, torn-off-menu, modal-panel, main-menu, status, pop-up-menu, screen-saver
//     win.setAlwaysOnTop(pip_mode, "main-menu")
//     win.setMovable(!pip_mode)

//     win.setResizable(!pip_mode)
//     // win.setIgnoreMouseEvents(true)
//     console.log("Testemnd1")
//   }else{
//     win.setAlwaysOnTop(pip_mode)
//     win.setPosition(cur_loc.x, cur_loc.y)
//     win.setMovable(!pip_mode)
//     win.setResizable(!pip_mode)
//   }
// }

}

function apply_autoupdate(gobj : GlobalObject, conf : Configure){
    console.log("apply auto update")
    if(getProperty(conf, "configure.general.enable_autoupdate")!.item){
        set_autoupdater()
    }else{
        unset_autoupdater()
    }

}

function apply_darkmode(gobj : GlobalObject, conf : Configure){
    console.log(getProperty(conf, "configure.general.dark_mode"))
    if(getProperty(conf, "configure.general.dark_mode")!.item){
        nativeTheme.themeSource = 'dark'
    }
    else{
        nativeTheme.themeSource = 'light'
    }
    gobj.mainWindow?.reload()
}

function apply_render_full_size_when_pip_running(gobj:GlobalObject, conf : Configure){

}




function apply_general(gobj : GlobalObject, conf : Configure){
    apply_autoupdate(gobj, conf)
    apply_darkmode(gobj, conf)
    apply_resize_window(gobj, conf)

}

function apply_shortcuts(gobj : GlobalObject, conf : Configure){
    
}

export function apply_all(gobj : GlobalObject, conf : Configure){
    apply_general(gobj, conf)
    apply_shortcuts(gobj, conf)
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
      
    let locale_json_root : LocaleRoot = read_locale_conf()["configure"];
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

function locale_file_mapper(locale_name : string){
    switch(locale_name){
        case "en-US" :
            return "EN.json"
        case "ko":
            return "KR.json"
        default:
            return "EN.json"
    }
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
        default : // System Locale
            const system_locale_fname = locale_file_mapper(app.getSystemLocale())
            console.log("locL", app.getSystemLocale())
            conf = apply_locale_from_file(conf, path.join(locale_dir, system_locale_fname))
            break;
    }
    return conf;
}


export function apply_configure(gobj : GlobalObject, conf : Configure){
    apply_all(gobj, conf)
    // if(conf.general !== undefined){
    //     apply_general(gobj, conf.general)
    // }

    // if(conf.shortcut !== undefined){
    //     apply_shortcuts(gobj, conf.shortcut)
    // }
}


