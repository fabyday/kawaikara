import {app,desktopCapturer, BrowserWindow,dialog, screen,session, components} from 'electron'
import { ipcMain, ipcRenderer, Menu, MenuItem, BrowserView, webContents} from 'electron'

import * as path from "path";
import * as url from "url";

const logger = require('electron-log')


import { ElectronBlocker } from '@cliqz/adblocker-electron';
import fetch from 'cross-fetch'; // required 'fetch'
import isDev from 'electron-is-dev';

ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
  blocker.enableBlockingInSession(session.defaultSession);
});


const base_url = 'http://localhost:3000'




let mainWindow : BrowserWindow | null = null;
let pipWindow : BrowserWindow | null = null;
let preferenceBrowser :BrowserWindow | null = null;
const initialize = (preference : Object):void=>{

  mainWindow = new BrowserWindow(

    {
      width: 800,
      height: 600,
      // maxWidth : 800,
      // maxHeight : 600,
      
      autoHideMenuBar : true,
      icon: path.join(__dirname, '../resources/icons/kawaikara.ico'),

      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        backgroundThrottling :false
      }

  }
  );
  
  mainWindow.loadURL("http://localhost:3000/app.html")


  preferenceBrowser =  new BrowserWindow(

    {
      x:600,
      y:700,
      width: 800,
      height: 600,
      // maxWidth : 800,
      // maxHeight : 600,
      
      autoHideMenuBar : true,
      icon: path.join(__dirname, '../resources/icons/kawaikara.ico'),

      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        backgroundThrottling :false
      }

  }
  );
  preferenceBrowser.loadURL("http://localhost:3000/worker.html")
}

app.whenReady().then(async () => {
  await components.whenReady();
  console.log('components ready:', components.status());
  initialize({});
  console.log(__dirname)
  logger.info("second app initialized...")
  



});