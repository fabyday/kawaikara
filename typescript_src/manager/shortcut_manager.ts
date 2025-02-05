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
import { EventEmitter } from 'stream';
import { normalize_locale_string } from '../logics/os';

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

type event_type = 'activated';

export class ShortcutManager {
    static __instance: ShortcutManager | undefined;

    private m_action_map: KawaiActionMap;
    private key_states: string[];
    private pressed_keys: Set<string>;
    private ignore_keys = false;
    private actionDelayTime: number;
    private m_cur_timeout_object: NodeJS.Timeout | null = null;
    private current_view: string;

    private m_event_emitter = new EventEmitter();

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
            if (typeof item === 'string' || typeof item === 'undefined') {
                // it means action ID

                this.key_states = [];
                if (this.m_cur_timeout_object !== null) {
                    log.debug('clear timeout');
                    clearTimeout(this.m_cur_timeout_object);
                }
            }

            if (typeof item === 'string') {
                const ActionInterface = this.m_action_map.action_hash.get(item);
                if (typeof ActionInterface !== 'undefined') {
                    if (typeof ActionInterface.onActivated === 'undefined') {
                        this.m_event_emitter.emit(
                            'activated',
                            ActionInterface.id,
                        );
                    } else {
                        return ActionInterface.onActivated();
                    }
                }
            } else {
                return true; // do nothing.
            }
        } else {
            this.key_states.push(normalized_key_seq);
        }
    }

    /**
     *
     * @param id
     * @param key_action "" empty string means delete keyAction.
     */
    public queryAndModifyShortcut(id: string, key_action: string[] | string) {
        if (this.m_action_map.action_hash.has(id)) {
            this._deleteActionCache(id);
        }

        const current_action = this.m_action_map.action_hash.get(id);
        if (typeof current_action === 'undefined') {
            return; // stop this is invalid request. and throw error. so I quit.
        }

        let actionKey = [];
        if (Array.isArray(key_action)) {
            actionKey = key_action;
        } else {
            actionKey = [key_action];
        }
        current_action.actionKey = actionKey;
        this.addActionMap(id, current_action!.targetView, actionKey);
    }

    public _deleteActionCache(id: string) {
        const target_action = this.m_action_map.action_hash.get(id);

        flogger.debug('delete Action Cahche.');

        /**
         *
         * @param ref target to delete
         * @param actions reversed Action.
         */
        const recursive_delete_traveller_f = (
            ref: ActionChainMap,
            actions: string[],
        ) => {
            if (actions.length === 1) {
                // stop  travel.
                const action = actions.pop();
                ref.delete(action!);
                return;
            }

            const action = actions.pop();
            const action_ref = ref.get(action!);
            if (
                typeof action_ref !== 'undefined' &&
                typeof action_ref !== 'string'
            ) {
                recursive_delete_traveller_f(action_ref, actions);
            }
            ref.delete(action!);

            // fucking easy.
        };

        if (typeof target_action !== 'undefined') {
            // check undefined KeyActionListenable.

            let actionKey = [];
            if (!Array.isArray(target_action!.actionKey)) {
                actionKey = [target_action!.actionKey];
            } else {
                actionKey = target_action!.actionKey;
            }

            {
                let valid_check = true;

                for (const v of actionKey) {
                    if (v === '') {
                        // if current is Empty
                        valid_check = false;
                    }
                    if (!valid_check) {
                        return; // early stop. cache not exists for empty string ''
                    }
                }
            }

            const target_action_list = actionKey.map((val) => {
                const norm_actions: string[] = normalize_action_string(val);
                const action_key = create_action_key_from_string_array(
                    ...norm_actions,
                );
                return action_key;
            });

            if (this.m_action_map.actionMap.has(target_action!.targetView)) {
                // check mapped target view exist.
                const targetview_action_map = this.m_action_map.actionMap.get(
                    target_action!.targetView,
                );
                let cur_ref = targetview_action_map;
                recursive_delete_traveller_f(
                    cur_ref,
                    Array.from(target_action_list).reverse(),
                );
            }
        }
    }

    public register(o: keyActionListenable, overwrite = true) {
        let actionKey = [];
        if (!Array.isArray(o.actionKey)) {
            actionKey = [o.actionKey];
        } else {
            actionKey = o.actionKey;
        }

        //TODO predefined shortcut need to be skipped.
        if (this.m_action_map.action_hash.has(o.id)) {
            if (overwrite) {
                this.m_action_map.action_hash.set(o.id, o);
            }
        } else {
            this.m_action_map.action_hash.set(o.id, o);
        }

        this.addActionMap(o.id, o.targetView, actionKey, overwrite);
    }

    public unregister(o: keyActionListenable) {}

    public _connectManager(
        event_type: event_type,
        callback: (id: string) => void,
    ) {
        this.m_event_emitter.on(event_type, callback);
    }

    protected addActionMap(
        id: string,
        targetView: string,
        actions: string[],
        overwrite = true,
    ) {
        {
            let valid_check = true;

            for (const v of actions) {
                if (v === '') {
                    // if current is Empty
                    valid_check = false;
                }
                if (!valid_check) {
                    return;
                }
            }
        }
        const actionMap = this.m_action_map.actionMap;

        /**
         *
         * @param target
         * @param action_list Action list must be rebuilt to recursive Hierachy. [ Action_A, Action_B] => [Action_B, Action_A]
         */
        const recursive_action_inject_f = (
            target: ActionChainMap,
            id: string,
            action_list: string[],
            overwrite: boolean = true,
        ) => {
            if (action_list.length === 0) {
                return; // finish here to Stop error. this length value is abnormal.
            }

            if (action_list.length === 1) {
                // end point. I quit this eternal recursive Function.
                const last_action = action_list.pop();
                if (target.has(last_action!)) {
                    if (overwrite) {
                        target.set(last_action!, id);
                    }
                    return; // the end.
                } else {
                    target.set(last_action!, id);
                    return;
                }
            }

            const action = action_list.pop();

            const selected_action = target.get(action!);
            if (typeof selected_action === 'string') {
                // we must get inside deeeeep. make this string wrap as ActionChainMap
                const new_ref: ActionChainMap = new Map();
                target.set(action!, new_ref);
                recursive_action_inject_f(new_ref, id, action_list);
            } else if (typeof selected_action === 'undefined') {
                // undefeind
                const new_ref = new Map();
                target.set(action!, new_ref);
                recursive_action_inject_f(new_ref, id, action_list);
            } else {
                // what about Action Map
                recursive_action_inject_f(target, id, action_list);
            }
        };

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
                flogger.info('action', new_actions, ' was rejected.');
                return;
            }
        }

        var cur_ref = actionMap.get(targetView)!;

        recursive_action_inject_f(
            cur_ref,
            id,
            Array.from(new_actions).reverse(),
            overwrite,
        );
    }

    public getIgnoredKeySequence() {
        return shortcut_ignoreset;
    }
}

/// FUCKING BIG EXAMPLES
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
