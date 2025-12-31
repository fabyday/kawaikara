import { BrowserView, BrowserWindow } from 'electron';
import { global_object } from '../data/context';
import { flog } from '../component/predefine/api';
import { get_flogger, log } from '../logging/logger';
import { get_menu_instance } from '../component/menu';
import { get_preference_instance } from '../component/preference';
import { get_mainview_instance } from '../component/mainview';
import { ipcMain } from 'electron/main';
import { KAWAI_API_LITERAL } from '../definitions/api';
import { KawaiSiteDescriptorManager } from './site_descriptor_manager';
import { KawaiWindowManager } from './window_manager';
import {
    disable_always_on_top,
    disable_fullscreen,
    disable_pipmode,
    eanble_always_on_top,
    enable_fullscreen,
    enable_pipmode,
    rollback_bounds,
    save_view_bounds,
} from '../logics/mainview_logic';
import { KawaikaraViewAction } from '../definitions/SiteDescriptor';
import { reject } from 'lodash';
import { closeAllExtenalBrowser } from '../component/externalBrowser';

const flogger = get_flogger('ViewManager', 'viewmanager', 'debug');

type abortCallbackType = () => Promise<void> | void;

export interface PreloadController {
    wait: (abortCallback: abortCallbackType) => Promise<void>;
    resume: () => void;
    abort: () => void;
}

type Path<T, Prefix extends string = ''> = T extends object
    ? {
          [K in keyof T]: K extends string
              ? `${Prefix}${K}` | Path<T[K], `${Prefix}${K}.`>
              : never;
      }[keyof T]
    : never;

export class KawaiViewManager {
    private static __instance: KawaiViewManager | undefined;
    private m_focused_view: string;

    /**
     * preload controller is Pormise<void>
     */
    private m_preload_controller: PreloadController | null;

    private m_listeners: Array<() => void> = [];
    private constructor() {
        this.m_focused_view = this.getFocusedViewName();
        this.m_preload_controller = null;
    }

