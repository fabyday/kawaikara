
export type KawaiKeyState = {
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

export interface KeyEventListenable {
    onKeyPressed(): boolean;
    onKeyClicked(): boolean;
    onKeyReleased(): boolean;
}

export function isKeyEventListenable(obj: unknown): obj is KeyEventListenable {
    return (
        typeof (obj as KeyEventListenable).onKeyPressed !== undefined &&
        typeof (obj as KeyEventListenable).onKeyClicked !== undefined &&
        typeof (obj as KeyEventListenable).onKeyReleased !== undefined
    );
}

export interface keyActionListenable {
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

export const modifier_keys: string[] = Array.from(ModifierKeyMap.keys()); // key list
export const priority = new Map();
modifier_keys.forEach((value: string, index: number, array: string[]) => {
    priority.set(value, index);
});

Object.freeze(priority);
Object.freeze(ModifierKeyMap);