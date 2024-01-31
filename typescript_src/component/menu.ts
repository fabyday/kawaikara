








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
function get_instance(gobj : GlobalObject):[Menu]{
    if(menu == null){
        let OTT = [OTT_Category_data.netfilx, OTT_Category_data.laftel, OTT_Category_data.disney]
        let Streaming = [Streaming_Category_data.twitch, Streaming_Category_data.youtube, Streaming_Category_data.chzzk]
        let Music = [Music_Category_data.applemusic, Music_Category_data.spotify, Music_Category_data.youtubemusic]
        menu = [{label :"",
          submenu: [{label:"", accelerator:",", click:()=>{}}],
          click : ()=>{} }];
        for(let i = 0 ; i < OTT.length; i++){
            
        }



      }
        
    return menu;
    }