/**
 * Global Kawai global Keyboard state manager.
 *
 *
 *
 * event graph
 * keyboardpressed(n time) => keyClicked(1 time) => keyReleased(1 time)
 */

import { KawaiActionPreference } from '../definitions/action';
import {
    convertKawaiKeyCode,
    KawaiKeyEvent,
    KawaiKeyState,
    KeyEventListenable,
    priority,
} from '../definitions/keyboard';
import { ShortcutManager } from './shortcut_manager';
import { KawaiViewManager } from './view_manager';

export class KawaiKeyboardManager {
    private static __instance: KawaiKeyboardManager | undefined;

    private m_key_preference: KawaiActionPreference;
    private m_keystates: KawaiKeyState;
    private m_action_states: KawaiKeyState;
    private action_mode = false;

    // private m_targetview_map: Map<string, TargetView>;

    public static getInstance() {
        if (typeof KawaiKeyboardManager.__instance === 'undefined') {
            KawaiKeyboardManager.__instance = new KawaiKeyboardManager();
        }
        return KawaiKeyboardManager.__instance;
    }

    private constructor() {
        this.m_key_preference = { actionDelay: 1000 };
        this.m_keystates = { keys: new Set<string>() };
        this.m_action_states = { keys: new Set<string>() };
        KawaiViewManager.getInstance().addListener(
            this.keyRleaseAll.bind(this),
        );
        // this.m_targetview_map = new Map<string, TargetView>();
    }
    public keyRleaseAll() {
        Array.from(this.m_keystates.keys).forEach((k) => {
            this.onKeyReleased(k);
        });
        this.m_keystates.keys.clear();
    }

    public async keyboard_logics(type: string, key_event: KawaiKeyEvent) {
        const kawai_key_code = convertKawaiKeyCode(key_event);
        let action_mode = false;
        switch (type) {
            case 'keyup':
                this.m_keystates.keys.delete(kawai_key_code);
                this.onKeyReleased(kawai_key_code);
                break;
            case 'keydown':
                this.onKeyPressed();
                if (!this.m_keystates.keys.has(kawai_key_code)) {
                    this.m_keystates.keys.add(kawai_key_code);
                    action_mode = await this.onKeyClicked(kawai_key_code);
                }
                break;
        }

        return action_mode;
        // log.debug(Array.from(this.m_keystates.keys));
    }

    /**
     *
     * @param target_name view name.
     * @param listener First
     */
    public addKeyListener(target_name: string, listener: KeyEventListenable) {
        // if (this.m_targetview_map.has(target_name)) {
        //     const target_meta = this.m_targetview_map.get(target_name)!;
        //     if (isKeyEventListenable(listener)) {
        //         target_meta.keyListener.push(listener);
        //     } else {
        //         target_meta.actionListener.push(listener);
        //     }
        // } else {
        //     this.m_targetview_map.set(target_name, {
        //         actionListener: [],
        //         keyListener: [],
        //         actionMap: new Map(),
        //     });
        //     const target_meta = this.m_targetview_map.get(target_name)!;
        //     if (isKeyEventListenable(listener)) {
        //         target_meta.keyListener.push(listener);
        //     } else {
        //         target_meta.actionListener.push(listener);
        //     }
        // }
    }

    protected checkVaildActionInput() {
        // valid sequence :  [...modifiers] + [AnyKeys](abcd....xyz....function keys and ons.)
        // invalid sequence : someKey(for instance a...z) + modifier + etc

        const keys = Array.from(this.m_action_states.keys);
        const modifier_keys = Array(priority.keys());
        var valid = true;
        try {
            keys.reduce((prev, current) => {
                const prev_val = prev in modifier_keys ? 0 : 1;
                const current_val = current in modifier_keys ? 0 : 1;
                const value = prev_val - current_val;
                if (value == 0) {
                    // this mean same priority
                    valid &&= true;
                } else if (value < 0) {
                    // prev_val < current_val this means
                    valid &&= true;
                } else {
                    // this mean not valid action sequence
                    valid &&= false;
                    throw 'Early Exit';
                }

                return current;
            });
            return true;
        } catch {
            return false;
        }
    }

    public setActionDelayTime(new_delay: number) {
        this.m_key_preference.actionDelay = new_delay;
    }

    /**
     * emit once when key presssed.
     * @param key
     */
    public async onKeyClicked(key: string) : Promise<boolean>{
        return await ShortcutManager.getInstance().onClicked(key);
    }

    public onKeyPressed() {
        return true;
    }

    public onKeyReleased(key: string) {
        ShortcutManager.getInstance().onReleased(key);
    }

    /**
     * do not use it. it's used for test.
     */
    public sendInputEvent() {
        // const focused_view =
        //     KawaiWindowManager.getInstance().getFocusedWindowObject();
        // global_object.mainWindow?.webContents.sendInputEvent({
        //     type: 'keyDown',
        //     keyCode: 'Tab',
        // });
    }
}
