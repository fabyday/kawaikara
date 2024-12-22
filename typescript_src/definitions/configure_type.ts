
export type KawaiMap<T>  = {
    [key:string] : T
}



export type kawaiProperty = {
    id : string,
    parent_id : string
}

export type KawaiOptions = kawaiProperty & {

}



export type KawaiBounds = kawaiProperty &{
    x ?: number ,
    y ?: number , 
    width ? : number,
    height ?: number
}

export type KawaiCollections = kawaiProperty & {

}

export type KawaiShortcut = kawaiProperty & {
    shortcut_key : string,
}

export type KawaiShortcutCollection =kawaiProperty & {
    [key:string] : KawaiShortcut
}


type KawaiLocale = {
    id : string
    name : string 

}

export type KawaiLocaleConfigure =  kawaiProperty & {
    name : string 
    selected_locale : KawaiLocale 
    locale_preset : KawaiMap<KawaiLocale>

}


export type KawaiPage = kawaiProperty & {
    url : string
}


export type KawaiBoolProperty = kawaiProperty & {
    value : boolean
}

export type KawaiGeneralCollection = {
    default_main ?: KawaiPage,
    pip_window_size : any ,

    render_full_size_when_pip_running : KawaiBoolProperty,
    enable_autoupdate : KawaiBoolProperty,
    dark_mode : KawaiBoolProperty 
    
}



export type KawaiConfigure = {
    version : string,
    locale : KawaiLocaleConfigure,
    general : KawaiGeneralCollection,
    shortcut : KawaiShortcutCollection,
}




