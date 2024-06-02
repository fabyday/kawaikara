import {BrowserWindow, app, screen, session, shell} from "electron"


import * as path from 'path'
import * as fs from 'fs'

import { ElectronBlocker } from '@cliqz/adblocker-electron';
import fetch from 'cross-fetch'; // required 'fetch'
// import isDev from 'electron-is-dev';
import { Configure, getProperty } from "../definitions/types";
import { Link_data } from "../definitions/data";
import { script_root_path } from "./constants";
import { setup_pogress_bar } from "./autoupdater";
import { ElectronChromeExtensions } from "electron-chrome-extensions";

ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
  blocker.enableBlockingInSession(session.defaultSession);  
});  
// const { ElectronChromeExtensions } = require('electron-chrome-extensions')
// ElectronChromeExtensions



// about chrome extension installation 
// https://stackoverflow.com/questions/75691451/can-i-download-chrome-extension-directly-from-an-electron-webview

let mainView : BrowserWindow | null   = null;
export const get_instance = (conf : Configure):BrowserWindow =>{
  
  let target_width = (getProperty(conf, "configure.general.window_size.width")!).item as number
  let target_height = (getProperty(conf, "configure.general.window_size.height")!).item as number
  if ( mainView === null ){
    let resolved_ses_preload_path = path.join(__dirname,"predefine/session_preloads.js")
    console.log("resolved_ses_preload_path", resolved_ses_preload_path)
    let sess = session.fromPartition("persist:main")
    sess.setPreloads([resolved_ses_preload_path])
    let ext_paths = path.resolve("extensions/eimadpbcbfnmbkopoojfekhnkhdbieeh/4.9.85_0/")
    sess.loadExtension(ext_paths, { allowFileAccess : true})
    
    console.log("ext path : ", ext_paths)

    mainView = new BrowserWindow(
            {
              
              width: target_width,
              height: target_height,
                
                autoHideMenuBar : true,
                icon: path.join(__dirname, '../../resources/icons/kawaikara.ico'),
          
                webPreferences: {
                  session : sess,
                  contextIsolation:false,
                  nodeIntegration : true,
                  sandbox : false,
                  preload: path.join(__dirname, 'predefine/mainview_predef.js'),
                  backgroundThrottling : !(getProperty(conf, "configure.general.render_full_size_when_pip_running")!.item as boolean)
                }
          
            }
        );
        mainView.on("closed", ()=>{
          if (process.platform !== 'darwin')
              app.quit()
        })
        //see also https://www.electronjs.org/docs/latest/tutorial/devtools-extension
        

        const google_chrome_extension_root_path = path.join(process.env.LOCALAPPDATA as string, "Google\\Chrome\\User Data\\Default\\Extensions\\gighmmpiobklfepjocnamgkkbiglidom\\6.2.0_1")
        console.log("path si :", google_chrome_extension_root_path)

        // const read_extension_manifeset = async (file_name : string)=>{
        //   let mainfest = await new Promise((resolve, reject) => {
        //     fs.readFile(`${file_name}/manifest.json`, 'utf8', async function (err, data) {
        //         if (err) reject(err);
        //         resolve(data)
        //       });
        //   })
        // }

        
        
        // read_extension_manifeset(ext_paths).then((meta)=>{
        //   meta
        // })

        
        // mainView.webContents.session.on("extension-loaded", async (event, ext)=>{
        //     console.log("extension is loaded2")

        // })
        // mainView.webContents.session.on("extension-ready", async (event, ext)=>{
        //   console.log("extension is ready.")
        //   let test_browser =  new BrowserWindow({
        //     title: 'MetaMask',
        //     width: 360,
        //     height: 520,
        //     type: 'popup',
        //     icon : ext.manifest.browser_action.default_icon,
        //     resizable: true
        //   });
        //   await test_browser!.loadURL(`${ext.manifest.background.page}`);
        //   // mainView!.webContents.session.setPreloads(`${ext.url}/`)
        //   mainView?.webContents.session.getExtension(ext.id)
        // })

        // mainView.webContents.session.loadExtension(ext_paths, {"allowFileAccess" : true}).then(async (ext)=>{
        //   console.log("extension is loaded callback", ext)
        // }).catch((e)=>{
        //   console.log("rejected")
        //   console.log(e)
        //   console.log("why rejected...")
        // })

        
        //   console.log("test")
        // }).catch(()=>{console.log("failed")})
        
        
        mainView.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
          details.requestHeaders['Sec-Ch-Ua'] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"'
          details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          callback({ requestHeaders: details.requestHeaders })
        })
        
        // regex for extracting site names.
        const re = /https:\/\/(.*\.)*(.*)\..*(com|net|tv).*/
        let table:string[] = []
          Link_data.map((v)=>{
            if(typeof v.item === "undefined"){

            }
            else if(Array.isArray(v.item)){
              for(let vv of v.item){
                if(typeof vv.link === "string"){
                  
                  let arr = re.exec(vv.link)
                  console.log(arr)
                  if(arr !== null){
                    table.push(arr[1])
                  }
                }
              }
            }
          })
        console.log(table)
        
        mainView.setFullScreenable(false)
        setup_pogress_bar(mainView)
        let html_path =  path.resolve(script_root_path, "./pages/main.html")
        // mainView.loadURL(process.env.IS_DEV?"http://localhost:3000/preference.html" : html_path)
        console.log("is dev?", process.env.IS_DEV)
        console.log("is dev?", process.cwd())
        // mainView.loadURL(process.env.IS_DEV? "http://localhost:3000/main.html" : html_path)
        // mainView.webContents.on("will-navigate", (e, url)=>{ 
          const extensions = new ElectronChromeExtensions({session : sess} )
          extensions.addTab(mainView.webContents, mainView)
          
          mainView.loadURL(process.env.IS_DEV? "http://localhost:3000/main.html" : html_path, {userAgent :'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'})
          // mainView.loadURL(process.env.IS_DEV? "http://localhost:3000/main.html" : html_path)
          // console.log(extensions.getContextMenuItems(mainView.webContents))

        //   console.log(table)
        //   e.preventDefault(); 
        //   let arr = re.exec(url)
        //   console.log(arr)
        //   if(arr !== null){
        //     if(table.includes(arr[1]))
        //       return;
        //   }

        //   shell.openExternal(url)
        // })
       
        // mainView.webContents.setWindowOpenHandler((details) => {
        //   // console.log("default opended", details)
        //   console.log("default opended", details.url)
        //   // shell.openExternal(details.url); // Open URL in user's browser.
        //   return { action: "deny" }; // Prevent the app from opening the URL.
        // })

        


    }
    return mainView ;
}



