import { create } from 'zustand';

import produce from 'immer';
import lodash from 'lodash';
import { KawaiLocale } from '../../typescript_src/definitions/setting_types';
import {
    BackgroundState,
    KawaiPrgoress,
} from '../../typescript_src/definitions/bg_task';

import { KawaiBgMsgResult } from '../../typescript_src/manager/background_task_manager';

type Id = string;
export type bgStates = 'paused' | 'download' | 'deleted' | 'error' | 'finished';

export type KawaiProgressValue = {
    progress: number;
    total_size: number;
    speed: number;
    eta_minutes: number;
    eta_seconds: number;
};

export type KawaiBgTaskComponent = {
    id: string;
    filename: string;
    value: KawaiProgressValue;
    states: BackgroundState;
};

type BgTaskStates = {
    bgtask_map: Map<Id, KawaiBgTaskComponent>;
    pause: (id: Id) => Promise<boolean>;
    resume: (id: Id) => Promise<boolean>;
    delete: (id: Id) => Promise<boolean>;
    created: (component: KawaiBgTaskComponent) => Promise<boolean>;
    completed: (component: KawaiBgTaskComponent) => Promise<boolean>;
    update: (value: KawaiPrgoress) => Promise<boolean>;
    fetch: () => Promise<void>;
};

type get_type = () => BgTaskStates;
type set_type = (
    partial:
        | BgTaskStates
        | Partial<BgTaskStates>
        | ((state: BgTaskStates) => BgTaskStates),
    replace?: boolean | undefined,
) => void;

export const bgTasks = create<BgTaskStates>((set: set_type, get: get_type) => ({
    bgtask_map: new Map<Id, KawaiBgTaskComponent>(),

    created: async (component: KawaiBgTaskComponent) => {
        set((state: BgTaskStates) => {
            const new_map = new Map<Id, KawaiBgTaskComponent>(state.bgtask_map);
            new_map.set(component.id, component);
            console.log(new_map);
            return {
                ...state,
                bgtask_map: new_map,
            };
        });
        return true;
    },

    completed: async (component: KawaiBgTaskComponent) => {
        set((state: BgTaskStates) => {
            const newMap = state.bgtask_map;
            console.log(Array.from(newMap.keys()))
            console.log(["1", "2"])
            console.log('deleted fin', newMap);
            console.log('delted?  :', newMap.delete(component.id));
            console.log('deleted fin', newMap);
            console.log('completed : ', newMap);
            return { ...state, bgtask_map: new Map(newMap) };
        });
        return true;
    },

    update: async (prog: KawaiPrgoress) => {
        set((state: BgTaskStates) => {
            const new_map = new Map(state.bgtask_map);
            if (typeof get().bgtask_map.get(prog.id) !== 'undefined') {
                const task = new_map.get(prog.id);
                task!.filename = prog.filename;
                task!.value = prog.value;
                task!.states = prog.state;
            }
            return { ...state, bgtask_map: new_map };
        });
        return false;
    },

    pause: async (id: Id) => {
        const result: KawaiBgMsgResult =
            await window.KAWAI_API.custom.custom_invoke('bg:pause', id);
        if (result.status === 'succeed') {
            const new_map = new Map(get().bgtask_map);
            const task = new_map.get(id);
            task!.states = 'paused';
            set((state: BgTaskStates) => {
                return { ...state, bgtask_map: new_map };
            });
            return result.flag;
        } else {
            console.log(result.comment);
        }
        return false;
    },
    resume: async (id: Id) => {
        const result: KawaiBgMsgResult =
            await window.KAWAI_API.custom.custom_invoke('bg:resume', id);
        if (result.status === 'succeed') {
            const new_map = new Map(get().bgtask_map);
            const task = new_map.get(id);
            task!.states = 'running';
            set((state: BgTaskStates) => {
                return { ...state, bgtask_map: new_map };
            });
            return result.flag;
        } else {
            console.log(result.comment);
        }
        return false;
    },
    delete: async (id: Id) => {
        const result: KawaiBgMsgResult =
            (await window.KAWAI_API.custom.custom_invoke(
                'bg:delete',
                id,
            )) as KawaiBgMsgResult;

        if (result.status === 'succeed') {
            set((state: BgTaskStates) => {
                const newMap = new Map(get().bgtask_map);
                newMap.delete(id);
                return { ...state, bgtask_map: newMap };
            });
            return true;
        } else {
            console.log(result.comment);
        }

        return false;
    },
    fetch: async () => {
        // task is [...
        // {id: string;
        // filename: string;
        // value: number;
        // states: bgStates;}]
        const task_list =
            await window.KAWAI_API.custom.custom_invoke('bg:tasks');
        console.log('hahaha', task_list);
        const s = task_list.result as any[];
        // const tasks_ = task_list as KawaiBgTaskComponent[];
        const new_map = new Map<Id, KawaiBgTaskComponent>();
        s.forEach((v) => {
            console.log(typeof v.id, 'Test');
            new_map.set(v.id, {
                filename: v.name,
                id: v.id,
                states: 'running',
                value: {
                    eta_minutes: 0,
                    eta_seconds: 0,
                    progress: 0,
                    speed: 0,
                    total_size: 0,
                },
            });
        });
        // tasks_.forEach((v) => {
        //     new_map.set(v.id, v);
        // });

        set((state: BgTaskStates) => ({
            ...state,
            bgtask_map: new_map,
        }));
    },
}));
