
import { KawaiRecursiveTypeRemover, KawaiRecursiveTypeExtractor } from "./types"

type kawaiProperty<PropName extends string,Type> = {
    [key in `${PropName}` ]?: Type

}


type KawaiValueLiteral = "value"


export type KawaiNameProperty = kawaiProperty<"name", string> 

export type KawaiNumberProperty = KawaiNameProperty & kawaiProperty<KawaiValueLiteral, number> 
export type KawaiStringProperty = KawaiNameProperty & kawaiProperty<KawaiValueLiteral, string> 
export type KawaiBoolProperty = KawaiNameProperty & kawaiProperty<KawaiValueLiteral, boolean> 







export type KawaiBounds = KawaiNameProperty & {
    x ?: KawaiNumberProperty,
    y ?: KawaiNumberProperty, 
    width ? : KawaiNumberProperty,
    height ?: KawaiNumberProperty
}


export type KawaiShortcut = KawaiNameProperty & {
    [key : string] : string | undefined
    shortcut_key? : string,
}

export type KawaiShortcutCollection = KawaiNameProperty & {
    [key:string] : KawaiShortcut  | string
}


export type KawaiLocaleConfigure =   KawaiNameProperty & {
    selected_locale ?: KawaiStringProperty
}


export type KawaiPage =  KawaiNameProperty & {
    url : KawaiStringProperty
}


export type KawaiLiteralPorperty<T> = T
export type KawaiWindowPreset = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type KawaiLocationPresetProperty = KawaiNameProperty & kawaiProperty<KawaiValueLiteral, KawaiWindowPreset>;

export type KawaiPiPLocation =  {
    [key : string]  : KawaiWindowPreset | KawaiStringProperty | undefined ,
    location ?:  KawaiWindowPreset,
    monitor ?: KawaiStringProperty
}


export type KawaiWindowPreference =  {
    [key : string] : KawaiPiPLocation | KawaiBounds | KawaiBoolProperty | undefined,
    pip_location ?: KawaiPiPLocation,
    pip_window_size ?: KawaiBounds,
}


export type KawaiGeneralCollection =  {
    [key : string] : KawaiPage | KawaiWindowPreference | KawaiBoolProperty | undefined,

    default_main ?: KawaiPage,
    window_preference ?: KawaiWindowPreference,
    render_full_size_when_pip_running ?: KawaiBoolProperty,
    enable_autoupdate ?: KawaiBoolProperty,
    dark_mode ?: KawaiBoolProperty 
    
}


export type KawaiPreference = KawaiNameProperty & {
    [key : string] :  string | KawaiLocaleConfigure | KawaiGeneralCollection | KawaiShortcutCollection | undefined | string
    locale ?: KawaiLocaleConfigure,
    general ?: KawaiGeneralCollection,
    shortcut ?: KawaiShortcutCollection,
}
export type KawaiVersion = {version ?: string}
export type KawaiConfigure = {
    [key: string] : KawaiPreference | KawaiStringProperty | undefined, 

    preference ?: KawaiPreference
    version ?: KawaiStringProperty,
}

export type KawaiConfig = KawaiRecursiveTypeRemover<KawaiConfigure, KawaiNameProperty> ;
export type KawaiLocale = KawaiRecursiveTypeExtractor<KawaiConfigure, KawaiNameProperty> ;


// let s : KawaiLocale = {version : { name : "test" } }
// let sa : KawaiConfig  = { version : {value : "3.1.4"}}

