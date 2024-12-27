import { kawaiProperty, KawaiTemplateValue, KawaiNumberProperty, KawaiId, KawaiBoolProperty, KawaiStringProperty } from "./types"


export type KawaiOptions = kawaiProperty & {

}

export type KawaiName = {name?:string}

export type KawaiBounds = KawaiName & {
    x ?: KawaiName,
    y ?: KawaiName, 
    width ? : KawaiName,
    height ?: KawaiName
}

export type KawaiCollections =  {

}

export type KawaiShortcutNameCollection = {
    [key:string] : KawaiName
}





export type KawaiPage = KawaiName & {
    url : string
}



export type KawaiPiPLocation = KawaiName & {
    location ?: KawaiName,
    monitor ?: KawaiName
}

export type KawaiWindowPreference = KawaiName & {
    [key : string] : undefined | KawaiPiPLocation | KawaiBounds,
    pip_location ?: KawaiPiPLocation,
    pip_window_size ?: KawaiBounds,
}


export type KawaiGeneralNameCollection = KawaiName & {
    [key : string] : KawaiName | undefined | KawaiWindowPreference | KawaiPage ,
    default_main ?: KawaiPage,
    window_preference ?: KawaiWindowPreference,
    render_full_size_when_pip_running ?: KawaiName,
    enable_autoupdate ?: KawaiName,
    dark_mode ?: KawaiName 
    
}


export type LocaleMeta = {
    language : string
    version : string 

}

export type KawaiLocaleConfigure = {
    [key: string] : LocaleMeta| KawaiStringProperty | KawaiLocaleConfigure | KawaiGeneralNameCollection | KawaiShortcutNameCollection | undefined, 

    
    locale_info ?: LocaleMeta,
    locale ?: KawaiLocaleConfigure,
    general ?: KawaiGeneralNameCollection,
    shortcut ?: KawaiShortcutNameCollection,
}




