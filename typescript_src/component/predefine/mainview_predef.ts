import { ContextBridge, app, contextBridge, ipcRenderer } from "electron";
const f = ()=>{ return ipcRenderer.invoke("app-version")}
const readme_f = async ()=>{ return await ipcRenderer.invoke("readme_str")}
contextBridge.exposeInMainWorld("main_api",{
    get_version : f,
    open_new_window : (url:string)=>{

    } ,
    open_menubar : ()=>{},
    get_readme : readme_f
})


console.log("load main preloads...")
console.log(f())
// document.getElementsByTagName('head')[0].appendChild('<meta name="Permissions-Policy" content="app-id=xxxxx">');
