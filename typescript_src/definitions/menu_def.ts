import { KawaiAction } from "./types";

type KawaiId = string;


export interface KawaiCategoryBehavior{
    id : string ,
    menuClicked():KawaiAction
}




export interface KawaiMenuBehavior{
    id : string ,
    category : string,
    menuClicked():KawaiAction

}



