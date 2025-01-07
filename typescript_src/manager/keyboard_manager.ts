/**
 * Global Kawai global Keyboard state manager.
 *
 *
 *
 * event graph
 * keyboardpressed(n time) => keyClicked(1 time) => keyReleased(1 time)
 */

import { global_object } from '../data/context';
import { KawaiViewManager } from './view_manager';
import { KawaiWindowManager } from './window_manager';

type KawaiKeyState = {
    keys: Set<string>;
};

export type KawaiKeyEvent = {
    //created by function create_action_key. @seealso create_action_key
    key: string;
    readonly altKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly shiftKey: boolean;
};

interface KeyEventListenable {
    onKeyPressed(): boolean;
    onKeyClicked(): boolean;
    onKeyReleased(): boolean;
}

function isKeyEventListenable(obj: unknown): obj is KeyEventListenable {
    return (
        typeof (obj as KeyEventListenable).onKeyPressed !== undefined &&
        typeof (obj as KeyEventListenable).onKeyClicked !== undefined &&
        typeof (obj as KeyEventListenable).onKeyReleased !== undefined
    );
}

interface keyActionListenable {
    actionKey: KawaiKeyEvent[];
    onActivated(): boolean;
}

export const ModifierKeyMap: Map<string, string> = new Map([
    ['controlleft', 'lctrl'], //8
    ['controlright', 'rctrl'], //7
    ['altleft', 'lalt'], //6
    ['altright', 'ralt'], //5
    ['metaleft', 'lmeta'], //4
    ['shiftleft', 'lshift'], //3
    ['shiftright', 'rshift'], //2
    ['contextmenu', 'contextmenu'], //1
]);

const modifier_keys: string[] = Array.from(ModifierKeyMap.keys()); // key list
const priority = new Map();
modifier_keys.forEach((value: string, index: number, array: string[]) => {
    priority.set(value, index);
});

Object.freeze(priority);
Object.freeze(ModifierKeyMap);

export function create_actionkey(...args: string[] | KawaiKeyState[]) {}

export function create_action_key_from_string_array(...args: string[]) {
    //preprocess
    // Ctrl + Alt + Shift + Meta + ....[other keys]
    // make all strings lower case .
    args = args.map((value) => {
        return value.toLowerCase();
    });

    //remove duplicated items.
    args = args.filter((item, index) => {
        args.indexOf(item) === index;
    });

    //sort
    args = args.sort((a: string, b: string) => {
        const prirorA = priority.get(a) || Infinity; // if no priority then give infinity
        const prirorB = priority.get(b) || Infinity;
        return prirorA - prirorB;
    });

    // modifier keys will be convert to kawai modifier key.
    args.map((value) => {
        if (ModifierKeyMap.has(value)) {
            return ModifierKeyMap.get(value);
        } else {
            return value;
        }
    });

    return args.reduce((prev: string, cur: string) => {
        return prev + ',' + cur;
    });
}

type KeyActionMapElem = {
    key: Map<string, Function>;
    preventDefault: boolean;
};

type ActionChainMap = Map<
    string,
    Map<string, Function> | ActionChainMap | Function
>;

type TargetView = {
    actionListener: keyActionListenable[];
    keyListener: KeyEventListenable[];
    actionMap: ActionChainMap;
};
type KawaiActionPreference = {
    actionDelay: number; // integer number. default measure is ms, 1000(ms) == 1 sec.
};

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

    protected createActionMap(action: keyActionListenable) {
        action.actionKey;
    }

    protected addActionListener(target: string, listener: keyActionListenable) {
        if (this.m_targetview_map.has(target)) {
            const target_view = this.m_targetview_map.get(target);
            const length = listener.actionKey.length;
            var tmp = undefined;
            for (var i = length - 1; i >= 0; i--) {
                if (typeof tmp === 'undefined')
                    tmp = new Map([
                        [listener.actionKey[i], listener.onActivated]
                    ]);
                else {
                    tmp = new Map([[listener.actionKey[i], tmp]]);
                }
            }
            target_view!.actionMap = new Map({target_view!.actionMap, ...tmp });
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

    public searchKeyAction() {
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
    public onKeyClicked(key: string) {}

    public onKeyPressed() {
        return true;
    }

    public onKeyReleased() {
        setTimeout(async () => {}, this.m_key_preference.actionDelay);
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
