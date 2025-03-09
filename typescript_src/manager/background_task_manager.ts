import { ipcMain } from 'electron';
import { BackgroundStates, KawaiBackgrounRunnable } from '../definitions/bg_task';
import { KAWAI_API_LITERAL } from '../definitions/api';

type KawaiBgMsgType = 'pause' | 'resume' | 'delete';

type KawaiMsgStatus = 'failed' | 'succeed';
type KawaiBgMsgResult = {
    status: KawaiMsgStatus;
    flag: boolean;
    comment: string;
};

export class KawaiBgTaskManager {
    private static __instance: KawaiBgTaskManager | undefined;
    private static __id: number = 0;
    private task_map: Map<string, KawaiBackgrounRunnable>;
    private constructor() {
        this.task_map = new Map<string, KawaiBackgrounRunnable>();
    }

    public static getInstance() {
        if (typeof KawaiBgTaskManager.__instance === 'undefined') {
            KawaiBgTaskManager.__instance = new KawaiBgTaskManager();
        }
        return KawaiBgTaskManager.__instance;
    }

    public async initialize() {
        KawaiBgTaskManager.__id = 0;
        this.task_map = new Map<string, KawaiBackgrounRunnable>();
        await this._initialize_message();
    }

    public async _initialize_message() {
        ipcMain.handle(
            KAWAI_API_LITERAL.custom.custom_callback,
            async (e: Electron.IpcMainInvokeEvent, ...args: any[]) => {
                const [message_type, ...remain_args] = args;

                if ((message_type as string).startsWith('bg:')) {
                    //if background type
                    const command = (message_type as string).slice(
                        'bg:'.length + 1,
                    );
                    return this._meesage_logic(
                        command as KawaiBgMsgType,
                        ...remain_args,
                    );
                }
            },
        );
    }

    protected async _meesage_logic(
        msg_type: KawaiBgMsgType,
        ...args: any[]
    ): Promise<KawaiBgMsgResult> {
        const [a, ...n] = args;
        const id = a as string;
        const task = this.task_map.get(id);
        if (typeof task !== 'undefined') {
            switch (msg_type) {
                case 'pause':
                    return {
                        status: 'succeed',
                        comment: `bg task paused`,
                        flag: await task.pause(),
                    };
                case 'delete':
                    return {
                        status: 'succeed',
                        comment: `bg task paused`,
                        flag: await task.finalize(),
                    };
                case 'resume':
                    return {
                        status: 'succeed',
                        comment: `bg task paused`,
                        flag: await task.run(),
                    };
            }
        }

        return {
            status: 'succeed',
            comment: `bg task paused`,
            flag: false,
        };
    }

    protected create_id(): number {
        return ++KawaiBgTaskManager.__id;
    }

    registerBgTask(bg_task: KawaiBackgrounRunnable) {
        const id = this.create_id();
        this.task_map.set(id.toString(), bg_task);
    }
}
