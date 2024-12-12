type Constructor<T = {}> = new (...args: any[]) => T;

class SiteDescriptorManager{

    // singleton pattern
    private static _instance : SiteDescriptorManager
    private m_registered_descriptors : any[];
    private constructor(){
        this.m_registered_descriptors = []
    }

    public static get_instance (): SiteDescriptorManager {
        if (!SiteDescriptorManager._instance) {
            SiteDescriptorManager._instance = new SiteDescriptorManager();
        }
        return SiteDescriptorManager._instance;
      }

    
    register(cls : Constructor){
        this.m_registered_descriptors.push(cls);
    }

    qeury_site_descriptor_by_name(name : string) : AbstractSiteDescriptor | undefined {

        return undefined;
    }


    query_site_descriptor_by_site(site_url : string) : AbstractSiteDescriptor | undefined {
        
        return undefined;
    }
}