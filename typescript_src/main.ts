import {app,desktopCapturer, BrowserWindow,dialog, screen,session, components} from 'electron'
import { ipcMain, ipcRenderer, Menu, MenuItem, BrowserView, webContents} from 'electron'

import * as path from "path";
import * as url from "url";
import * as fs from "fs"
import { get_instance as get_mainview } from './component/mainview';
import { get_instance as get_preference_window } from './component/preference';
import { get_instance as get_pip_window } from './component/pip_window';
import {default_configure, config_name} from "./definitions/default_preference"
import * as autoUpdater from "./component/autoupdater"
import { Configure, GlobalObject } from './definitions/types';


const logger = require('electron-log')



const base_url = 'http://localhost:3000'



let global_object : GlobalObject | null;

function read_configure(){
  let jsonData : Configure;
  try {
    let rawData = fs.readFileSync(path.join(app.getPath("appData"), config_name), 'utf8');
    jsonData = JSON.parse(rawData);

  } catch (err) {
    console.log(err)
    let user_json = JSON.stringify(default_configure)
    fs.writeFileSync(path.join(app.getPath("appData"), config_name), user_json)
    jsonData = default_configure
  }
  return jsonData
}


const initialize = ():void=>{
  let config = read_configure();
  
  global_object = {
    mainWindow : get_mainview(config), 
    pipWindow : get_pip_window(config) , 
    preferenceWindow : get_preference_window(config),
    config : config,
    menu : undefined
  }
  global_object.mainWindow!.loadURL("https://www.youtube.com/");
}

app.whenReady().then(async () => {
  await components.whenReady();
  console.log('components ready:', components.status());
  initialize();
  console.log(__dirname)
  logger.info("app initialized...")
});