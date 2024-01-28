import {app,desktopCapturer, BrowserWindow,dialog, screen,session, components} from 'electron'
import { ipcMain, ipcRenderer, Menu, MenuItem, BrowserView, webContents} from 'electron'

import * as path from "path";
import * as url from "url";



import { ElectronBlocker } from '@cliqz/adblocker-electron';
import fetch from 'cross-fetch'; // required 'fetch'

ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
  blocker.enableBlockingInSession(session.defaultSession);
});


const base_url = 'http://localhost:3000'




let mainWindow : BrowserWindow | null = null;
let pipWindow : BrowserWindow | null = null;

const initialize = (preference : Object):void=>{


}