import { Configure } from "./types"
export const config_name = "kawai-config.json"

export const default_configure : Configure= {



    general : {
        pip_mode : false,
        window_size : {width : 1920, height : 1080},
        pip_location : {location : "top-left", monitor : 0},
        pip_window_size : {width : 600, height : 400},
        render_full_size_when_pip_running : false ,
        enable_autoupdate : true, 
        dark_mode : true
    },
    shortcut:{
        goto_netflix : "Ctrl+N",
        goto_laftel : "Ctrl+L",
        goto_youtube : "Ctrl+Y",
        goto_disney : "Ctrl+D",
        goto_amazonprime : "Contrl+M",
        goto_applemusic : "Contrl+A",
        goto_main : "Ctrl+M",
        run_pip : "Ctrl+P"
    }





}


