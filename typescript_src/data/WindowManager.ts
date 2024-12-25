import { screen } from "electron/main";



class KawaiWindowManager{

    static __instance : KawaiWindowManager  | undefined = undefined
    preset_size = [
        [720, 576], // 480p
        [720, 480], // 576p
        [800, 600],
        [1280, 720], // 720p 
        [1920, 1080], //1080p
        [3840, 2160], //4k
        [7680,4320], // 8k
    ]

    private constructor(){
        this.findFitPresetSize();
    }

    public getInstance(){
        if(KawaiWindowManager.__instance === undefined){
            KawaiWindowManager.__instance = new KawaiWindowManager();
        }
        return KawaiWindowManager.__instance;
    }

    protected findFitPresetSize(){
        const all_displays = screen.getAllDisplays();

        for(let i = 0 ; i < all_displays.length; i++){
            const display = all_displays[i];
            const width = display.size.width;
            const height = display.size.height;

            const disp_volume = width*height;


        }
    }



    public getPreset() {
        
        return this.preset_size;

    }

}