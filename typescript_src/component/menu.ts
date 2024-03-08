








import { Configure, GlobalObject, combineKey, getProperty } from "../definitions/types";
import { Link_data, isCService } from "../definitions/data";
import { Menu } from "electron";

  
     
  // let newMenu= Menu.buildFromTemplate(menu_templete);



  export function attach_menu(gobj : GlobalObject, conf : Configure){
    let menu = []
      for(let category of Link_data.slice(0, -1)){
        let submenu = []
            for(let item of category.item){
                if(isCService(item)){
                    let url : string = item.link as string
                    let shortcut : string = getProperty(conf, combineKey("configure.shortcut", item.id))!.item  as string
                    submenu.push({label : item.name,  accelerator : shortcut , click : ()=>{
                      gobj.mainWindow?.loadURL(url) }
                    })
                    
                }
            }
            menu.push({label : category.name, submenu: submenu})
            console.log(submenu)
        }
        let options = Link_data[Link_data.length - 1]
        
        let option_submenu = []
        for(let item of options.item){
            let shortcut  = getProperty(conf, combineKey("configure.shortcut", item.id))
            if(typeof shortcut === "undefined"){
              option_submenu.push({label : item.name, click : item.link as ()=>void })
            }else{
              option_submenu.push({label : item.name, accelerator : shortcut, click : item.link as ()=>void })
            }
        }
        menu.push({label : options.name,  submenu : option_submenu})
        let newMenu= Menu.buildFromTemplate( menu as any  );
        
        gobj.mainWindow?.setMenu(newMenu)
  }