
type KawaiId = string


export type KawaiMenuItem = {
    connect_to : KawaiId
}

export type KawaiSubMenu = {
    [key : string] : string | KawaiMenuItem
}

export type KawaiMenu = {
    [key : string] : KawaiSubMenu
}



