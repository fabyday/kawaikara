import {BrowserWindow} from "electron"
import * as path from 'path'
import * as fs from 'fs'
import { Configure } from "../definitions/types";


let preferenceWindow : BrowserWindow | null   = null;





export const get_instance = (conf:Configure):BrowserWindow =>{
    if ( preferenceWindow === null ){
        preferenceWindow = new BrowserWindow(
            {
            width: 600,
            height: 800,
            icon: path.join(__dirname, '../../resources/icons/kawaikara.ico'),
            resizable : false,
            
            webPreferences: {
              preload: path.join(__dirname, 'predefine/preference_predef.ts'),
              backgroundThrottling : !conf.general!.render_full_size_when_pip_running
            }
      
                
        }
        );
        preferenceWindow.setMenu(null);
        preferenceWindow.loadURL("http://localhost:3000/preference.html")
        // preferenceWindow.hide();
    }
    
    return preferenceWindow;
}



