
export type KawaiMap<T>  = {
    [key:string] : T
}


export type KawaiOptions = {

}



export type KawaiBounds = {
    x : number ,
    y : number , 
    width : number,
    height : number
}

export type KawaiCollections = {

}

export type KawaiShortcut = {
    id : string ,
    name : string,
    shortcut_key : string,
    favicon_url : string
}

export type KawaiShortcutCollection = {
    [key:string] : KawaiShortcut
}


type KawaiLocale = {
    id : string
    name : string 

}

export type KawaiLocaleConfigure = {
    id : string
    name : string 
    selected_locale : KawaiLocale 
    locale_preset : KawaiMap<KawaiLocale>

}

export type KawaiGeneralCollection = {

}


export type KawaiConfigure = {


    locale : KawaiLocaleConfigure,
    general : KawaiGeneralCollection,
    shortcut : KawaiShortcutCollection,

    



}
