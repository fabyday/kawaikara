export type KawaiKeyState = {
    keys: Set<string>;
};

export type KawaiKeyEvent = {
    //created by function create_action_key. @seealso create_action_key
    key: string;
    code : string;
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


export const ModifierList = new Set<string>(["control", "alt", "meta", "shift"])




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
Object.freeze(ModifierKeyMap);

export const ReverseModifierKeyMap: Map<string, string> = new Map();

for(let key in ModifierKeyMap){
    ReverseModifierKeyMap.set(key, ModifierKeyMap.get(key)!);
}
Object.freeze(ReverseModifierKeyMap);

export const kawai_modifier_keys:string[] = Array.from(ReverseModifierKeyMap.keys());
export const modifier_keys: string[] = Array.from(ModifierKeyMap.keys()); // key list
export const priority = new Map();
modifier_keys.forEach((value: string, index: number, array: string[]) => {
    priority.set(ModifierKeyMap.get(value)!, index);
    ReverseModifierKeyMap.set(ModifierKeyMap.get(value)!, value)
});

Object.freeze(kawai_modifier_keys); 
Object.freeze(priority);

export function convertKawaiKeyCode(event:KawaiKeyEvent){
    if(ModifierList.has(event.key.toLowerCase() )){ // if modifier key. then convert it to kawai universal key.
        return ModifierKeyMap.get(event.code.toLowerCase())!;
    }
    return event.key.toLowerCase();

}