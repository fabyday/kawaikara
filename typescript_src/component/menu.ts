import path from 'node:path';
import { global_object } from '../data/context';
import { script_root_path } from './constants';
import { BrowserView } from 'electron';
import { flog } from '../logging/logger';

const mainview_name = 'menu';
export function get_menu_instance() {
    if (typeof global_object.menu === 'undefined') {
        const view = new BrowserView({
            webPreferences: {
                contextIsolation: true, // add this

                preload: path.join(
                    __dirname,
                    'component/predefine/menu_predef.js',
                ),
            },
        });

        global_object.mainWindow?.setBrowserView(view);
        view.setBounds(global_object!.mainWindow!.getBounds());
        let html_path = path.resolve(script_root_path, './pages/sidebar.html');
        global_object.mainWindow?.focusable;
        view.webContents.loadURL(html_path);
        view.setBackgroundColor('white'); //default color is transparent.
        view.webContents.insertCSS('html,body{ overflow: hidden !important; }');
        view.webContents.on(
            'before-input-event',
            (event: Electron.Event, input: Electron.Input) => {
                flog.debug(input);
                if (input.key.toLowerCase() === 'tab') {
                    global_object.mainWindow!.removeBrowserView(view);
                    flog.debug('remove views focused.');
                }
                if (input.type === 'keyUp') event.preventDefault();
            },
        );
        if (process.env.IS_DEV) {
            // view.webContents.openDevTools({ mode: 'detach' });
        }
        (view as any).name = 'menu';
    }

    return global_object!.menu;
}
