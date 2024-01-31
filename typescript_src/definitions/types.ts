import { app, BrowserWindow } from "electron"

export type GlobalObject = {
    mainWindow? : BrowserWindow 
    pipWindow? : BrowserWindow 
    preferenceWindow? : BrowserWindow
    config? : Configure
    menu? : Object
}



export type CWindowSize = {
    preset_list? : string[],
    width : number ,
    height : number 
}

export type CPiPLocation = {
    preset_location_list? : string[],
    preset_monitor_list? : string[],
    location : string ,
    monitor : number 
}
export type CGeneral = {
    default_site? : string,
    pip_mode? : boolean, 
    window_size? : CWindowSize,
    pip_window_size? : CWindowSize,
    pip_location? : CPiPLocation,
    render_full_size_when_pip_running? : boolean ,
    enable_autoupdate? : boolean, 
    dark_mode? : boolean
}

export type CShortcut = {
    goto_netflix? : string,
    goto_laftel? : string,
    goto_youtube? : string,
    goto_disney? : string,
    goto_amazonprime? : string,
    goto_applemusic? : string,
    goto_main? : string,
    run_pip? : string
}



export type Configure = {
    general? : CGeneral,
    shortcut?: CShortcut
}


