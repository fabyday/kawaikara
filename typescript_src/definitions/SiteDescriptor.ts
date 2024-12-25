// export type KawaiSiteDescriptor={
//     id : string, // id_name
//     loadurl : (browser : Electron.BrowserWindow ) => void ; // default values
//     onBeforeSendHeaders? : (details : Electron.OnBeforeSendHeadersListenerDetails ) => void ;
// }

class KawaiAbstractSiteDescriptor{

    readonly id : string | undefined ;
      
      onBeforeSendHeaders(details : Electron.OnBeforeSendHeadersListenerDetails ) : void {
        // do nothing in abstract class
      }


      loadurl (borwser : Electron.BrowserWindow) :void{
        // do nothing in abstract class
      }

}



class KawaiSiteDescriptorManager{

    // singleton pattern
    private static _instance : KawaiSiteDescriptorManager
    private m_registered_descriptors :Map<string, KawaiAbstractSiteDescriptor> ;
    private constructor(){

        this.m_registered_descriptors = new Map<string, KawaiAbstractSiteDescriptor>();
    }

    public static get_instance (): KawaiSiteDescriptorManager {
        if (!KawaiSiteDescriptorManager._instance) {
            KawaiSiteDescriptorManager._instance = new KawaiSiteDescriptorManager();
        }
        return KawaiSiteDescriptorManager._instance;
      }

    
    register(cls : KawaiAbstractSiteDescriptor){
        this.m_registered_descriptors.set(cls.id as string, cls )
    }

    qeury_site_descriptor_by_name(id : string) : KawaiAbstractSiteDescriptor | undefined {
        
        const id_list : string[] = id.split(".");
        const target_id : string = id_list[ id_list.length - 1 ];
        return this.m_registered_descriptors.get(target_id)
    }


}


function registerKawaiSiteDescriptor( id ?: string ){
    const  wrapper = (cls : typeof KawaiAbstractSiteDescriptor)=>{
        KawaiSiteDescriptorManager.get_instance().register(new cls())
    }


    return wrapper;
}



@registerKawaiSiteDescriptor("test")
class test_cls extends KawaiAbstractSiteDescriptor{

}