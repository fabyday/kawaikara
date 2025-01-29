import { get_menu_instance } from '../component/menu';
import { MenuManager } from '../manager/menu_manager';
import { ShortcutManager } from '../manager/shortcut_manager';
import { KawaiViewManager } from '../manager/view_manager';
import { global_object } from './context';
import { keyActionListenable } from '../definitions/action';
import { RegisterShortcut } from '../logics/register';
const menu_name = 'menu';
const mainview = 'mainview';



@RegisterShortcut
class MainTab implements keyActionListenable {
    targetView = menu_name;
    actionKey = 'tab';
    onActivated() {
        KawaiViewManager.getInstance().closeMenu();
        return true;
    }
}

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
    actionKey: 'lalt+enter',
    onActivated: () => {
        KawaiViewManager.getInstance().openMenu();
        return true;
    },
});

ShortcutManager.getInstance().register({
    targetView: menu_name,
    actionKey: 'lalt+enter',
    onActivated: () => {
        KawaiViewManager.getInstance().openMenu();
        return true;
    },
});

ShortcutManager.getInstance().register({
    targetView: mainview,
    actionKey: 'lctrl+N',
    onActivated: () => {
        console.log('menu open');
        MenuManager.getInstance().onSelectItem('ott', 'menu_netflix');
        return true;
    },
});

ShortcutManager.getInstance().register({
    targetView: mainview,
    actionKey: 'lctrl+Q',
    onActivated: () => {
        console.log('menu open');
        MenuManager.getInstance().onSelectItem('ott', 'menu_laftel');
        return true;
    },
});
