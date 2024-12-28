import { BrowserView, BrowserWindow } from "electron"
import { KawaiConfig, KawaiLocale } from "./setting_types"


export type KawaiContext = {
    window_mode ?: KawaiLiteralPorperty<KawaiWindowPreset>
    current_site_descriptor ?: KawaiId
}


export type GlobalObject = {
    mainWindow? : BrowserWindow 
    preferenceWindow? : BrowserWindow
    options? : BrowserView
    config? : KawaiConfig
    locale? : KawaiLocale
    context ?: KawaiContext
}


export const global_object : GlobalObject = {


    context : {}
};


