import { BrowserView, BrowserWindow } from 'electron';
import { global_object } from '../data/context';

export function bindInputBlocker(view: BrowserView | BrowserWindow) {
    view.webContents.on('before-input-event', (event) => {
        if (global_object.inputLocked) {
            event.preventDefault();
        }
    });
}
