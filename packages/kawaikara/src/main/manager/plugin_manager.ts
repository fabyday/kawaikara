class KawaiPluginManager{

static __instance : KawaiPluginManager | null = null;
    getInstance(){
        if(KawaiPluginManager.__instance){
            KawaiPluginManager.__instance = new KawaiPluginManager()
        }
        return KawaiPluginManager.__instance
    }

    private constructor(){

    }





    load_plugin(){
        
    }


}