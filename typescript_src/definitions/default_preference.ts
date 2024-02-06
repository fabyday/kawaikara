import { CItem, Configure } from "./types"
export const config_name = "kawai-config.json"



export const default_configure : Configure = {
    id : "default-configure",
    name : "default-configure",
    locale : "None",
    item : [
        {
            id : "general", 
            name : "",
            item : [
                {
                    id : "default_main",
                    name : "",
                    item : ""
                },
                {
                    id : "pip_mode",
                    name : "",
                    item : true
                },
                {
                    id : "window_size",
                    name : "",
                    item : [
                        {
                            id : "preset_list",
                            name : "",
                            item : []
                        },
                        {
                            id: "width",
                            name : "",
                            item : 800
                        },
                        {
                            id: "height",
                            name : "",
                            item : 640
                        }
                    ]
                },
                {
                    id : "pip_location",
                    name : "",
                    item : [
                        { 
                            id : "preset_monitor_list", 
                            name : "",
                            item  : [] 
                        },
                        { 
                            id : "preset_location_list", 
                            name : " ",
                            item  : [] 
                        },
                        { 
                            id : "location", 
                            name : " ",
                            item  : "top-right" 
                        },
                        { 
                            id : "monitor", 
                            name : " ",
                            item  : 0 
                        },
                    ]
                },
                {
                    id : "pip_window_size",
                    name : "",
                    item : [
                        {
                            id : "preset_list", 
                            name : "",
                            item : ["1920x1080"]
                        }, 
                        {
                            id : "width", 
                            name :  "",
                            item : 600
                        }, 
                        {
                            id : "height", 
                            name:"", 
                            item : 400
                        }
                    ]
                },
                {
                    id : "render_full_size_when_pip_running",
                    name : "",
                    item : false
                },
                {
                    id : "enable_autoupdate",
                    name : "",
                    item : true
                },
                {
                    id : "dark_mode",
                    name : "",
                    item : false
                },
            ],

        },
        {
            id : "shortcut",
            name : "",
            item : [
                {
                    id : "goto_netflix",
                    name : "", 
                    item : "Ctrl+N"
                },
                {
                    id : "goto_laftel",
                    name : "", 
                    item : ""
                },
                {
                    id : "goto_youtubue",
                    name : "", 
                    item : ""
                },
                {
                    id : "goto_disney",
                    name : "", 
                    item : ""
                },
                {
                    id : "goto_amazonprime",
                    name : "", 
                    item : ""
                },
                {
                    id : "goto_applemusic",
                    name : "", 
                    item : ""
                },
                {
                    id : "goto_chzzk",
                    name : "", 
                    item : ""
                },
                {
                    id : "goto_wavve",
                    name : "", 
                    item : ""
                },
                {
                    id : "goto_watcha",
                    name : "", 
                    item : ""
                },
                {
                    id : "coupangplay",
                    name : "", 
                    item : ""
                },
                {
                    id : "goto_tving",
                    name : "", 
                    item : ""
                },
                {
                    id : "goto_twitch",
                    name : "", 
                    item : ""
                },
                {
                    id : "goto_main",
                    name : "", 
                    item : ""
                },
                {
                    id : "run_pip",
                    name : "", 
                    item : ""
                }
            ]
        }


    ]
    
}


