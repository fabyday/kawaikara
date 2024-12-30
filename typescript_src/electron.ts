import {app,desktopCapturer, BrowserWindow,dialog, screen,session, components, nativeTheme, Session, globalShortcut} from 'electron'
import { ipcMain, ipcRenderer, Menu, MenuItem, BrowserView, webContents} from 'electron'

import * as path from "path";
import * as url from "url";
import * as fs from "fs"

import { get_instance as get_mainview } from './component/mainview';
import { get_instance as get_preference_window } from './component/preference';

import * as autoUpdater from "./component/autoupdater"
import lodash from 'lodash';
import { script_root_path } from './component/constants';
import * as fs_p from 'node:fs/promises';
// import {DiscordSDK} from "@discord/embedded-app-sdk";

import log from 'electron-log/main';


log.initialize();

// let global_object : GlobalObject | null = null;




app.disableHardwareAcceleration();




function init_locales(conf : Configure){
  let locale_preset = getProperty(conf, "configure.general.locales.locale_preset")
  let locale = getProperty(conf, "configure.general.locales.locale")

  let locale_names : string[]
  let locale_dir_path = process.env.IS_DEV?path.join(__dirname ,"../locales"):path.join(__dirname ,"../locales")
  console.log("locale_dir_path", locale_dir_path)
  locale_names = fs.readdirSync(locale_dir_path)
  locale_names.push("system locale")
  locale_names.forEach((f)=>{console.log(f)})
  locale_preset!.item = locale_names
  

}

const initialize = ():void=>{
 
  global_object.mainWindow?.webContents.on("did-finish-load", (evt : Event)=>{
    if(process.env.IS_DEV)
      global_object!.mainWindow!.webContents.openDevTools();
})

  // global_object.mainWindow!.hide()
  ipcMain.handle("get-data", ()=>global_object!.config)
  ipcMain.handle("close", ()=>{ 
      global_object?.preferenceWindow?.close()
  })
  ipcMain.handle('apply-changed-preference', (event, new_conf : Configure)=>{
      // console.log("new_conf", new_conf)
      let user_json = JSON.stringify(new_conf, null, "\t")
      getProperty(new_conf, "configure.general.pip_mode")!.item = getProperty(global_object!.config!, "configure.general.pip_mode")!.item
      log.debug("saved", user_json)
      
      global_object!.config = lodash.cloneDeep(new_conf)
      let save_conf = lodash.cloneDeep(new_conf)
      getProperty(save_conf, "configure.general.pip_mode")!.item = false
      log.debug(JSON.stringify(getProperty(global_object!.config!, "configure.general.pip_mode")!.item, null, "\t"))
      fs.writeFileSync(path.join(root_path, config_name), JSON.stringify(save_conf, null, "\t"))

      apply_all(global_object!, global_object!.config)
      
      return new_conf
  })
  ipcMain.handle('app-version', ()=>{
    return app.getVersion()
})


  setup_menu_funtionality(global_object, config )
  menu = attach_menu(global_object, config)
}

app.whenReady().then(async () => {
  
  await components.whenReady();
  
  log.info('components ready:', components.status());
  initialize();
  console.log(__dirname)
  log.info("app initialized...")
  

  global_object?.mainWindow?.webContents.on('before-input-event', (event, input) => {
    if (input.key.toLowerCase() === 'tab') {
      console.log('Tab')
      event.preventDefault()
      const v = new BrowserView({webPreferences : {
        contextIsolation: true, // add this

  preload :                  path.join(__dirname, 'component/predefine/menu_predef.js'),
  
      }
      })
  global_object?.mainWindow?.setBrowserView(v)
  const bounds = global_object?.mainWindow?.getBounds();
  console.log(bounds)
  const width = bounds!.width*0.8
  const height = bounds!.height*0.8
  const gap_w = bounds!.width*0.1
  const gap_h = bounds!.height*0.1
  v.setBounds({x :gap_w, y : gap_h, width :width , height : height});
  console.log(v.getBounds())
  let html_path =  path.resolve(script_root_path, "./pages/sidebar.html")
  console.log(html_path)
  v.webContents.loadURL(html_path)
  v.setBackgroundColor("white")
  v.webContents.insertCSS('html,body{ overflow: hidden !important; }')
  console.log(global_object)
  console.log(global_object?.mainWindow)
  v.webContents.openDevTools({mode : "detach"});
  ipcMain.handle("initialize_data", (event , args)=>{
    return "menu";

  })
  // ipcMain.on("initialize_data", (event : Electron.IpcMainEvent, args)=>{
  //     return menu;
  // })
    }})
  
    

});
