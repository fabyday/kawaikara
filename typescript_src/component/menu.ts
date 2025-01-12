import path from 'node:path';
import { global_object } from '../data/context';
import { script_root_path } from './constants';
import { BrowserView, webContents } from 'electron';
import { flog } from '../logging/logger';
import { KawaiViewManager } from '../manager/view_manager';

const mainview_name = 'menu';
export function get_menu_instance() {
    if (typeof global_object.menu === 'undefined') {
        const view = new BrowserView({
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
                preload: path.resolve(__dirname, 'predefine/communicate.js'),
            },
        });

        // global_object.mainWindow?.setBrowserView(view);
        global_object.mainWindow?.on('resize', () => {
            const { x, y, width, height } =
                global_object.mainWindow?.getBounds()!;
            view.setBounds({ x: 0, y: 0, width: width, height: height });
        });
        global_object.menu = view;
        const { x, y, width, height } = global_object!.mainWindow!.getBounds()!;
        view.setBounds({ x: 0, y: 0, width: width, height: height });
        let html_path = path.resolve(script_root_path, './pages/sidebar.html');
        view.webContents.loadURL(html_path);
        view.setBackgroundColor('white'); //default color is transparent.
        view.webContents.insertCSS('html,body{ overflow: hidden !important; }');

        if (process.env.IS_DEV) {
            // view.webContents.openDevTools({ mode: 'detach' });
        }
        (view as any).name = 'menu';
        KawaiViewManager.getInstance().trackBrowserFocus(view);
    }

    return global_object!.menu;
}
