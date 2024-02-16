import { BrowserWindow } from "electron"

type Cateogry = {
    id : string,
    name : string,
    item : Cateogry|Service[]
}
type Service = {
    id : string,
    name : string,
    category : string, 
    link : string | Function
}
export const Link_data = [{
    id : "ott",
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
            link : "https://www.primevideo.com/"
        },
        {
            id : "wavve",
            name : "",
            link : "https://www.wavve.com/"
        },
        {
            id : "watcha",
            name : "",
            link : "https://watcha.com/"
        },
        {
            id : "coupangplay",
            name : "",
            link : "https://www.coupangplay.com/"
        },
        {
            id : "tving",
            name : "",
            link : "https://www.tving.com/"
        },
    ]
    
},
{
    id : "streaming",
    item : [
        {
            id : "chzzk",
            name : "",
            link : "https://chzzk.naver.com/"
        },
        {
            id : "twitch",
            name : "",
            link : "https://www.twitch.tv/"
        },
    ]
},
{
    id : "music",
    item : [
        {
            id : "applemusic",
            name : "",
            link : "https://music.apple.com/"
        },
    ]
},
{
    
        id : "option",
        item : [
            {
                "id" : "appinfo",
                "name" : "소개"
            },
            {
                "id" :"preference",
                "name" : "설정"
            },
            {
                "id" : "check_update",
                "name" : "업데이트 체크"
            },
            {
                "id" : "github",
                "name" : "깃허브"
            }

        ]
    
}]

