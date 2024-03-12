import {BrowserWindow, ipcMain, app, screen} from "electron"
import * as path from 'path'
import * as fs from 'fs'
import { Configure, getProperty, GlobalObject } from '../definitions/types';
import { Event } from "electron/main";
import { apply_all, apply_locale } from "../logics/preference_logic";

let preferenceWindow : BrowserWindow | null   = null;




export const get_instance = (conf:Configure):BrowserWindow =>{
    if ( preferenceWindow === null ){
        
        preferenceWindow = new BrowserWindow(
            {
            // width: 600,
            width: 600,
            height: 800,
            icon: path.join(__dirname, '../../resources/icons/kawaikara.ico'),
            // resizable : false,
            webPreferences: {
                contextIsolation: true,
              preload: path.join(__dirname, 'predefine/preference_predef.js'),
            }
      
                
        }
        );
        preferenceWindow.setMenu(null);
        let html_path =  path.resolve(__dirname, "./public/preference.html")
        // mainView.loadURL(process.env.IS_DEV?"http://localhost:3000/preference.html" : html_path)
        
        console.log("process.env.IS_DEV :", process.env.IS_DEV)
        // preferenceWindow.loadURL(process.env.IS_DEV ? "http://localhost:3000/preference.html" : html_path)
        

        preferenceWindow.on("closed", ()=>{preferenceWindow = null; })
        preferenceWindow.loadURL(process.env.IS_DEV?"http://localhost:3000/preference.html" : html_path)
        preferenceWindow.webContents.on("did-finish-load", (evt : Event)=>{
            if(process.env.IS_DEV){
                preferenceWindow?.setSize(1200, 600)
                preferenceWindow!.webContents.openDevTools();

            }
            preferenceWindow!.webContents.send("setup-configure", conf)
        })

        console.log(preferenceWindow.webContents.isDevToolsOpened())
        // preferenceWindow.hide();
        
    }
    
    return preferenceWindow;
}