    /**
     * initialize runtime values.
     */
    public async initialize() {}

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
                KawaiViewManager.getInstance().setFocusedView(
                    (view as any).name,
                );
            });
        } else {
            // this is BrowserView.
            // view.webContents.on('focus', () => {
            //     log.debug('focus menu on');
            //     KawaiViewManager.getInstance().setFocusedView(
            //         (view as any).name,
            //     );
            // });
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
        if (name == null || typeof name === 'undefined') {
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
        const menu = get_menu_instance();
        Reflect.defineMetadata('open', true, global_object.menu!);
        global_object.mainWindow?.setBrowserView(menu);
        menu.webContents.send(
            KAWAI_API_LITERAL.menu.on_notify_menu_open,
            'open',
        );
        if (!global_object.menu?.webContents.isFocused())
            global_object.menu?.webContents.focus();
    }

    public openPreference() {
        get_preference_instance();
    }

    public isMenuOpen() {
        const menu_open =
            Reflect.getMetadata('open', global_object.menu!) ?? false;
        return menu_open;
    }

    public closeMenu() {
        global_object.menu?.webContents.send(
            KAWAI_API_LITERAL.menu.on_notify_menu_open,
            'close',
        );
        if (typeof global_object?.menu !== 'undefined') {
            Reflect.defineMetadata('open', false, global_object.menu!);
        }
        global_object.mainWindow?.webContents.focus();
    }

    public _closeMenu() {
        // const close_flag = Reflect.getMetadata("close", )
        Reflect.defineMetadata('open', false, global_object.menu!);
        global_object.mainWindow?.removeBrowserView(global_object.menu!);
        if (this.getFocusedViewName() === 'mainview') {
            global_object.mainWindow?.webContents.focus();
        }
    }

    public async loadUrl(desc_id: string) {
        const sel_desc =
            KawaiSiteDescriptorManager.getInstance().qeury_site_descriptor_by_name(
                desc_id,
            );
        const view = get_mainview_instance();
        if (typeof sel_desc !== 'undefined') {
            if (typeof global_object.context === 'undefined') {
                global_object.context = {};
            } else {
                await global_object.context.current_site_descriptor?.unload(
                    view,
                );
                global_object.context.current_site_descriptor = sel_desc;
            }

            // await sel_desc?.preload(view, this._createController());
            // console.log('preload ends');
            // await closeAllExtenalBrowser();
            console.log('close called!');

            await sel_desc?.loadUrl(view);
        }
        // if(this.isMenuOpen()){
        //     this.closeMenu();
        // }
    }

    public _abortCurrentController() {
        this.m_preload_controller?.abort();
    }

    /**
     * create controller, if queued controller exists then abort previous controller fisrt,
     * @returns create wait function
     */
    public _createController(): KawaikaraViewAction {
        // abort fisrt
        this.m_preload_controller?.abort();

        let resolver: (() => void) | null = null;
        let rejecter: ((reason?: string) => void) | null = null;
        let abortCallback: abortCallbackType | null = null;
        let isResumed = false; // check If resume already works
        this.m_preload_controller = {
            abort: async () => {
                await abortCallback?.();
                rejecter?.('abort');
                resolver = null;
                rejecter = null;
                abortCallback = null;
                this.m_preload_controller = null;
            },
            resume: () => {
                isResumed = true;
                if (resolver) {
                    resolver();
                    console.log('resume');
                    resolver = null;
                }
            },
            wait: (abortFunction) =>
                new Promise<void>((resolve, reject) => {
                    if (isResumed) {
                        resolve();
                        console.log('already resumed');
                        return;
                    }
                    rejecter = reject;
                    resolver = resolve;
                    abortCallback = abortFunction;
                }),
        };

        // issue.. value copy
        return {
            wait: (abortFn) => this.m_preload_controller?.wait(abortFn),
            resume: () => this.m_preload_controller?.resume(),
        };
    }

    public pipMode() {
        if (typeof global_object!.context === 'undefined') {
            global_object.context = {};
        }

        if (typeof global_object?.context?.window_mode === 'undefined') {
            global_object.context.window_mode = 'default';
        }
        if (global_object.context.window_mode === 'pip') {
            disable_pipmode(global_object.mainWindow!, global_object.context);
            rollback_bounds(global_object.mainWindow!, global_object.context);
            global_object.context.window_mode = 'default';
        } else {
            const pipBounds = KawaiWindowManager.getInstance().getPipBounds();
            // global_object.mainWindow?.setMinimumSize(
            //     pipBounds.width,
            //     pipBounds.height,
            // );
            enable_pipmode(
                global_object.mainWindow!,
                global_object.context,
                pipBounds,
            );
        }
    }

    public alwaysOnTopMode() {
        if (typeof global_object!.context === 'undefined') {
            global_object.context = {};
        }
        if (typeof global_object?.context?.window_mode === 'undefined') {
            global_object.context.window_mode = 'default';
        }

        if (global_object.context.window_mode === 'always_on_top') {
            save_view_bounds(global_object.mainWindow!, global_object.context);
            disable_always_on_top(
                global_object.mainWindow!,
                global_object.context,
            );
            rollback_bounds(global_object.mainWindow!, global_object.context);
            global_object.context.window_mode = 'default';
        } else {
            eanble_always_on_top(
                global_object.mainWindow!,
                global_object.context,
            );
        }
    }

    public notifyToView(event_name: string, viewname?: string, ...args: any[]) {
        if (typeof viewname === 'undefined') {
            if (typeof global_object?.mainWindow !== 'undefined') {
                global_object.mainWindow?.webContents.send(event_name, args);
            }

            if (typeof global_object.menu !== 'undefined') {
                global_object.menu?.webContents.send(event_name, args);
            }
        }
    }

    protected resetDefaultState() {
        global_object.mainWindow?.setFullScreen(false);
        global_object.mainWindow?.setFullScreenable(false);
    }

    protected rollbackViewState() {
        console.log(global_object!.context!.current_window_bounds!);
        const win_mode = global_object.context?.saved_window_mode;
        global_object.context!.saved_window_mode = undefined;

        global_object.mainWindow?.setBounds(
            global_object!.context!.current_window_bounds!,
        );
    }
    protected saveViewState() {
        // if(global_object.context?.window_mode[0])

        if (typeof global_object.context === 'undefined') {
            global_object.context = {};
        }
        global_object!.context!.current_window_bounds =
            global_object.mainWindow!.getBounds()!;
        global_object!.context!.saved_window_mode =
            global_object.context.window_mode ?? 'default';
    }

    public fullscreen() {
        if (typeof global_object!.context === 'undefined') {
            global_object.context = {};
        }

        if (global_object.context.window_mode === 'fullscreen') {
            disable_fullscreen(
                global_object.mainWindow!,
                global_object.context,
            );
            rollback_bounds(global_object.mainWindow!, global_object.context);
            global_object.context.window_mode = 'default';
            const min_win = KawaiWindowManager.getInstance().getPresetSize()[0];
            global_object.mainWindow?.setMinimumSize(min_win[0], min_win[1]);
        } else {
            enable_fullscreen(global_object.mainWindow!, global_object.context);
        }
    }

    public resizeWindow(width: undefined | number, height: undefined | number) {
        if (global_object.context?.window_mode === 'fullscreen') {
            return;
        }

        if (global_object.context?.window_mode === 'pip') {
            const { x, y, width, height } =
                KawaiWindowManager.getInstance().getPipBounds();
            global_object.mainWindow?.setBounds({
                x: x === -1 ? 0 : x,
                y: y === -1 ? 0 : y,
                width: width,
                height: height,
            });
            return;
        }

        if (typeof width === 'undefined' || typeof height === 'undefined') {
            return;
        }
        const { x, y } =
            KawaiWindowManager.getInstance().findCenterCoordByBounds(
                width,
                height,
            );
        global_object.mainWindow?.setBounds({
            x: x,
            y: y,
            width: width,
            height: height,
        });
    }
}
