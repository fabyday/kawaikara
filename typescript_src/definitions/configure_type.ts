import { kawaiProperty, KawaiTemplateValue, KawaiNumberProperty, KawaiId, KawaiBoolProperty, KawaiStringProperty } from "./types"


export type KawaiOptions = kawaiProperty & {

}



export type KawaiBounds = kawaiProperty &{
    x ?: KawaiNumberProperty,
    y ?: KawaiNumberProperty, 
    width ? : KawaiNumberProperty,
    height ?: KawaiNumberProperty
}

export type KawaiCollections = kawaiProperty & {

}

export type KawaiShortcut = kawaiProperty & {
    shortcut_key : KawaiStringProperty,
}

export type KawaiShortcutCollection =kawaiProperty & {
    [key:string] : KawaiShortcut
}


type KawaiLocale = kawaiProperty & {
    path : KawaiStringProperty

}

export type KawaiLocaleConfigure =  kawaiProperty & {
    name ?: KawaiStringProperty 
    selected_locale ?: KawaiLocale 
    locale_preset ?: Map<string, KawaiLocale>

}


export type KawaiPage = kawaiProperty & {
    url : string
}


export type KawaiLiteralPorperty<T> = kawaiProperty & {
    value : T 
}
export type KawaiWindowPreset = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type KawaiPiPLocation = kawaiProperty & {
    location ?: KawaiLiteralPorperty<KawaiWindowPreset>,
    monitor ?: KawaiStringProperty
}

export type KawaiWindowPreference = kawaiProperty & {
    [key : string] : KawaiPiPLocation | KawaiBounds | KawaiBoolProperty | undefined,
    pip_location ?: KawaiPiPLocation,
    pip_window_size ?: KawaiBounds,
}


export type KawaiGeneralCollection = kawaiProperty & {
    [key : string] : KawaiPage | KawaiWindowPreference | KawaiBoolProperty | undefined,

    default_main ?: KawaiPage,
    window_preference ?: KawaiWindowPreference,
    render_full_size_when_pip_running ?: KawaiBoolProperty,
    enable_autoupdate ?: KawaiBoolProperty,
    dark_mode ?: KawaiBoolProperty 
    
}



export type KawaiConfigure = {
    [key: string] : KawaiStringProperty | KawaiLocaleConfigure | KawaiGeneralCollection | KawaiShortcutCollection | undefined, 

    
    version ?: KawaiStringProperty,
    locale ?: KawaiLocaleConfigure,
    general ?: KawaiGeneralCollection,
    shortcut ?: KawaiShortcutCollection,
}




