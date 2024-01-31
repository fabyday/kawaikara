import { ContextBridge, contextBridge, ipcRenderer } from "electron";
import { Configure } from "../../definitions/types";



let apply_changed_preference_f = (configure : Configure)=>{ipcRenderer.send("apply-changed-preference", configure)}
let save_and_close_f = (configure : Configure)=>{apply_changed_preference_f(configure); ipcRenderer.send("close")}
let get_data_f = ()=>{return ipcRenderer.invoke("get-data")}
contextBridge.exposeInMainWorld("preference_api",{
    save_and_close : save_and_close_f,
    apply_changed_preference : apply_changed_preference_f,
    get_data : get_data_f
})
console.log("load api")

