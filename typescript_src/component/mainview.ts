import {BrowserWindow, app, session, shell} from "electron"


import * as path from 'path'
import * as fs from 'fs'

import { ElectronBlocker } from '@cliqz/adblocker-electron';
import fetch from 'cross-fetch'; // required 'fetch'
// import isDev from 'electron-is-dev';
import { Configure, getProperty } from "../definitions/types";

ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
  blocker.enableBlockingInSession(session.defaultSession);  
});  

let mainView : BrowserWindow | null   = null;
export const get_instance = (conf : Configure):BrowserWindow =>{
  
  if ( mainView === null ){
        mainView = new BrowserWindow(
            {
              width: (getProperty(conf, "configure.general.window_size.width")!).item as number,
              height: (getProperty(conf, "configure.general.window_size.height")!).item as number,
                
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
        
        let html_path =  path.resolve(__dirname, "../../public/main.html")
        // mainView.loadURL(process.env.IS_DEV?"http://localhost:3000/preference.html" : html_path)
        mainView.loadURL(process.env.IS_DEV?html_path : html_path)
        mainView.webContents.on("will-navigate", (e, url)=>{e.preventDefault(); shell.openExternal(url)})
        mainView.webContents.setWindowOpenHandler((details) => {
          // console.log("default opended", details)
          console.log("default opended", details.url)
          // shell.openExternal(details.url); // Open URL in user's browser.
          return { action: "deny" }; // Prevent the app from opening the URL.
        })

        


    }
    return mainView ;
}



