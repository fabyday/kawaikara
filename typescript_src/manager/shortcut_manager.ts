import { consoleLevels } from '@discord/embedded-app-sdk/output/utils/console';
import {
    ActionCallback,
    ActionChainMap,
    create_action_key_from_string_array,
    KawaiActionMap,
    keyActionListenable,
    normalize_action_string,
    printMap,
} from '../definitions/action';
import { get_flogger, get_logger, log } from '../logging/logger';
import { KawaiViewManager } from './view_manager';
import { flog } from '../component/predefine/api';

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
 * @see
 * Alt+F4 and Alt-Tab is Not allowed.
 */

const flogger = get_flogger('shortcut', 'shortcut', 'debug');

const shortcut_ignoreset = new Set<string>([
    create_action_key_from_string_array('alt', 'tab'),
    create_action_key_from_string_array('alt', 'F4'),
    create_action_key_from_string_array('alt', 'enter'),
]);

class KawaiShortcutProxy implements KawaiAbstractProxy{
    
    id:string;

    constructor(){
        this.id = "100";
    }
    connectCallback(){};

}


export class ShortcutManager {
    static __instance: ShortcutManager | undefined;

    private m_action_map: KawaiActionMap;
    private key_states: string[];
    private pressed_keys: Set<string>;
    private ignore_keys = false;
    private actionDelayTime: number;
    private m_cur_timeout_object: NodeJS.Timeout | null = null;
    private current_view: string;

    private constructor() {
        this.m_action_map = { action_hash: new Map(), actionMap: new Map() };
        this.pressed_keys = new Set<string>();
        this.key_states = [];
        this.actionDelayTime = 1000;
        this.current_view = KawaiViewManager.getInstance().getFocusedViewName();
    }

    public setActionDelay(d: number) {
        this.actionDelayTime = d;
    }

    public static getInstance() {
        if (typeof ShortcutManager.__instance === 'undefined') {
            ShortcutManager.__instance = new ShortcutManager();
        }
        return ShortcutManager.__instance;
    }

    public async initialize() {
        KawaiViewManager.getInstance().addListener(this.resetStates.bind(this));
    }

    public resetStates() {
        flogger.debug('reset states');
        this.current_view = KawaiViewManager.getInstance().getFocusedViewName();
        if (this.m_cur_timeout_object != null) {
            clearTimeout(this.m_cur_timeout_object);
            this.m_cur_timeout_object == null;
            this.pressed_keys.clear();
        }
        flogger.debug('current view states:', this.current_view);
    }

    public async onReleased(key: string) {
        this.pressed_keys.delete(key);
        if (this.pressed_keys.size === 0) {
            flogger.debug('empty release', this.ignore_keys);
            this.ignore_keys = false;
            this.current_view =
                KawaiViewManager.getInstance().getFocusedViewName();
        } else {
            flogger.debug('Not empty release', this.ignore_keys);
            this.ignore_keys = true;
        }

        if (this.pressed_keys.size === 0 && this.key_states.length > 0) {
            if (this.m_cur_timeout_object != null) {
                flogger.debug('clear timeout');
                clearTimeout(this.m_cur_timeout_object);
            }
            flogger.debug('register timeout');
            this.m_cur_timeout_object = setTimeout(() => {
                this.key_states.length = 0; // key_state reset.
                flogger.debug('action sequence timeout.');
                this.m_cur_timeout_object = null;
            }, this.actionDelayTime);
        }
    }

    public async onClicked(key: string) {
        if (this.ignore_keys) {
            this.key_states.length = 0; // reset keystates.
            if (this.m_cur_timeout_object != null) {
                clearTimeout(this.m_cur_timeout_object);
                this.m_cur_timeout_object == null;
            }
            return false;
        }
        this.pressed_keys.add(key);
        return this.onActivate(Array.from(this.pressed_keys));
    }

