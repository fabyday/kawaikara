import {BrowserWindow} from "electron"

let preferenceWindow : BrowserWindow | null   = null;





const get_instance = ():BrowserWindow =>{
    if ( preferenceWindow === null ){
        preferenceWindow = new BrowserWindow();
    }
    return preferenceWindow ;
}

module.exports.get_instance = get_instance


