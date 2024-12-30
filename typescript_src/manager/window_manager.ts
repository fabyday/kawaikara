import { screen } from "electron/main";



class KawaiWindowManager{

    static __instance : KawaiWindowManager  | undefined = undefined
    static readonly  preset_size = [
        [720, 576], // 480p
        [720, 480], // 576p
        [800, 600],
        [1280, 720], // 720p 
        [1920, 1080], //1080p
        [3840, 2160], //4k
        [7680,4320], // 8k
    ]

    private constructor(){

    }

    public getInstance(){
        if(KawaiWindowManager.__instance === undefined){
            KawaiWindowManager.__instance = new KawaiWindowManager();
        }
        return KawaiWindowManager.__instance;
    }

    protected getPresetSize(){
        const all_displays = screen.getAllDisplays();
        

        let max_volume = 0
        let max_volume_index = -1
        for(let i = 0 ; i < all_displays.length; i++){
            const display = all_displays[i];
            const width = display.size.width;
            const height = display.size.height;

            const display_volume = width*height;
            if(max_volume < display_volume){
                max_volume = display_volume
                max_volume_index = i
            }
        }

        const width = all_displays[max_volume_index].size.width
        const height = all_displays[max_volume_index].size.height 
        


        const selected_preset = KawaiWindowManager.preset_size.filter((value : number[], index : number , array:number[][])=>{
            if(value[0] < width || value[1] < height){
                return value;
            }
        })
        const max_preset = selected_preset[selected_preset.length-1]
        if( max_preset[0] < width && max_preset[1] < height){
            selected_preset.push([width,height])
        }
        
        return selected_preset
    }

    public getPictureInPicturePresetSize(){
        const preset_size = this.getPresetSize();
        const end_index :  number| undefined = preset_size.length - 2 > 0 ? preset_size.length - 2 : undefined
        const pip_preset = [[400,300], [600, 400]].concat(...preset_size.slice(0, end_index))
        return pip_preset
    }


}