


var shortcuts = { 
    id : 'shortcuts',
    label : "Shortcuts",
    icon : 'archive-2',
    form : {
        groups : [
                    {
                        label : "OTT-Shortcuts",
                        fields : [
                                    {
                                        key : "laftel_shortcut",
                                        label : "laftel",
                                        type : "accelerator",
                                    },  
                                    {
                                        key : "netflix_shortcut",
                                        label : "Netflix",
                                        type : "accelerator",
                                    },  
                                    {
                                        key : "disney_shortcut",
                                        label : "disney-plus",
                                        type : "accelerator",
                                    }
                        ]

                }, {
                    label : "Video-Streaming-Shortcuts",
                    fields : [
                                {
                                    key : "twitch",
                                    label : "twitch",
                                    type : "accelerator",
                            }
                    ]

                }, {
                    label : "Music-Streaming-Shortcuts",
                    fields : [
                                {
                                    key : "apple_music_shortcut",
                                    label : "Apple Music",
                                    type : "accelerator",
                            }
                    ]
                }, {
                    label : "PiP(Picture in Picture)",
                    fields : [
                                {
                                    key : "PiP_shortcut",
                                    type : "accelerator",
                            }
                    ]
                }
        ]
    }
}
/////////////////////////////////////////////////////////
//OTT preference
var general = { 
    id : 'general',
    label : "General",
    icon : 'settings-gear-63',
    form : {
        groups : [
                    {
                        label : "PiP(Picture in Picture)",
                        fields : [
                                    
                                    {
                                        key : "width",
                                        label : "width",
                                        type : "number",
                                    },
                                    {
                                        key : "height",
                                        label : "height",
                                        type : "number",
                                    }
                                    ,  
                                    {
                                        key : "netflix_shortcut",
                                        label : "Netflix",
                                        type : "accelerator",
                                    },  
                                    {
                                        key : "disney_shortcut",
                                        label : "disney-plus",
                                        type : "accelerator",
                                    }
                        ]

                }, {
                    label : "\nVideo-Streaming-Shortcuts",
                    fields : [
                                {
                                    key : "twitch",
                                    label : "twitch",
                                    type : "accelerator",
                            }
                    ]

            }, {
                label : "Music-Streaming-Shortcuts",
                fields : [
                            {
                                key : "Apple_Music",
                                label : "Apple Music",
                                type : "accelerator",
                        }
                ]
            }
        ]
    }
}

////////////////////////////////////////////////////////
var update ={ 
    id : 'AutoUpdate',
    label : "AutoUpdate",
    icon : 'square-download',
    form : {
        groups : [
                    {
                        label : "Auto update",
                        fields : [
                                    {
                                        key: 'autoupdate',
                                        type: 'radio',
                                        options: [
                                            {label: "enable auto-update", value: {download : true, install :false}},
                                            {label: "download, but manually install", value: {download : true, install :false}},
                                            {label: "disable auto-update", value: {download: false, install : false}}   
                                        ]
                                }
                        ]

                }
        ]
    }
}
///////////////////////////////////////////////////////////////
// theme
var theme = { 
    id : 'theme',
    label : "Theme",
    icon : 'brightness-6',
    form : {
        groups : [
                    {
                        label : "Theme",
                        fields: [
                            {
                                key: 'theme',
                                type: 'radio',
                                options: [
                                    {label: 'System (default)', value: 'system'},
                                    {label: 'Light', value: 'light'},
                                    {label: 'Dark', value: 'dark'},
                                ],
                                help: 'Light or dark theme?'
                          }
                        ],
                        

                }
                    
        ]
    }
}
/////////////////////////////////////////////////////////////////
preferences_ui = [
    shortcuts,
    general,
    update,
    theme

]

console.log("test")
console.log(preferences_ui)
module.exports  = preferences_ui
