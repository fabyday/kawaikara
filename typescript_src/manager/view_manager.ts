import { global_object } from '../data/context';

export class KawaiViewManager {
    private static __instance: KawaiViewManager | undefined;
    private m_focused_view :string;



    private m_listeners: Array<() => void> = [];
    private constructor() {
        this.m_focused_view = this.getFocusedViewName()
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

    public getViewNames() {
        return [
            (global_object.mainWindow as any).name,
            (global_object.menu as any).name,
            (global_object.preferenceWindow as any).name,
        ];
    }

    public setFocusedView(name : string){
        this.m_focused_view = name;
        this.m_listeners.forEach((f)=>{
            f()
        })

    }


    public addListener( f:  ()=>void ){
        this.m_listeners.push(f);
    }

    public onChangedView(){

    }

    public getFocusedViewName() {
        /// fucking naive method.
        if (global_object.mainWindow?.webContents.isFocused()) {
            return (global_object.mainWindow as any).name;
        } else if (global_object.menu?.webContents.isFocused()) {
            return (global_object.menu as any).name;
        } else if (global_object.preferenceWindow?.webContents.isFocused()) {
            return (global_object.preferenceWindow as any).name;
        }
        return "";
    }
}
