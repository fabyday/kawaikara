import {app,desktopCapturer, BrowserWindow,dialog, screen,session, components, nativeTheme, Session, globalShortcut} from 'electron'
import { ipcMain, ipcRenderer, Menu, MenuItem, BrowserView, webContents} from 'electron'

import * as path from "path";
import * as url from "url";
import * as fs from "fs"

import { get_instance as get_mainview } from './component/mainview';
import { get_instance as get_preference_window } from './component/preference';
import { get_instance as get_pip_window } from './component/pip_window';
import {default_configure, config_name} from "./definitions/default_preference"
import * as autoUpdater from "./component/autoupdater"
import { Configure, GlobalObject, getProperty } from './definitions/types';
import { apply_all, apply_locale } from './logics/preference_logic';
import lodash from 'lodash';
import { attach_menu } from './component/menu';
import { setup_menu_funtionality } from './definitions/data';
import { script_root_path } from './component/constants';
import * as fs_p from 'node:fs/promises';
// import {DiscordSDK} from "@discord/embedded-app-sdk";

import log from 'electron-log/main';
import { global_object } from './definitions/context';


log.initialize();

// let global_object : GlobalObject | null = null;

let root_path = process.env.IS_DEV ?   path.join(__dirname, "../tmp")  : app.getPath("appData")

function read_configure(){
  
  let jsonData : Configure;
  // console.log(app.getPath("appData"))
  
  log.info("read_configure"+app.getPath("appData"))
  try {
    
    let rawData = fs.readFileSync(path.join(root_path, config_name), 'utf8');
    jsonData = JSON.parse(rawData);

  } catch (err) {
    log.debug(err)
    if(!fs.existsSync(root_path))
      fs.mkdirSync(root_path)
    let user_json = JSON.stringify(default_configure, null, "\t")
    fs.writeFileSync(path.join(root_path, config_name), user_json)
    jsonData = default_configure
  }
  console.log(jsonData)
  return jsonData
}



app.disableHardwareAcceleration();

var menu : any = undefined;

function init_default_prefernece(conf :Configure){
    let preset_size = [
      [720, 576], // 480p
      [720, 480], // 576p
      [800, 600],
      [1280, 720], // 720p 
      [1920, 1080], //1080p
      [3840, 2160], //4k
      [7680,4320], // 8k
                    ]
    
    let all_displays = screen.getAllDisplays()
    console.log(all_displays)
    let max_disp_index = -1;
    let max_volume = 0
    for(let i =0; i < all_displays.length; i++ ){
        let disp = all_displays[i]
        let h = disp.size.height
        let w = disp.size.width
        let disp_volume = h*w
        console.log(max_volume, disp_volume, w, h)
        if(max_volume < disp_volume){
          max_volume = disp_volume
          max_disp_index = i
        }
    }
    let w = all_displays[max_disp_index].size.width
    let h = all_displays[max_disp_index].size.height
    console.log(w, h)
    let sel_preset = preset_size.filter((v, i)=>{
      if(w > v[0] || h > v[1]){
        return v
      }
    })

    if(w > sel_preset[sel_preset.length-1][0] && h > sel_preset[sel_preset.length-1][1]){
      sel_preset.push([w, h])
    }
    console.log(sel_preset)
    let string_list = sel_preset.map((v)=>
      String(v[0])+"x"+String([v[1]])
    )
    let monitor_preset_item = getProperty(conf, "configure.general.pip_location.preset_monitor_list")
    monitor_preset_item!.item = all_displays.map(v=>v.label)
    
    let monitor = getProperty(conf, "configure.general.pip_location.monitor")
    if(monitor!.item === ""){
      monitor!.item = screen.getPrimaryDisplay().label
    }
    
    

    

    let win_preset_item = getProperty(conf, "configure.general.window_size.preset_list")
    win_preset_item!.item = string_list
    let pip_preset_item = getProperty(conf, "configure.general.pip_window_size.preset_list")
    let pip_preset = ["400x300", "600x400"].concat(lodash.cloneDeep(string_list.slice(0, string_list.length - 2 > 0 ?string_list.length - 2 : undefined)))
    pip_preset_item!.item = pip_preset
}

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
  let config = read_configure();
  init_default_prefernece(config)
  init_locales(config)
  log.debug(getProperty(config, "configure.general.selected_locale"))
  // apply_locale(config, getProperty(config, "configure.general.locales.selected_locale.locale_identifier")!.item as string)
  
  global_object = {
    mainWindow : get_mainview(config), 
    pipWindow : get_pip_window(config) , 
    // preferenceWindow : get_preference_window(config),
    preferenceWindow : undefined,
    config : config,
    menu : undefined
  }

  apply_all(global_object, config)

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


ipcMain.handle('readme_str', async ()=>{

  const readme_strings = fs.readFileSync(path.join(__dirname, "../readme.md"), {encoding:"utf-8"});
  log.info(readme_strings)
  return readme_strings

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
