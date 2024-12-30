import { app } from "electron";
import { set_config } from "./configures";
import { global_object } from "../data/context";
import { data_root_path, default_app_states_path } from "../component/constants";
import path from "path";

import * as fs from "fs"
import { KawaiContext } from "../definitions/context";





function initialize_global_object(root_path ?: string){

    var root_pth :string;
    if(typeof root_path === "string"){
        root_pth = root_path
    }else{
        root_pth = data_root_path
    }


    let rawData = fs.readFileSync(path.join(root_pth, default_app_states_path), 'utf8');
    let jsonData = JSON.parse(rawData) ;
    const unknown_state : unknown = jsonData as unknown; // remove syntax error
    const state = unknown_state as KawaiContext

    global_object.context = {current_window_bounds : {...state.current_window_bounds} };
}





/**
 * 
 * @param config_root : config file root. if it was undefined, 
 * then find config and states files in AppData on windows and OS specific default app path 
 */
export function initialize( config_root ?: string ){    

    initialize_global_object(config_root);

    if(typeof config_root === "string"){
        set_config(config_root);
    }else{
        set_config(app.getAppPath());
    }

}