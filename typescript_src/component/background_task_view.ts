import { BrowserWindow } from 'electron';

import * as path from 'path';
// import isDev from 'electron-is-dev';

import { KawaiWindowManager } from '../manager/window_manager';
import { global_object } from '../data/context';
import { KawaiViewManager } from '../manager/view_manager';
import { script_root_path } from './constants';

export const get_bgtask_view_instnace = (): BrowserWindow => {
    const min_sizes = KawaiWindowManager.getInstance().getPresetSize()[0];
    const { x, y, width, height } =
        KawaiWindowManager.getInstance().getDefaultWindowSize();
    if (typeof global_object?.taskWindow === 'undefined') {
        const taskview = new BrowserWindow({
            x: x,
            y: y,
            width: 400,
            height: 600,
            minWidth: 400,
            minHeight: 600,

            icon: path.join(__dirname, '../../resources/icons/kawaikara.ico'),

            webPreferences: {
                preload: path.resolve(__dirname, 'predefine/communicate.js'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
            },
        });

        taskview.setMenu(null);
        KawaiViewManager.getInstance().trackBrowserFocus(taskview);
        let html_path = path.resolve(
            script_root_path,
            './pages/bgtaskview.html',
        );

        taskview.on('closed', () => {
            global_object.taskWindow = undefined;
        });
        taskview.loadURL(
            process.env.IS_DEV
                ? 'http://localhost:3000/bgtaskview.html'
                : html_path,
        );

        taskview.setFullScreenable(false);
        if (process.env.IS_DEV) {
            taskview.webContents.openDevTools({ mode: 'detach' });
        }
        taskview.webContents.on('page-title-updated', () => {
            taskview.setTitle('Kawai Background TaskView');
        });
        (taskview as any).name = 'bg_task_view';
        global_object.taskWindow = taskview;

        // apply_default_main(
        //     global_object?.config?.preference?.general?.default_main?.id?.value,
        // );

        return global_object.taskWindow;
    }
    return global_object!.taskWindow!;
};
