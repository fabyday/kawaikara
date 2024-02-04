import {BrowserWindow, screen, app} from "electron"
import * as path from 'path'
import * as fs from 'fs'
import { Configure } from "../definitions/types";

let pipWindow : BrowserWindow | null   = null;






export const get_instance = (conf : Configure):BrowserWindow =>{

    if ( pipWindow === null ){
        pipWindow = new BrowserWindow(
            {
                width: conf.general!.item!.pip_window_size!.item!.width.item,
                height: conf.general!.item.pip_window_size!.item.height.item,
                frame : false
            }
        );
    }


    pipWindow.loadURL("http://youtube.com")
    
conf.general?.item.pip_location?.item.location.item
const winBounds = pipWindow.getBounds();
const whichScreen = screen.getDisplayNearestPoint({x: winBounds.x, y: winBounds.y});

let cur_loc = winBounds
let new_x = whichScreen.bounds.width - winBounds.width 
let new_y = 0

pipWindow.setPosition(new_x, new_y)  
  // normal, floating, torn-off-menu, modal-panel, main-menu, status, pop-up-menu, screen-saver
  pipWindow.setAlwaysOnTop(true, "main-menu")
  pipWindow.setMovable(false)
  pipWindow.setResizable(false)
  pipWindow.setIgnoreMouseEvents(true)
console.log(pipWindow.getNativeWindowHandle());
    pipWindow.hide();
    return pipWindow ;
}



