import { get_menu_instance } from '../component/menu';
import { ShortcutManager } from '../manager/shortcut_manager';
import { KawaiViewManager } from '../manager/view_manager';
import { global_object } from './context';

const menu_name = 'menu';
const mainview = 'mainview';

/**
 * predefined default setup.
 */
ShortcutManager.getInstance().register({
    targetView: menu_name,
    actionKey: 'tab',
    onActivated: () => {
        KawaiViewManager.getInstance().closeMenu();
        return true;
    },
    // onActivated: ()=>{
    //     global_object.mainWindow?.removeBrowserView(global_object.menu!);
    //     if(! global_object.mainWindow?.webContents.isFocused()){
    //         global_object.mainWindow?.webContents.focus();
    //     }
    //     // KawaiViewManager.getInstance().setFocusedView((global_object!.mainWindow as any).name)
    //     return true;
    // }
});
ShortcutManager.getInstance().register({
    targetView: mainview,
    actionKey: 'tab',
    onActivated: () => {
        KawaiViewManager.getInstance().openMenu();
        return true;
    },
});


ShortcutManager.getInstance().register({
    targetView: mainview,
    actionKey: 'alt+enter',
    onActivated: () => {
        KawaiViewManager.getInstance().openMenu();
        return true;
    },
});


ShortcutManager.getInstance().register({
    targetView: menu_name,
    actionKey: 'alt+enter',
    onActivated: () => {
        KawaiViewManager.getInstance().openMenu();
        return true;
    },
});
