import {BrowserWindow} from "electron"

let mainView : BrowserWindow | null   = null;





const get_instance = ():BrowserWindow =>{
    if ( mainView === null ){
        mainView = new BrowserWindow;
    }
    return mainView ;
}

module.exports.get_instance = get_instance


