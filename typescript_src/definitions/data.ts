import { BrowserWindow, app, dialog } from "electron"
import * as path from 'path'
type Cateogry = {
    id : string,
    name : string,
    item : Cateogry|Service[]
}
type Service = {
    id : string,
    name : string,
    category : string, 
    link : string | Function
}

import { shell } from "electron"
import { CItem, Configure, GlobalObject, getProperty } from "./types"
import { checkForUpdates } from "../component/autoupdater"
import { get_instance } from "../component/preference"
import { apply_pipmode } from "../logics/preference_logic"
import { script_root_path } from "../component/constants";

const app_info_f = ()=>{

}

const check_update_f = ()=>{
}

const open_preference_f = ()=>{

}
const open_extension_f = ()=>{

}
const goto_github_f = ()=>{
    shell.openExternal("https://github.com/fabyday/kawaikara")
}

export function isCService(obj : any) :obj is Service {
    return obj.link !== undefined
}

export const Link_data = [{
    id : "ott",
    name : "OTT",
    item : [
        {
            id : "goto_netflix",
            name : "netflix",
            link : "https://netflix.com/"
        },
        {
            id : "goto_laftel",
            name : "laftel",
            link : "https://laftel.net/"
        },
        {
            id : "goto_disney",
            name : "disneyplus",
            link : "https://www.disneyplus.com/"
        },
        {
            id : "goto_youtube",
            name : "youtubue",
            link : "https://youtube.com/"
        },
        {
            id : "goto_amazonprime",
            name : "amazonprime",
            link : "https://www.primevideo.com/"
        },
        {
            id : "goto_wavve",
            name : "wavve",
            link : "https://www.wavve.com/"
        },
        {
            id : "goto_watcha",
            name : "watcha",
            link : "https://watcha.com/"
        },
        {
            id : "goto_coupangplay",
            name : "coupangplay",
            link : "https://www.coupangplay.com/"
        },
        {
            id : "goto_tving",
            name : "tving",
            link : "https://www.tving.com/"
        }
        
    ]
    
},
{
    id : "streaming",
    name : "streaming",
    item : [
        {
            id : "goto_chzzk",
            name : "chzzk",
            link : "https://chzzk.naver.com/"
        },
        {
            id : "goto_twitch",
            name : "twitch",
            link : "https://www.twitch.tv/"
        },
    ]
},
{
    id : "music",
    name : "music",
    item : [
        {
            id : "goto_applemusic",
            name : "applemusic",
            link : "https://music.apple.com/"
        },
    ]
},
{
    
        id : "option",
        name : "option",
        item : [
            {
                id : "appinfo",
                name : "info",
                link : app_info_f
            },
            {
                id :"preference",
                name : "preference",
                link : open_preference_f
            },
            {
                id :"run_pip",
                name : "PiP Mode",
                link : open_preference_f
            },
            {
                id : "check_update",
                name : "check update",
                link : check_update_f
            },
            {
                id : "github",
                name : "github",
                link : goto_github_f
            },
            {
                id : "goto_extension",
                name : "extension",
                link : open_extension_f
            }

        ]
    
}]



export function setup_menu_funtionality(gobj : GlobalObject, conf : Configure){
    const app_info_f = ()=>{
                const message = 
        `Welcome to Kawaikara ${app.getVersion()}. This application is OTT Streaming Viewer`;
        dialog.showMessageBox(gobj!.mainWindow!, {title : "Kawaikara Info",message :`Kawaikara v${app.getVersion()}`, detail: message})
    }

    const open_preference_f = ()=>{
        gobj.preferenceWindow = get_instance(conf)
        gobj.preferenceWindow.show()
    }
    
    const open_extension_f = ()=>{
        let extension_file_url = path.resolve(script_root_path, "./pages/extension.html")
        gobj.mainWindow!.loadURL(extension_file_url)
        gobj.mainWindow!.show()
    }
    const check_update_f = ()=>{
        checkForUpdates();
    }
    const goto_github_f = ()=>{
        shell.openExternal("https://github.com/fabyday/kawaikara")
    }
    const apply_pip_mode_f = ()=>{
        const pipmode_info = getProperty(gobj.config!, "configure.general.pip_mode")! as CItem
        console.log("pip bb ; ", pipmode_info.item)
        pipmode_info.item = !pipmode_info.item
        console.log("pip bb", pipmode_info.item)
        console.log("pip bb really saved?", getProperty(gobj.config!, "configure.general.pip_mode")!.item as any)
        apply_pipmode(gobj, gobj.config!)
    }

    for(let item of Link_data[Link_data.length - 1].item ){

        switch(item.id){
            case "appinfo":
                item.link = app_info_f
                break;
            case "check_update":
                item.link = check_update_f
                break;
            case "preference":
                item.link = open_preference_f
                break;
            case "github":
                item.link = goto_github_f
                break;
            case "run_pip":
                item.link = apply_pip_mode_f
                break;
            case "goto_extension":
                item.link = open_extension_f
                break
        }
    }

}