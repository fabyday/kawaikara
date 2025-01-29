



/**
 * KawaiBehaviorManager
 * It describes Object relationships. Simply we called "Controller".
 */
class KawaiBehaviorManager{
    static __instance : KawaiBehaviorManager | null;


    static getInstance(){
        if ( KawaiBehaviorManager.__instance == null){
            KawaiBehaviorManager.__instance = new KawaiBehaviorManager();
        }
        return KawaiBehaviorManager.__instance;
    }


    public connectTo(){

    }



}