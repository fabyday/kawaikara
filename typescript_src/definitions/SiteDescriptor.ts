export type KawaiSiteDescriptor={
    id : string, // id_name
    name : string 
    loadurl : (browser : Electron.BrowserWindow ) => void ; // default values
    onBeforeSendHeaders? : (details : Electron.OnBeforeSendHeadersListenerDetails ) => void ;
}




export function isSiteDescritor(obj : any) :obj is KawaiSiteDescriptor {
    return obj.id !== undefined && obj.name !== undefined  && obj.loadurl !== undefined
}





