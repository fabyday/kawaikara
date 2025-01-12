import { BrowserView, BrowserWindow } from 'electron';
import { global_object } from '../data/context';
import { flog } from '../component/predefine/api';
import { get_flogger, log } from '../logging/logger';
import { get_menu_instance } from '../component/menu';
import { get_preference_instance } from '../component/preference';

const flogger = get_flogger('ViewManager', 'viewmanager', 'debug');

export class KawaiViewManager {
    private static __instance: KawaiViewManager | undefined;
    private m_focused_view: string;

    private m_listeners: Array<() => void> = [];
    private constructor() {
        this.m_focused_view = this.getFocusedViewName();
    }

    public static getInstance() {
        if (KawaiViewManager.__instance === undefined) {
            KawaiViewManager.__instance = new KawaiViewManager();
        }
        return KawaiViewManager.__instance;
    }
    public getFocusedViewObject() {
        if (global_object.mainWindow?.webContents.isFocused()) {
            return global_object.mainWindow;
        } else if (global_object.menu?.webContents.isFocused()) {
            return global_object.menu;
        } else if (global_object.preferenceWindow?.webContents.isFocused()) {
            return global_object.preferenceWindow;
        }
        return undefined;
    }

    public trackBrowserFocus(view: BrowserView | BrowserWindow) {
        // tracking focus.
        if (view instanceof BrowserWindow) {
            flogger.info('set borwser window');

            view.webContents.on('focus', () => {
                console.log(
                    'get browserView',
                    global_object.mainWindow?.getBrowserView(),
                );
                if (global_object.mainWindow?.getBrowserView() == null) {
                    KawaiViewManager.getInstance().setFocusedView(
                        (view as any).name,
                    );
                } else {
                    KawaiViewManager.getInstance().setFocusedView(
                        (global_object.menu as any).name,
                    );

                    // console.log('web content focus');
                    global_object!.menu!.webContents.focus();
                }
            });
            // view.on('blur', () => {
            //     KawaiViewManager.getInstance().setFocusedView();
            //     return;
            // });
        } else {
            // this is BrowserView.
            view.webContents.on('focus', () => {
                log.debug('focus menu on');
                KawaiViewManager.getInstance().setFocusedView(
                    (view as any).name,
                );
            });
            // view.webContents.on('blur', () => {
            //     // KawaiViewManager.getInstance().setFocusedView();
            // });
        }
    }

    public getViewNames() {
        return [
            (global_object.mainWindow as any).name,
            (global_object.menu as any).name,
            (global_object.preferenceWindow as any).name,
        ];
    }

    public setFocusedView(name?: string) {
        log.debug('view changed To: ', name);
        if ( name == null || typeof name === 'undefined') {
            this.m_focused_view = '';
        } else {
            this.m_focused_view = name;
        }
        this.m_listeners.forEach((f) => {
            f();
        });
    }

    public addListener(f: () => void) {
        this.m_listeners.push(f);
    }

    public getFocusedViewName() {
        return this.m_focused_view;
    }

    public openMenu() {
        global_object.mainWindow?.setBrowserView(get_menu_instance());
        if (!global_object.menu?.webContents.isFocused())
            global_object.menu?.webContents.focus();
    }

    public openPreference() {
        get_preference_instance();
    }

    public closeMenu() {
        global_object.mainWindow?.removeBrowserView(global_object.menu!);
        if (!global_object.mainWindow?.webContents.isFocused()) {
            global_object.mainWindow?.webContents.focus();
        }
    }
}
