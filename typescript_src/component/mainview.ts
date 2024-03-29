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

ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
  blocker.enableBlockingInSession(session.defaultSession);  
});  

let mainView : BrowserWindow | null   = null;
export const get_instance = (conf : Configure):BrowserWindow =>{
  
  let target_width = (getProperty(conf, "configure.general.window_size.width")!).item as number
  let target_height = (getProperty(conf, "configure.general.window_size.height")!).item as number

  if ( mainView === null ){
        mainView = new BrowserWindow(
            {
              width: target_width,
              height: target_height,
                
                autoHideMenuBar : true,
                icon: path.join(__dirname, '../../resources/icons/kawaikara.ico'),
          
                webPreferences: {
                  preload: path.join(__dirname, 'predefine/mainview_predef.js'),
                  backgroundThrottling : !(getProperty(conf, "configure.general.render_full_size_when_pip_running")!.item as boolean)
                }
          
            }
        );
        mainView.on("closed", ()=>{
          if (process.platform !== 'darwin')
              app.quit()
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
        mainView.loadURL(process.env.IS_DEV? "http://localhost:3000/preference.html" : html_path)
        // mainView.webContents.on("will-navigate", (e, url)=>{ 
          
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



