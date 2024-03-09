import { ContextBridge, contextBridge, ipcRenderer } from "electron";
import { Configure } from "../../definitions/types";



let apply_changed_preference_f = (configure : Configure)=>{
    ipcRenderer.invoke("apply-changed-preference", configure)
}
let save_and_close_f = (configure : Configure)=>{
    apply_changed_preference_f(configure); ipcRenderer.invoke("close")
}

let just_close_f = ()=>{ipcRenderer.invoke("close")}

let get_data_f = ()=>{return ipcRenderer.invoke("get-data")}

contextBridge.exposeInMainWorld("preference_api",{
    save_and_close : save_and_close_f,
    apply_changed_preference : apply_changed_preference_f,
    get_data : get_data_f,
    just_close_preference_window : just_close_f
})
console.log("load api")

