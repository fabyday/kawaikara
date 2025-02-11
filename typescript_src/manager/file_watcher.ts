class KawaiFileWatcher {
    static __instance: KawaiFileWatcher | null = null;
    static getInstance() {
        if (KawaiFileWatcher.__instance) {
            KawaiFileWatcher.__instance = new KawaiFileWatcher();
        }
        return KawaiFileWatcher.__instance
    }




    private constructor(){
        // 
    }




    
}
