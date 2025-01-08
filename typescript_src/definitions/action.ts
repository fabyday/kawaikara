import {
    KawaiKeyState,
    keyActionListenable,
    KeyEventListenable,
    ModifierKeyMap,
    priority,
} from './keyboard';

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

export type KeyActionMapElem = {
    key: Map<string, Function>;
    preventDefault: boolean;
};

export type ActionChainElem1 = Map<string, Function> | Function;
export type ActionChainElem2 = {
    action: Function;
    subcommand: Map<string, ActionChainElem1 | ActionChainElem2>;
};

export function isActionChainElem1(obj: unknown): obj is ActionChainElem1 {
    return typeof obj === 'function' || obj instanceof Map;
}
export function isActionChainElem2(obj: unknown): obj is ActionChainElem2 {
    return (
        typeof (obj as ActionChainElem2).action !== 'undefined' &&
        typeof (obj as ActionChainElem2).subcommand !== 'undefined'
    );
}

export type ActionChainMap = Map<string, ActionChainElem1 | ActionChainElem2>;

export type TargetView = {
    actionListener: keyActionListenable[];
    keyListener: KeyEventListenable[];
    actionMap: ActionChainMap;
};
export type KawaiActionPreference = {
    actionDelay: number; // integer number. default measure is ms, 1000(ms) == 1 sec.
};



function createActionMap(target: string, action: keyActionListenable) {
    const target_view = this.m_targetview_map.get(target);

    if (action.actionKey.length === 0) {
        throw 'Empty Action Key.';
    }

    var actionmap: ActionChainMap = new Map([
        [
            action.actionKey[action.actionKey.length - 1].key,
            action.onActivated,
        ],
    ]);
    for (let i = action.actionKey.length - 2; i >= 0; i--) {
        actionmap = new Map([[action.actionKey[i].key, actionmap]]);
    }
    var key_list: string[] = Array.from(actionmap.keys());
    key_list = key_list.reverse();
    let key = undefined;
    let current_action_map = target_view!.actionMap;
    while ((key = key_list.pop())) {
        if (current_action_map!.has(key)) {
            const object = current_action_map!.get(key);
            if (isActionChainElem2(object)) {
                current_action_map = object.subcommand
                
            } else if(object instanceof Map){
                current_action_map = object
            }
            else if (object instanceof Function) {
                const tmp : ActionChainElem2 = {action : object, subcommand : new Map<string, ActionChainElem1>()};
                current_action_map.set(key, tmp)
                current_action_map = tmp.subcommand

            } else {
            }
            continue;
        } else {
            target_view!.actionMap.set(key, actionmap!.get(key));
            break;
        }
    }
}