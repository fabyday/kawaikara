import { BrowserView } from 'electron';
import path from 'node:path';
import { global_object } from '../data/context';
import { KAWAI_API_LITERAL } from '../definitions/api';
import { cvrt_electron_path } from '../logics/path';
import { script_root_path } from './constants';
import { bindInputBlocker } from './input_blocker';

export type KawaiUpdateStage =
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'not_available'
    | 'cancelled'
    | 'error';

export type KawaiUpdateState = {
    stage: KawaiUpdateStage;
    title: string;
    message: string;
    version?: string;
    percent?: number;
    bytesPerSecond?: number;
    transferred?: number;
    total?: number;
    canDownload?: boolean;
    canCancel?: boolean;
    canInstall?: boolean;
    canClose?: boolean;
};

let resizeBound = false;

export const defaultUpdateState: KawaiUpdateState = {
    stage: 'idle',
    title: 'Update',
    message: 'Waiting for update activity.',
    canClose: true,
};

let currentUpdateState: KawaiUpdateState = defaultUpdateState;

function syncUpdateViewBounds() {
    const bounds = global_object.mainWindow?.getBounds();
    if (!bounds || !global_object.updateView) {
        return;
    }

    global_object.updateView.setBounds({
        x: 0,
        y: 0,
        width: bounds.width,
        height: bounds.height,
    });
}

export function getUpdateState() {
    return currentUpdateState;
}

export function setUpdateState(state: Partial<KawaiUpdateState>) {
    currentUpdateState = {
        ...currentUpdateState,
        ...state,
    };

    global_object.updateView?.webContents.send(
        KAWAI_API_LITERAL.update.notify_status,
        currentUpdateState,
    );
}

export function get_update_view_instance() {
    if (typeof global_object.updateView === 'undefined') {
        const view = new BrowserView({
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
                preload: path.resolve(__dirname, 'predefine/communicate.js'),
            },
        });

        bindInputBlocker(view);
        (view as any).name = 'update';
        global_object.updateView = view;

        const htmlPath = cvrt_electron_path(
            path.resolve(script_root_path, './pages/update.html'),
        );

        view.webContents.loadURL(
            process.env.KAWAI_RENDERER_DEV_SERVER
                ? 'http://localhost:3000/update.html'
                : htmlPath,
        );

        view.webContents.on('did-finish-load', () => {
            setUpdateState(currentUpdateState);
        });
    }

    return global_object.updateView;
}

export function openUpdateView() {
    const view = get_update_view_instance();
    global_object.inputLocked = true;

    if (global_object.menu) {
        Reflect.defineMetadata('open', false, global_object.menu);
        global_object.mainWindow?.removeBrowserView(global_object.menu);
    }

    global_object.mainWindow?.setBrowserView(view);
    Reflect.defineMetadata('open', true, view);
    syncUpdateViewBounds();

    if (!resizeBound) {
        global_object.mainWindow?.on('resize', syncUpdateViewBounds);
        resizeBound = true;
    }

    view.webContents.focus();
    setUpdateState(currentUpdateState);
}

export function closeUpdateView() {
    if (typeof global_object.updateView === 'undefined') {
        global_object.inputLocked = false;
        return;
    }

    Reflect.defineMetadata('open', false, global_object.updateView);
    global_object.mainWindow?.removeBrowserView(global_object.updateView);
    global_object.inputLocked = false;
    global_object.mainWindow?.webContents.focus();
}
