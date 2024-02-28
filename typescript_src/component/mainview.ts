import {BrowserWindow, app, session} from "electron"


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

        
        mainView.loadURL(process.env.IS_DEV?"http://localhost:3000/preference.html" : "./public/")

        

        


    }
    return mainView ;
}



