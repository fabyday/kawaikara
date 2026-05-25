class KawaiConfigManager{
    private static __instance: KawaiConfigManager | undefined;

    private constructor() {}

    public static getInstance() {
        if (typeof KawaiConfigManager.__instance === 'undefined') {
            KawaiConfigManager.__instance = new KawaiConfigManager();
        }
        return KawaiConfigManager.__instance;
    }

    public async initialize() {}



    public getWindowSize(){

    }


    

}