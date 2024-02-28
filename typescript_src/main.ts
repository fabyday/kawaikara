import {app,desktopCapturer, BrowserWindow,dialog, screen,session, components, nativeTheme} from 'electron'
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


const logger = require('electron-log')


let global_object : GlobalObject | null;



function read_configure(){
  let jsonData : Configure;
  console.log(app.getPath("appData"))

  let root_path = process.env.IS_DEV ? "" : app.getPath("appData")
  try {
    let rawData = fs.readFileSync(path.join(root_path, config_name), 'utf8');
    jsonData = JSON.parse(rawData);

  } catch (err) {
    console.log(err)
    let user_json = JSON.stringify(default_configure)
    fs.writeFileSync(path.join(app.getPath("appData"), config_name), user_json)
    jsonData = default_configure
  }
  console.log(jsonData)
  return jsonData
}


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
    let pip_preset = ["400x300", "600x400"].concat(lodash.cloneDeep(string_list))
    pip_preset_item!.item = pip_preset
}

function init_locales(conf : Configure){
  let locale_preset = getProperty(conf, "configure.general.locales.locale_preset")
  let locale = getProperty(conf, "configure.general.locales.locale")

  let locale_names : string[]
  let locale_dir_path = process.env.IS_DEV?path.join(__dirname +"/../locales"):""
  locale_names = fs.readdirSync(locale_dir_path)
  locale_names.push("system locale")
  locale_names.forEach((f)=>{console.log(f)})
  locale_preset!.item = locale_names
  
  // locale_preset.item

}

const initialize = ():void=>{
  let config = read_configure();
  init_default_prefernece(config)
  init_locales(config)
  console.log(getProperty(config, "configure.general.selected_locale"))
  apply_locale(config, getProperty(config, "configure.general.locales.selected_locale.locale_identifier")!.item as string)
  global_object = {
    mainWindow : get_mainview(config), 
    pipWindow : get_pip_window(config) , 
    preferenceWindow : get_preference_window(config),
    config : config,
    menu : undefined
  }
  apply_all(global_object, config)
  global_object.mainWindow!.loadURL(process.env.IS_DEV?"http://localhost:3000/main.html" : "");

  global_object.mainWindow?.webContents.on("did-finish-load", (evt : Event)=>{
    global_object!.mainWindow!.webContents.openDevTools();
})

  // global_object.mainWindow!.hide()
  ipcMain.handle("get-data", ()=>config)
  ipcMain.handle("close", ()=>{ 
      global_object?.preferenceWindow?.close()
  })
  ipcMain.handle('apply-changed-preference', (event, new_conf : Configure)=>{
      global_object!.config = lodash.cloneDeep(new_conf)
      apply_all(global_object!, global_object!.config)
      return new_conf
  })
  ipcMain.handle('app-version', ()=>{
    return app.getVersion()
})
}

app.whenReady().then(async () => {
  await components.whenReady();
  logger.info('components ready:', components.status());
  initialize();
  console.log(__dirname)
  logger.info("app initialized...")

});