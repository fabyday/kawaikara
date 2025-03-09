import { create } from 'zustand';

import produce from 'immer';
import lodash from 'lodash';
import { KawaiLocale } from '../../typescript_src/definitions/setting_types';

type Id = string;
export type bgStates = 'paused' | 'download' | 'deleted' | "error" | "finished";

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
    states: bgStates;
};

type BgTaskStates = {
    bgtask_map: Map<Id, KawaiBgTaskComponent>;
    pause: (id: Id) => Promise<boolean>;
    resume: (id: Id) => Promise<boolean>;
    delete: (id: Id) => Promise<boolean>;
    add: (component: KawaiBgTaskComponent) => Promise<boolean>;
    update: (id: Id, value: number) => Promise<boolean>;
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

    add: async (component: KawaiBgTaskComponent) => {
        return true;
    },
    update: async (id: Id, value: number) => {
        return true;
    },

    pause: async (id: Id) => {
        return await window.KAWAI_API.custom.custom_callback(
            'bg:pause',
            id,
        );
    },
    resume: async (id: Id) => {
        return await window.KAWAI_API.custom.custom_callback(
            'bg:resume',
            id,
        );
    },
    delete: async (id: Id) => {
        const result = await window.KAWAI_API.custom.custom_callback(
            'bg:delete',
            id,
        );
        set((state: BgTaskStates) => {
            const newMap = new Map(get().bgtask_map);
            newMap.delete(id);
            return { ...state, bgtask_map: newMap };
        });
        return result;
    },
    fetch: async () => {
        // task is [...
        // {id: string;
        // filename: string;
        // value: number;
        // states: bgStates;}]
        const task_list =
            await window.KAWAI_API.custom.custom_callback('youtube:bg:tasks');
        const tasks_ = task_list as KawaiBgTaskComponent[];
        console.log(task_list);
        const new_map = new Map<Id, KawaiBgTaskComponent>();
        tasks_.forEach((v) => {
            new_map.set(v.id, v);
        });
        set((state: BgTaskStates) => ({
            ...state,
            bgtask_map: new_map,
        }));
    },
}));
