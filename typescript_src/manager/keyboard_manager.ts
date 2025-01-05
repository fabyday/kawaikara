
/**
 * Global Kawai global Keyboard state manager.
 * 
 * 
 * 
 * event graph
 * keyboardpressed(n time) => keyClicked(1 time) => keyReleased(1 time)
 */
class KawaiKeyboardManager {
    private static __instance: KawaiKeyboardManager | undefined;



    public static getInstance() {
        if (typeof KawaiKeyboardManager.__instance === 'undefined') {
            KawaiKeyboardManager.__instance = new KawaiKeyboardManager();
        }
        return KawaiKeyboardManager.__instance;
    }

    private constructor() {}



    public keyboard_logics(input : Electron.Input){
        input.modifiers
        switch(input.type){
            case "keyUp":
                
                break;

            case "keyDown":
                break;
            
        } 
    }

    public addKeyListener(){}

    public onKeyClicked() {}

    public onKeyPressed() {}

    public onKeyReleased() {}
}
