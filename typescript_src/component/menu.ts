








import { GlobalObject } from "../definitions/types";

import { OTT_Category_data, Streaming_Category_data, Music_Category_data } from "../definitions/data";
type Menu_item = {
    label :string,
    accelerator?: string,
    click? : Function 
}

type Menu = {
    label : string ,
    submenu? : [Menu_item]
    click? : Function
}


let menu : null | [Menu] = null;
function get_instance(gobj : GlobalObject):Object{
    if(menu == null){
        let OTT = [OTT_Category_data.netfilx, OTT_Category_data.laftel, OTT_Category_data.disney]
        let Streaming = [Streaming_Category_data.twitch, Streaming_Category_data.youtube, Streaming_Category_data.chzzk]
        let Music = [Music_Category_data.applemusic, Music_Category_data.spotify, Music_Category_data.youtubemusic]
        menu = [];
        for(let i = 0 ; i < OTT.length, i++){
            
        }



        menu=[
  
    {
      label: 'OTT',
      submenu:[
        {
          label : 'netflix',
          accelerator: gobj.config!.shortcut!.goto_netflix,
          click : check_item
        },
        {
          label:'laftel',
          accelerator: gobj.config!.shortcut!.goto_netflix,
          click : check_item
        },
        {
          label:'disney',
          accelerator: 'CommandOrControl+D',
          click : check_item
        },{
          label:'youtube',
          accelerator: 'CommandOrControl+Y',
          click : check_item
        },
        {
          label:'apple music',
          accelerator: 'Control+A',
          click : check_item
        },{
          label:'youtube music',
          accelerator: 'Control+A',
          click : check_item
        },{
          label:'twitch',
          accelerator: 'Control+T',
          click : check_item
        },
        {
          label:'chzzk',
          accelerator: 'Control+C',
          click : check_item
        }
      ]
      
    },
    {
      label : 'features',
      submenu:[{
        label: 'PiP(Picture in Picture)',
        accelerator: 'CommandOrControl+P',
        click : pip_event
      }
    ]
    },
    {
      label: "settings",
      submenu:[{
        label: 'preferences',
        accelerator: 'CommandOrControl+P',
        click : ()=>{preference.show()}
      },
      {
        label : 'check for update',
        click : updater.checkForUpdates
      }
    ]},
    {
      label : "help",
      click : show_help
    },
    
  ];
  
    }
    return menu;

}