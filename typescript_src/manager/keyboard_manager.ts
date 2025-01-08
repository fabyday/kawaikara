/**
 * Global Kawai global Keyboard state manager.
 *
 *
 *
 * event graph
 * keyboardpressed(n time) => keyClicked(1 time) => keyReleased(1 time)
 */

import { global_object } from '../data/context';
import { KawaiActionPreference, TargetView } from '../definitions/action';
import {
    isKeyEventListenable,
    KawaiKeyEvent,
    KawaiKeyState,
    keyActionListenable,
    KeyEventListenable,
    priority,
} from '../definitions/keyboard';
import { KawaiViewManager } from './view_manager';
import { KawaiWindowManager } from './window_manager';

export class KawaiKeyboardManager {
    private static __instance: KawaiKeyboardManager | undefined;

    private m_key_preference: KawaiActionPreference;
    private m_keystates: KawaiKeyState;
    private m_action_states: KawaiKeyState;

    private m_targetview_map: Map<string, TargetView>;

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
        this.m_targetview_map = new Map<string, TargetView>();
    }

    public keyboard_logics(type: string, key_event: KawaiKeyEvent) {
        switch (type) {
            case 'keyup':
                this.m_keystates.keys.delete(key_event.key);
                this.onKeyReleased();
                break;
            case 'keydown':
                this.onKeyPressed();
                if (!this.m_keystates.keys.has(key_event.key)) {
                    this.m_keystates.keys.add(key_event.key);
                    this.onKeyClicked(key_event.key);
                }
                break;
        }
        this.searchKeyAction(); // check proper action existed>>>>
    }

    protected addActionListener(target: string, listener: keyActionListenable) {
        if (this.m_targetview_map.has(target)) {
            const target_view = this.m_targetview_map.get(target);
            const length = listener.actionKey.length;

            let tmp = new Map<string, any>(); // 임시 Map 초기화

            for (let i = length - 1; i >= 0; i--) {
                if (tmp.size === 0) {
                    tmp.set(listener.actionKey[i].key, listener.onActivated);
                } else {
                    tmp = new Map([[listener.actionKey[i].key, tmp]]);
                }
            }
        }
    }
    /**
     *
     * @param target_name view name.
     * @param listener First
     */
    public addKeyListener(
        target_name: string,
        listener: KeyEventListenable | keyActionListenable,
    ) {
        if (this.m_targetview_map.has(target_name)) {
            const target_meta = this.m_targetview_map.get(target_name)!;
            if (isKeyEventListenable(listener)) {
                target_meta.keyListener.push(listener);
            } else {
                target_meta.actionListener.push(listener);
            }
        } else {
            this.m_targetview_map.set(target_name, {
                actionListener: [],
                keyListener: [],
                actionMap: new Map(),
            });
            const target_meta = this.m_targetview_map.get(target_name)!;
            if (isKeyEventListenable(listener)) {
                target_meta.keyListener.push(listener);
            } else {
                target_meta.actionListener.push(listener);
            }
        }
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

    protected searchKeyAction() {
        if (this.checkVaildActionInput()) {
            const focused_view_name =
                KawaiViewManager.getInstance().getFocusedViewName();
            const target_action_map =
                this.m_targetview_map.get(focused_view_name);
        }
    }

    public setActionDelayTime(new_delay: number) {
        this.m_key_preference.actionDelay = new_delay;
    }

    /**
     * emit once when key presssed.
     * @param key
     */
    public onKeyClicked(key: string) {
        if (this.checkVaildActionInput()) {
        }
    }

    public onKeyPressed() {
        return true;
    }

    public onKeyReleased() {
        if (this.checkVaildActionInput()) {
            // check subcommand.
            //set time out.
            setTimeout(async () => {
                this.m_keystates.keys.clear(); // check
            }, this.m_key_preference.actionDelay);
        }
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
