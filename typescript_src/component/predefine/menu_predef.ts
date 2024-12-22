import { ContextBridge, contextBridge, ipcRenderer } from "electron";
import { Configure } from "../../definitions/types";



let apply_changed_preference_f = (configure : Configure)=>{
    ipcRenderer.invoke("apply-changed-preference", configure)
}
let save_and_close_f = (configure : Configure)=>{
    apply_changed_preference_f(configure); ipcRenderer.invoke("close")
}

let just_close_f = ()=>{ipcRenderer.invoke("close")}

let initialize_data_f = ()=>{return ipcRenderer.invoke("initialize_data")}

contextBridge.exposeInMainWorld("menu_api",{
    open : save_and_close_f, // open url or functional things. like using PIP mode and so on.
    initialize_data : initialize_data_f, // when app was started first time. load menu data and favorites.
    add_favorites : initialize_data_f, // add favorites and notify to main process.
    chnage_order_favorites : initialize_data_f, //change favorites order and notify it to main process.
    remove_favorites : initialize_data_f, // notify to main process and remove favorites.
    close_menu : initialize_data_f,  // notify close menu bar signal to main process.
})
console.log("load api")

