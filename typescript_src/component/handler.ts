import { BrowserWindow, ipcMain } from "electron";
import { KAWAI_API_LITERAL } from "../definitions/api";

function connectMainViewHandler( window : BrowserWindow ){
    
}

function connectMainProcessHandler(){
    ipcMain.on(KAWAI_API_LITERAL.preference.apply_modified_preference, ()=>{

    })
    ipcMain.on(KAWAI_API_LITERAL.preference.close, ()=>{

    })
    ipcMain.on(KAWAI_API_LITERAL.preference.load_config, ()=>{

    })
}