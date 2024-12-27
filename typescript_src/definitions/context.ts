import { BrowserView, BrowserWindow } from "electron"
import { KawaiLocaleData } from "./configure_locale_type"
import { KawaiConfigure, KawaiLiteralPorperty, KawaiWindowPreference, KawaiWindowPreset } from "./setting_types";
import { KawaiId } from "./types";

export type KawaiContext = {
    window_mode ?: KawaiLiteralPorperty<KawaiWindowPreset>
    current_site_descriptor ?: KawaiId
}


export type GlobalObject = {
    mainWindow? : BrowserWindow 
    pipWindow? : BrowserWindow 
    preferenceWindow? : BrowserWindow
    options? : BrowserView
    config? : KawaiConfigure
    locale? : KawaiLocaleData
    context ?: KawaiContext
}


export let global_object : GlobalObject = {};
