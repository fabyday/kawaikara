import {BrowserWindow, ipcMain, app, screen} from "electron"
import * as path from 'path'
import * as fs from 'fs'
import { Configure, getProperty } from "../definitions/types";
import { Event } from "electron/main";
import { apply_locale } from "../logics/preference_logic";

let preferenceWindow : BrowserWindow | null   = null;




export const get_instance = (conf:Configure):BrowserWindow =>{
    if ( preferenceWindow === null ){
        apply_locale(conf, "KR")

        preferenceWindow = new BrowserWindow(
            {
            // width: 600,
            width: 1200,
            height: 800,
            icon: path.join(__dirname, '../../resources/icons/kawaikara.ico'),
            // resizable : false,
            
            webPreferences: {
                contextIsolation: true,
              preload: path.join(__dirname, 'predefine/preference_predef.js'),
            }
      
                
        }
        );
        console.log("locale check!")
        preferenceWindow.setMenu(null);
        preferenceWindow.loadURL("http://localhost:3000/preference.html")
        preferenceWindow.webContents.on("did-finish-load", (evt : Event)=>{
            preferenceWindow!.webContents.openDevTools();

            preferenceWindow!.webContents.send("setup-configure", conf)
        })

        
        // conf.general?.pip_location?.preset_monitor_list =  [screen.getAllDisplays()]
        console.log(preferenceWindow.webContents.isDevToolsOpened())
        // preferenceWindow.hide();
        ipcMain.handle("get-data", ()=>conf)
    }
    
    return preferenceWindow;
}



