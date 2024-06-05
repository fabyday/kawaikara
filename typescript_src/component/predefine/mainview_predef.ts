import { ContextBridge, app, contextBridge, ipcRenderer } from "electron";
const f = ()=>{ return ipcRenderer.invoke("app-version")}
contextBridge.exposeInMainWorld("main_api",{
    get_version : f,
    open_new_window : (url:string)=>{

    } 
})


console.log("load main preloads...")
console.log(f())
