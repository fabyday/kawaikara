import { CItem, Configure } from "./types"
export const config_name = "kawai-config.json"



export const default_configure : Configure = {
    id : "configure",
    name : "default-configure",
    locale : "None",
    item : [
        {
            id : "general", 
            name : "General",
            item : [
                {
                    id : "default_main",
                    name : "Main Page",
                    item : ""
                },
                {
                    id : "pip_mode",
                    name : "PiP Mode(Picture in Picture)",
                    item : true
                },
                {
                    id : "window_size",
                    name : "Main Window Size",
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
                            item : 600
                        }
                    ]
                },
                {
                    id : "pip_location",
                    name : "PiP location",
                    item : [
                        { 
                            id : "preset_monitor_list", 
                            name : "Available monitors",
                            item  : [] 
                        },
                        { 
                            id : "preset_location_list", 
                            name : "Preset Locations",
                            item  : [] 
                        },
                        { 
                            id : "location", 
                            name : "Select PiP Location",
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
                    name : "PiP Window Size",
                    item : [
                        {
                            id : "preset_list", 
                            name : "Preset List",
                            item : ["1920x1080"]
                        }, 
                        {
                            id : "width", 
                            name :  "Width",
                            item : 600
                        }, 
                        {
                            id : "height", 
                            name:"Height", 
                            item : 400
                        }
                    ]
                },
                {
                    id : "render_full_size_when_pip_running",
                    name : "Background rendering Mode when PiP is Running",
                    item : false
                },
                {
                    id : "enable_autoupdate",
                    name : "Enable Autoupdate",
                    item : true
                },
                {
                    id : "dark_mode",
                    name : "Enable DarkMode",
                    item : false
                },
            ],

        },
        {
            id : "shortcut",
            name : "Shortcut",
            item : [
                {
                    id : "goto_netflix",
                    name : "Open Netflix", 
                    item : "Ctrl+N"
                },
                {
                    id : "goto_laftel",
                    name : "Open Laftel", 
                    item : ""
                },
                {
                    id : "goto_youtubue",
                    name : "Open Youtube", 
                    item : ""
                },
                {
                    id : "goto_disney",
                    name : "Open DisneyPlus", 
                    item : ""
                },
                {
                    id : "goto_amazonprime",
                    name : "Open AmazonPrime", 
                    item : ""
                },
                {
                    id : "goto_applemusic",
                    name : "Open AppleMusic", 
                    item : ""
                },
                {
                    id : "goto_chzzk",
                    name : "Open Chzzk", 
                    item : ""
                },
                {
                    id : "goto_wavve",
                    name : "Open Wavve", 
                    item : ""
                },
                {
                    id : "goto_watcha",
                    name : "Open Watcha", 
                    item : ""
                },
                {
                    id : "coupangplay",
                    name : "Open CoupangPlay", 
                    item : ""
                },
                {
                    id : "goto_tving",
                    name : "Open Tving", 
                    item : ""
                },
                {
                    id : "goto_twitch",
                    name : "Open Twitch", 
                    item : ""
                },
                {
                    id : "goto_main",
                    name : "Open Main", 
                    item : ""
                },
                {
                    id : "run_pip",
                    name : "Run PiP Mode", 
                    item : ""
                }
            ]
        }


    ]
    
}