    public async onActivate(key_sequence: string[]) {
        flogger.debug('activate');
        flogger.debug('current view:', this.current_view);
        if (this.current_view == null) {
            return false;
        }

        let cur_action_map = this.m_action_map.actionMap.get(
            this.current_view,
        )!;
        if (typeof cur_action_map === 'undefined') {
            return false;
        }
        for (let key_action of this.key_states) {
            if (cur_action_map.has(key_action)) {
                cur_action_map = cur_action_map.get(
                    key_action,
                ) as ActionChainMap;
            } else {
                break; // early stopping.
            }
        }
        const normalized_key_seq = create_action_key_from_string_array(
            ...key_sequence,
        );
        if (cur_action_map.has(normalized_key_seq)) {
            const item = cur_action_map.get(normalized_key_seq);
            if (typeof item === 'function') {
                // log.debug('key activate : ', this.key_states);
                this.key_states = [];
                if (this.m_cur_timeout_object !== null) {
                    log.debug('clear timeout');
                    clearTimeout(this.m_cur_timeout_object);
                }
                return item(); // run callback function.
            } else {
                this.key_states.push(normalized_key_seq);
            }
        }

        // console.log(normalized_key_seq);
        // console.log(this.key_states);

        return true;
    }

    public register(o: keyActionListenable, overwrite = true) {
        let actionKey = [];
        if (!Array.isArray(o.actionKey)) {
            actionKey = [o.actionKey];
        } else {
            actionKey = o.actionKey;
        }

        //TODO predefined shortcut need to be skipped.

        this.addActionMap(o.targetView, actionKey, o.onActivated, overwrite);
    }

    public unregister(o : keyActionListenable){

    }

    protected addActionMap(
        targetView: string,
        actions: string[],
        activate_f: ActionCallback,
        overwrite = true,
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

        for (const action of new_actions) {
            if (shortcut_ignoreset.has(action)) {
                flogger.info("action", new_actions, " was rejected.")
                return;
            }
        }

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
                        } else {
                            const tmp = new Map();
                            cur_ref.set(new_actions[i], tmp);
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
                        } else {
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

        this.m_action_map.action_hash.set(activate_f.toString(), new_actions);
    }



    public getIgnoredKeySequence(){
        return shortcut_ignoreset;
    }
}




// const a = ShortcutManager.getInstance();
// a.register({
//     actionKey: ['alt+tab', 'LCtrl+Q'],
//     onActivated: () => {
//         log.debug('double Q!!');
//         return true;
//     },
//     targetView: 'test',
// });
// a.register({
//     actionKey: ['LCtrl+Q', 'alt+tab'],
//     onActivated: () => {
//         log.debug('double Q!!');
//         return true;
//     },
//     targetView: 'test',
// });
// const a = ShortcutManager.getInstance();
// a.register({
//     actionKey: ['LCtrl+LSHIFT+R', 'LCtrl+Q'],
//     onActivated: () => {
//         log.debug('double Q!!');
//         return true;
//     },
//     targetView: 'test',
// });
// a.register({
//     actionKey: ['LCtrl+LSHIFT+R', 'LCtrl+J'],
//     onActivated: () => {
//         log.debug('double J!!');
//         return true;
//     },
//     targetView: 'test',
// });
// a.register({
//     actionKey: ['LCtrl+R', 'LCtrl+Q'],
//     onActivated: () => {
//         return true;
//     },
//     targetView: 'test',
// });
// a.register({
//     actionKey: ['LCtrl+R'],
//     onActivated: () => {
//         log.debug('activate Ctr+R.');
//         return true;
//     },
//     targetView: 'test',
// });
// a.register({
//     actionKey: ['LCtrl+LSHIFT+R', 'LCtrl+Q'],
//     onActivated: () => {
//         return true;
//     },
//     targetView: 'test',
// });

// a.register({
//     actionKey: ['LCtrl+R', 'LCtrl+Q', 'LCtrl+Q'],
//     onActivated: () => {
//         log.debug('finally you catch up.');
//         return true;
//     },
//     targetView: 'test',
// });
