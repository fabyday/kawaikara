import {BrowserWindow, app, session} from "electron"


import * as path from 'path'
import * as fs from 'fs'

import { ElectronBlocker } from '@cliqz/adblocker-electron';
import fetch from 'cross-fetch'; // required 'fetch'
// import isDev from 'electron-is-dev';
import { Configure } from "../definitions/types";


ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
  blocker.enableBlockingInSession(session.defaultSession);  
});  


let mainView : BrowserWindow | null   = null;
export const get_instance = (conf : Configure):BrowserWindow =>{
    
    if ( mainView === null ){

        mainView = new BrowserWindow(
            {
                width: conf.general!.item.window_size!.item.width.item,
                height: conf.general!.item.window_size!.item.height.item,
                
                autoHideMenuBar : true,
                icon: path.join(__dirname, '../../resources/icons/kawaikara.ico'),
          
                webPreferences: {
                  preload: path.join(__dirname, 'predefine/mainview_predef.ts'),
                  backgroundThrottling : !conf.general!.item.render_full_size_when_pip_running?.item
                }
          
            }
        );




    }
    return mainView ;
}



