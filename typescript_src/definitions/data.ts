import { BrowserWindow } from "electron"

type Cateogry = {
    name : string,
    item : Service[]
}
type Service = {
    id : string,
    name : string,
    category : string, 
    link : string
}
export const Link_data = [{
    name : "OTT",
    item : [
        {
            id : "netflix",
            name : "",
            link : "https://netflix.com/"
        },
        {
            id : "laftel",
            name : "",
            link : "https://laftel.net/"
        },
        {
            id : "disneyplus",
            name : "",
            link : "https://www.disneyplus.com/"
        },
        {
            id : "youtubue",
            name : "",
            link : "https://netflix.com/"
        },
        {
            id : "amazonprime",
            name : "",
            link : "https://netflix.com/"
        },
        {
            id : "wavve",
            name : "",
            link : "https://netflix.com/"
        },
        {
            id : "watcha",
            name : "",
            link : "https://netflix.com/"
        },
        {
            id : "coupangplay",
            name : "",
            link : "https://netflix.com/"
        },
        {
            id : "tving",
            name : "",
            link : "https://netflix.com/"
        },
    ]
    
},
{
    name : "Streaming",
    item : [
        {
            id : "chzzk",
            name : "",
            link : "https://netflix.com/"
        },
        {
            id : "twitch",
            name : "",
            
            link : "https://netflix.com/"
        },
    ]
},
{
    name : "Music",
    item : [
        {
            name : "applemusic",
            link : "https://netflix.com/"
        },
    ]
}]

// export const OTT_Category_data = {
//     netfilx : {category : "OTT", link: "https://netflix.com/" },
//     laftel : {category : "OTT", link: "https://laftel.net/" },
//     disney : {category : "OTT", link:  },

// }
// export const Streaming_Category_data = {
//     youtube : {category : "Streaming", link: "https://www.youtube.com/" },
//     twitch : {category : "Streaming", link: "https://www.twitch.tv/" },
//     chzzk : {category : "Streaming", link : "https://chzzk.naver.com/"}
// }

// export const Music_Category_data = {
//     applemusic : {category : "Music", link: "https://music.apple.com/kr/" },
// }



// const Setting_Category_data = {
//     preference : {category : "setting"}

// }