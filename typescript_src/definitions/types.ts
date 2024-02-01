import { app, BrowserWindow } from "electron"

export type GlobalObject = {
    mainWindow? : BrowserWindow 
    pipWindow? : BrowserWindow 
    preferenceWindow? : BrowserWindow
    config? : Configure
    menu? : Object
}

export type CItem<T> = {
    id : string;
    name? : string;
    item : T;
}


export type CWindowSize = {
    preset_list? : CItem<string[]>,
    width : CItem<number> ,
    height : CItem<number>
}

export type CPiPLocation = {
    preset_location_list? : CItem<string[]>,
    preset_monitor_list? : CItem<string[]>,
    location : CItem<string> ,
    monitor : CItem<number> 
}
export type CGeneral = {
    default_site? : CItem<string>,
    pip_mode? : CItem<boolean>, 
    window_size? : CItem<CWindowSize>,
    pip_window_size? : CItem<CWindowSize>,
    pip_location? : CItem<CPiPLocation>,
    render_full_size_when_pip_running? : CItem<boolean> ,
    enable_autoupdate? : CItem<boolean>, 
    dark_mode? : CItem<boolean>
}



export type CShortcut = {
    goto_netflix? : CItem<string>,
    goto_laftel? : CItem<string>,
    goto_youtube? : CItem<string>,
    goto_disney? : CItem<string>,
    goto_amazonprime? : CItem<string>,
    goto_applemusic? : CItem<string>,
    goto_main? : CItem<string>,
    run_pip? : CItem<string>
}



export type Configure = {
    general? : CItem<CGeneral>,
    shortcut?: CItem<CShortcut>
}


