


import { GlobalObject, CItem, CPiPLocation, Configure, CWindowSize, Locale, getProperty, LocaleRoot, combineKey, isCItem, isCItemArray, getLocaleProps } from '../definitions/types';
import { BrowserWindow, Display, app, nativeTheme, screen } from "electron"

import * as path from "node:path"
import * as fs from "node:fs"
import { Config } from "@cliqz/adblocker-electron";
import { set_autoupdater, unset_autoupdater } from '../component/autoupdater';
import { attach_menu } from '../component/menu';
function apply_resize_window(gobj : GlobalObject, conf : Configure){
    console.log("apply resize window")
    console.log(getProperty(conf, combineKey("configure.general.window_size.width"))?.item)
    console.log(getProperty(conf, combineKey("configure.general.window_size.height"))?.item)
    const pip_mode = getProperty(conf, "configure.general.pip_mode")!.item! as boolean 
    console.log("Test", pip_mode)
    if(!pip_mode){
        gobj.mainWindow?.setSize (   getProperty(conf, combineKey("configure.general.window_size.width"))?.item as number,  
                                    getProperty(conf, combineKey("configure.general.window_size.height"))?.item as number
                                    )

    }
}
function apply_pip_window_size(gobj : GlobalObject, conf : Configure){

}



let main_loc_x = 2 
let main_loc_y = 2 


let is_pip_mode_running = false
export function apply_pipmode(gobj : GlobalObject, conf : Configure){
//     gobj.mainWindow?.setAlwaysOnTop

    const pip_mode = getProperty(conf, "configure.general.pip_mode")!.item! as boolean 
    const width = getProperty(conf, "configure.general.pip_window_size.width")!.item as number 
    const height = getProperty(conf, "configure.general.pip_window_size.height")!.item as number 
    const location = getProperty(conf, "configure.general.pip_location.location")!.item as string
    const monitor_label = getProperty(conf, "configure.general.pip_location.monitor")!.item as string
    console.log("pip_mode", pip_mode)
    console.log("pip_mode", width)
    console.log("pip_mode", height)
    console.log("pip_mode", location)
    console.log(monitor_label)
    
    
    
    const all_displays = screen.getAllDisplays()
    const prev_win_bounds = gobj.mainWindow!.getBounds();
    console.log(prev_win_bounds)
    gobj.mainWindow?.setMovable(true)
    gobj.mainWindow?.setResizable(true)
    gobj.mainWindow?.setSize(width, height, true);
    const winBounds = gobj.mainWindow!.getBounds();
    console.log(winBounds)
    let min_padding = 2
    let selected_display : Display|null = null
    for(let display of all_displays){
        if(display.label === monitor_label){
            selected_display = display
            

             break;   
                
                
            }
        }
        

        let left_pos_x = min_padding
        let left_pos_y = min_padding
        if(selected_display){
            console.log("location", location)
            switch(location){
                case "top-right":{
                    console.log("sel dis ", selected_display.bounds)
                    console.log("sel dis ", left_pos_x)
                    console.log("sel dis ", width)
                    left_pos_x = selected_display.bounds.x + selected_display.bounds.width - width - min_padding
                    console.log("sel dis ", left_pos_x)
                    console.log("sel dis ", left_pos_x+width)
                    left_pos_y = selected_display.bounds.y + min_padding
                    break;
                }
                case "top-left":{
                    left_pos_x = selected_display.bounds.x + min_padding
                    left_pos_y = selected_display.bounds.y + min_padding
                    break;
                }
                case "bottom-left":{
                    left_pos_x = selected_display.bounds.x + min_padding 
                    left_pos_y = selected_display.bounds.y  + selected_display.bounds.height - height - min_padding
                    
                    break; 
                }
                case "bottom-right":{
                    left_pos_x = selected_display.bounds.x + selected_display.bounds.width - width - min_padding
                    left_pos_y = selected_display.bounds.y + selected_display.bounds.height - height - min_padding
                    break;
                }
            }
        }
        gobj.mainWindow?.setMovable(!pip_mode)
        gobj.mainWindow?.setResizable(!pip_mode)
        gobj.mainWindow?.setAlwaysOnTop(pip_mode, "main-menu")
        if(pip_mode && !is_pip_mode_running){
            is_pip_mode_running = true
            main_loc_x  = prev_win_bounds.x
            main_loc_y  = prev_win_bounds.y
            console.log("main_loc x y",main_loc_x, " ", main_loc_y)
            gobj.mainWindow?.setPosition(left_pos_x, left_pos_y, true)
            
            
        }else if (pip_mode && is_pip_mode_running){
            gobj.mainWindow?.setPosition(left_pos_x, left_pos_y, true)
            
        }
        else{
            is_pip_mode_running = false
            apply_resize_window(gobj, conf)
            gobj.mainWindow?.setPosition(main_loc_x, main_loc_y, true)
        }
        console.log("bb", gobj.mainWindow?.getBounds())
        
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

    apply_pipmode(gobj, conf)

}

function apply_shortcuts(gobj : GlobalObject, conf : Configure){
    attach_menu(gobj, conf)
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


