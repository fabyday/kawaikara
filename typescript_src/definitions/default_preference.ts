import { CItem, Configure } from "./types"
export const config_name = "kawai-config.json"



export const default_configure : Configure= {

    general :{
        id: "general",
        item :{
            pip_mode : { id : "pip_mode", item :false},
            window_size : { id : "window_sise",  
                            item : {
                            preset_list : { id :"preset_list", item : ["1920x1080"] }, 
                            width : { id :"width", item : 1920}, 
                            height : { id :"height", item : 1080 } 
                            }
                        },
            pip_location : { id : "pip_location", item : {
                                                            preset_monitor_list :  { id : "preset_monitor_list", item  : ["1","2"] }, 
                                                            preset_location_list : { id : "preset_location_list", item : ["top-left", "top-right", "bottom-left", "bottom-right", "middle", "left-center", "right-center"]}, 
                                                            location :{id : "location", item : "top-right"},
                                                            monitor :{id : "monitor", item : 0},
                                                        }
            },
            pip_window_size : {id : "pip_window_size", 
                item : {
                    preset_list : {id : "preset_list", item : ["1920x1080"]} , width : {id : "width", item : 600}, height : {id : "height", item : 400}
                    }
            },
            render_full_size_when_pip_running : {id : "render_full_size_when_pip_running", item : false} ,
            enable_autoupdate : {id : "enable_autoupdate", item : true}, 
            dark_mode : {id : "dark_mode", item : false}    
        } 
        
    },


    shortcut:{
        id : "shortcut",
        item :  {
            
            goto_netflix : { id : "goto_netflix" , item :"Ctrl+N"},
            goto_laftel : {id : "goto_laftel", item : "Ctrl+L"},
            goto_youtube : {id : "Ctrl+Y", item : "Ctrl+Y"},
            goto_disney : {id : "goto_disney", item : "Ctrl+D"},
            goto_amazonprime : {id : "goto_amazonprime", item : "Contrl+M"},
            goto_applemusic : {id : "goto_applemusic", item :  "Contrl+A"},
            goto_main : {id : "goto_main", item : "Ctrl+M"},
            run_pip : {id : "run_pip", item : "Ctrl+P"}
        }
    }
}


