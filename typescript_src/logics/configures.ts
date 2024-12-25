import { KawaiConfigure } from "../definitions/configure_type";




// is this should be used for change or query data?
// function get_property( id: string, conf : KawaiConfigure) : any {
//     // we don't know child property its class
//     let id_list : string[]
//     if(typeof id === "string"){
//         id_list = id.split(".")
//     }else{
//         id_list = id
//     }

//     let child_property : any = conf;
//     for(var current_id of id_list){
//         child_property = child_property[current_id];
//         if(child_property === undefined)
//             return undefined
//     }
//     return child_property
// }


function set_general_configuration(jsondata : JSON){

}


function set_shortcut_configuration(jsondata : JSON){

}



/**
 * 
 * @param jsondata  jsondata or json file path
 * @param conf if value was undefined, then create new @KawaiConfigure
 */
function set_configuration(jsondata : JSON | string, conf ?: KawaiConfigure){

    set_general_configuration();
    set_shortcut_configuration();
    

}


