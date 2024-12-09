

class AbstractSiteDescriptor{
    static {
        SiteDescriptorManager.get_instance().register(this);
    }
    m_name : string ;

   
    constructor(name:string){
        this.m_name = name
    }






    onBeforeSendHeaders (details : Electron.OnBeforeSendHeadersListenerDetails ) : void{
        // do nothing.
    };
    loadurl (browser : Electron.BrowserWindow ) : void{
        //do nothing.
    };

}


class LaftelDescriptor extends AbstractSiteDescriptor{
 
    

    constructor(){
        super("laftel");
    }
}


class NetflixDescriptor extends AbstractSiteDescriptor{
 
    constructor(){
        super("netflix");
    }
}
class CoupangPlayDescriptor extends AbstractSiteDescriptor{
 
    constructor(){
        super("coupangplay");
    }
}