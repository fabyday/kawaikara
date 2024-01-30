import {BrowserWindow, screen, app} from "electron"
import * as path from 'path'
import * as fs from 'fs'
import { Configure } from "../definitions/types";

let pipWindow : BrowserWindow | null   = null;






export const get_instance = (conf : Configure):BrowserWindow =>{

    if ( pipWindow === null ){
        pipWindow = new BrowserWindow(
            {
                width: conf.general!.pip_window_size!.width,
                height: conf.general!.pip_window_size!.height,
                frame : false
            }
        );
    }


    pipWindow.loadURL("http://youtube.com")
    
conf.general?.pip_location?.location
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



