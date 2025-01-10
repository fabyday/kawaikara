import { consoleLevels } from '@discord/embedded-app-sdk/output/utils/console';
import {
    ActionChainMap,
    create_action_key_from_string_array,
    KawaiActionMap,
    keyActionListenable,
    normalize_action_string,
    printMap,
} from '../definitions/action';
import { get_logger, log } from '../logging/logger';

/**
 * Action Key Rule
 *
 * example 1, this subcommand Not allowed.
 * this registration will be overwritten sequencially.
 * @unsatisfies
 * LCtrl+R : some function 1
 * LCtrl+R, LCtrl+J : some function 2
 * then register last registered action.
 *
 * example2
 * @satisfies
 *  LCtrl+R, LCtrl+J
 *  LCtrl+R, LCtrl+C
 * this is Ok.
 * 
 * 
 * Real Example
 * a.register({actionKey  : ["LCtrl+R"], onActivated : ()=>{return true}, targetView:"test"})

 */

log
export class ShortcutManager {
    static __instance: ShortcutManager | undefined;

    private m_action_map: KawaiActionMap;
    private constructor() {
        this.m_action_map = { action_hash: new Map(), actionMap: new Map() };
    }

    public static getInstance() {
        if (typeof ShortcutManager.__instance === 'undefined') {
            ShortcutManager.__instance = new ShortcutManager();
        }
        return ShortcutManager.__instance;
    }

    public async initialize() {}

    public async onActivate(key_sequence : string[]){
        const normalized_key_seq = create_action_key_from_string_array(...key_sequence)
        const keys = Array.from(this.m_action_map.actionMap.keys());

    }

    public register(o: keyActionListenable, overwrite: boolean = true) {
        var actionKey = [];
        if (!Array.isArray(o.actionKey)) {
            actionKey = [o.actionKey];
        } else {
            actionKey = o.actionKey;
        }
        this.addActionMap(o.targetView, actionKey, o.onActivated, overwrite);
        console.log(this.m_action_map.actionMap)
    }

    protected addActionMap(
        targetView: string,
        actions: string[],
        activate_f: Function,
        overwrite: boolean = true,
    ) {
        const actionMap = this.m_action_map.actionMap;

        const new_actions = actions.map((val) => {
            const norm_actions: string[] = normalize_action_string(val);
            const action_key = create_action_key_from_string_array(
                ...norm_actions,
            );
            return action_key;
        });
        if (!actionMap.has(targetView)) {
            actionMap.set(targetView, new Map());
        }
        console.log(new_actions)
        var cur_ref = actionMap.get(targetView)!;
        for (var i = 0; i < new_actions.length; i++) {
            if (cur_ref.has(new_actions[i])) {
                const elem = cur_ref.get(new_actions[i])!;
                if (typeof elem === 'function') {
                    // this means that end-point.)
                    if (!overwrite) {
                        throw 'already function existed.';
                    } else {
                        // overwrite
                        if (i === new_actions.length - 1) {
                            cur_ref.set(new_actions[i], activate_f);
                        }else{
                            const tmp = new Map()
                            cur_ref.set(new_actions[i], tmp)
                            cur_ref = tmp;
                        }
                    }
                } else {
                    // Else then It is Map type.
                    if (!overwrite) {
                        throw 'already function existed.';
                    } else {
                        // overwrite
                        if (i === new_actions.length - 1) {
                            cur_ref.set(new_actions[i], activate_f);
                        }else{
                            cur_ref = elem;
                        }
                    }
                }
            } else {
                // IF Not has Values about Key.
                if (i === new_actions.length - 1) {
                    cur_ref.set(new_actions[i], activate_f);
                } else {
                    const tmp = new Map();
                    cur_ref.set(new_actions[i], tmp);
                    cur_ref = tmp;
                }
            }
        }

        this.m_action_map.action_hash.set(activate_f.toString(), new_actions)

    }
}



// const a = ShortcutManager.getInstance()
// a.register({actionKey  : ["LCtrl+LSHIFT+R", "LCtrl+Q"], onActivated : ()=>{return true}, targetView:"test"})
// a.register({actionKey  : ["LCtrl+LSHIFT+R", "LCtrl+J"], onActivated : ()=>{return true}, targetView:"test"})
// a.register({actionKey  : ["LCtrl+R", "LCtrl+Q"], onActivated : ()=>{return true}, targetView:"test"})
// a.register({actionKey  : ["LCtrl+R"], onActivated : ()=>{return true}, targetView:"test"})
// a.register({actionKey  : ["LCtrl+LSHIFT+R", "LCtrl+Q"], onActivated : ()=>{return true}, targetView:"test"})
