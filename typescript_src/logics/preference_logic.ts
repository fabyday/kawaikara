


import {GlobalObject, CGeneral, CShortcut, Configure, CWindowSize} from "../definitions/types"
import { BrowserWindow } from "electron"


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

export function apply_configure(gobj : GlobalObject, conf : Configure){
    if(conf.general !== undefined){
        apply_general(gobj, conf.general)
    }

    if(conf.shortcut !== undefined){
        apply_shortcuts(gobj, conf.shortcut)
    }
}


