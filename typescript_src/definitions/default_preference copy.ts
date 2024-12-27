import { KawaiConfig, KawaiConfigure, KawaiLocale, KawaiLocaleConfigure } from "./setting_types"
export const config_name = "kawai-config.json"

export const default_config : KawaiConfig = {
    preference : {
        general : {
            dark_mode :{value : true},
            default_main : { url : {value : ""} },
            enable_autoupdate : { value : true },
            render_full_size_when_pip_running : { value : true } ,
            window_preference : {
                pip_location : {}, 
                pip_window_size : {
                    x : {value : 300}, 
                    y : {value : 400},
                    height : {value : 300}, 
                    width : {value : 400}
                }
            },

        },
        locale : {
            selected_locale : {value : ""}
        },
        shortcut : {
            goto_netflix : {shortcut_key : ""},
            goto_laftel : {shortcut_key : ""},
            goto_youtube : {shortcut_key : ""},
            goto_disney : {shortcut_key : ""},
            goto_wavve : {shortcut_key : ""},
            goto_tving : {shortcut_key : ""},
            goto_twitch : {shortcut_key : ""},
            run_pip : {shortcut_key : ""},
            goto_applemusic : {shortcut_key : ""},
            goto_chzzk : {shortcut_key : ""},
            goto_amazonprime : {shortcut_key : ""},

        }
    },
    version : {}

}

export const default_locale: KawaiLocale = {
    preference : {
        general : {
            dark_mode :{name : ""},
            default_main : { name : "", url : {name : ""} },
            enable_autoupdate : { name : "" },
            render_full_size_when_pip_running : { name : "" } ,
            window_preference : {
                pip_location : { monitor : {name : ""}}, 
                pip_window_size : {
                    name : "",
                    x : {name : ""}, 
                    y : {name : ""},
                    height : {name : ""}, 
                    width : {name : ""}
                }
            },

        },
        locale : {
            selected_locale : {name : ""}
        },
        shortcut : {
            name : "",
            goto_netflix : {name : ""},
            goto_laftel : {name : ""},
            goto_youtube : {name : ""},
            goto_disney : {name : ""},
            goto_wavve : {name : ""},
            goto_tving : {name : ""},
            goto_twitch : {name : ""},
            run_pip : {name : ""},
            goto_applemusic : {name : ""},
            goto_chzzk : {name : ""},
            goto_amazonprime : {name : ""},
        }
    },
    version : {}
}



export const default_configure : Configure = {
    id : "configure",
    name : "default-configure",
    item : [
        {
            id : "general", 
            name : "General",
            item : [
                {
                    id : "locales",
                    name : "Locales",
                    item : [
                        {
                            id : "selected_locale",
                            name : "selected locale",
                            item : [
                                {
                                    id : "locale_native_name",
                                    name : "locale native name",
                                    item : "system locale"
                                }
                            ]
                        },
                        {
                            id : "locale_preset",
                            name : "locale preset",
                            item : ["system locale"]
                        }
                    ]
                },

                {
                    id : "default_main",
                    name : "Main Page",
                    item : [
                        {
                            id : "default_main_id",
                            name : "default main page",
                            item : ""
                        },
                        {
                            id : "default_main_page_preset",
                            name : "Default Main page preset",
                            item : []
                        }
                    ]
                },
                {
                    id : "pip_mode",
                    name : "PiP Mode(Picture in Picture)",
                    item : false
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
                            item  : ["top-left", "top-right", "bottom-left", "bottom-right"] 
                        },
                        { 
                            id : "location", 
                            name : "Select PiP Location",
                            item  : "top-right"
                        },
                        { 
                            id : "monitor", 
                            name : "",
                            item  : "" 
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
                            item : []
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
                    item : true
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
                    id : "goto_youtube",
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
                    id : "goto_coupangplay",
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


