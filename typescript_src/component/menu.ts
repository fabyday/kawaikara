import path from "node:path";
import { global_object } from "../data/context";
import { script_root_path } from "./constants";
import { BrowserView } from "electron";

export function get_menu_instance() {
    const view = new BrowserView({
        webPreferences: {
            contextIsolation: true, // add this

            preload: path.join(__dirname, 'component/predefine/menu_predef.js'),
        },
    });


    global_object.mainWindow?.setBrowserView(view);
    view.setBounds(global_object!.mainWindow!.getBounds());
    let html_path = path.resolve(script_root_path, './pages/sidebar.html');
    view.webContents.loadURL(html_path);
    // view.setBackgroundColor(''); default color is transparent.
    view.webContents.insertCSS('html,body{ overflow: hidden !important; }');
    if (process.env.IS_DEV){
        view.webContents.openDevTools({ mode: 'detach' });
    }
}

