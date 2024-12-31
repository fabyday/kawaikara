import { BrowserWindow, Display, app, nativeTheme, screen } from 'electron';

import * as path from 'node:path';
import * as fs from 'node:fs';
import { Config } from '@cliqz/adblocker-electron';
import { set_autoupdater, unset_autoupdater } from '../component/autoupdater';

let main_loc_x = -1;
let main_loc_y = -1;

// let is_pip_mode_running = false
// export function apply_pipmode(gobj : GlobalObject, conf : Configure){
// //     gobj.mainWindow?.setAlwaysOnTop

//     const pip_mode = getProperty(conf, "configure.general.pip_mode")!.item! as boolean
//     const width = getProperty(conf, "configure.general.pip_window_size.width")!.item as number
//     const height = getProperty(conf, "configure.general.pip_window_size.height")!.item as number
//     const location = getProperty(conf, "configure.general.pip_location.location")!.item as string
//     const monitor_label = getProperty(conf, "configure.general.pip_location.monitor")!.item as string

//     const all_displays = screen.getAllDisplays()
//     const prev_win_bounds = gobj.mainWindow!.getBounds();
//     console.log(prev_win_bounds)
//     gobj.mainWindow?.setMovable(true)
//     gobj.mainWindow?.setResizable(true)
//     gobj.mainWindow?.setSize(width, height, true);
//     const winBounds = gobj.mainWindow!.getBounds();
//     console.log(winBounds)
//     let min_padding = 2
//     let selected_display : Display|null = null
//     for(let display of all_displays){
//         if(display.label === monitor_label){
//             selected_display = display

//              break;

//             }
//         }

//         let left_pos_x = min_padding
//         let left_pos_y = min_padding
//         if(selected_display){
//             console.log("location", location)
//             switch(location){
//                 case "top-right":{
//                     console.log("sel dis ", selected_display.bounds)
//                     console.log("sel dis ", left_pos_x)
//                     console.log("sel dis ", width)
//                     left_pos_x = selected_display.bounds.x + selected_display.bounds.width - width - min_padding
//                     console.log("sel dis ", left_pos_x)
//                     console.log("sel dis ", left_pos_x+width)
//                     left_pos_y = selected_display.bounds.y + min_padding
//                     break;
//                 }
//                 case "top-left":{
//                     left_pos_x = selected_display.bounds.x + min_padding
//                     left_pos_y = selected_display.bounds.y + min_padding
//                     break;
//                 }
//                 case "bottom-left":{
//                     left_pos_x = selected_display.bounds.x + min_padding
//                     left_pos_y = selected_display.bounds.y  + selected_display.bounds.height - height - min_padding

//                     break;
//                 }
//                 case "bottom-right":{
//                     left_pos_x = selected_display.bounds.x + selected_display.bounds.width - width - min_padding
//                     left_pos_y = selected_display.bounds.y + selected_display.bounds.height - height - min_padding
//                     break;
//                 }
//             }
//         }
//         gobj.mainWindow?.setMovable(!pip_mode)
//         gobj.mainWindow?.setResizable(!pip_mode)
//         gobj.mainWindow?.setAlwaysOnTop(pip_mode, "main-menu")
//         if(pip_mode && !is_pip_mode_running){
//             is_pip_mode_running = true
//             main_loc_x  = prev_win_bounds.x
//             main_loc_y  = prev_win_bounds.y
//             console.log("main_loc x y",main_loc_x, " ", main_loc_y)
//             gobj.mainWindow?.setPosition(left_pos_x, left_pos_y, true)

//         }else if (pip_mode && is_pip_mode_running){
//             gobj.mainWindow?.setPosition(left_pos_x, left_pos_y, true)

//         }
//         else{
//             is_pip_mode_running = false
//             apply_resize_window(gobj, conf)
//             gobj.mainWindow?.setPosition(main_loc_x, main_loc_y, true)
//         }
//         console.log("bb", gobj.mainWindow?.getBounds())

// }
