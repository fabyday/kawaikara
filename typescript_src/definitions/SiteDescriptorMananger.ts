import { isSiteDescritor, KawaiSiteDescriptor } from "./SiteDescriptor";

// type DescriptorMapType = {[id:string] : SiteDescriptor;}
type DescriptorMapType = {
    [Key: string]: KawaiSiteDescriptor;
}

class SiteDescriptorManager{

    // singleton pattern
    private static _instance : SiteDescriptorManager
    private m_registered_descriptors :DescriptorMapType ;
    private constructor(){

        this.m_registered_descriptors = {};
    }

    public static get_instance (): SiteDescriptorManager {
        if (!SiteDescriptorManager._instance) {
            SiteDescriptorManager._instance = new SiteDescriptorManager();
        }
        return SiteDescriptorManager._instance;
      }

    
    register(cls : KawaiSiteDescriptor){
        this.m_registered_descriptors[cls.id] = cls;
    }

    // qeury_site_descriptor_by_name(name : string) : AbstractSiteDescriptor | undefined {

    //     return undefined;
    // }


    // query_site_descriptor_by_site(site_url : string) : AbstractSiteDescriptor | undefined {
        
    //     return undefined;
    // }
}

function register_SiteDesc(desc : KawaiSiteDescriptor){
    
    SiteDescriptorManager.get_instance().register(desc);



}