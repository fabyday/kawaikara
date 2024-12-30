import { BrowserView, BrowserWindow } from "electron"
import { KawaiConfig, KawaiLiteralPorperty, KawaiLocale, KawaiNameProperty, KawaiWindowPreset } from "./setting_types"
import { KawaiBounds } from "./configure_locale_type"
import { KawaiRecursiveTypeExtractor, KawaiRecursiveTypeRemover } from "./types"


type KawaiWindowMode = "pip" | "fullscreen" | "default"

type KawaiId = string


// KawaiContext Will be saved when quit app.
export type KawaiContext = {
    window_mode ?: KawaiWindowMode
    current_site_descriptor ?: KawaiId
    current_window_bounds ?: KawaiRecursiveTypeRemover<KawaiBounds, KawaiNameProperty>
}


export type GlobalObject = {
    mainWindow? : BrowserWindow 
    preferenceWindow? : BrowserWindow
    options? : BrowserView
    config? : KawaiConfig
    locale? : KawaiLocale
    context ?: KawaiContext
}