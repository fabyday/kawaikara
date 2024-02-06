import { BrowserWindow } from "electron"

type Cateogry = {

}
type Service = {
    id : string,
    name : string,
    category : string , 
    link : string
}


export const OTT_Category_data = {
    netfilx : {category : "OTT", link: "https://netflix.com/" },
    laftel : {category : "OTT", link: "https://laftel.net/" },
    disney : {category : "OTT", link: "https://www.disneyplus.com/" },

}
export const Streaming_Category_data = {
    youtube : {category : "Streaming", link: "https://www.youtube.com/" },
    twitch : {category : "Streaming", link: "https://www.twitch.tv/" },
    chzzk : {category : "Streaming", link : "https://chzzk.naver.com/"}
}

export const Music_Category_data = {
    applemusic : {category : "Music", link: "https://music.apple.com/kr/" },
    youtubemusic : {category : "Music", link: "https://music.youtube.com/" },
    spotify : {category : "Music", link : "https://open.spotify.com/"}
}



const Setting_Category_data = {
    preference : {category : "setting"}

}