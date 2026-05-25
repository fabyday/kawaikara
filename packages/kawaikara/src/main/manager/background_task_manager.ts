import { ipcMain } from 'electron';
import {
    BackgroundState,
    KawaiBackgrounRunnable,
    KawaiPrgoress,
} from '../definitions/bg_task';
import { KAWAI_API_LITERAL } from '../definitions/api';
import { KawaiViewManager } from './view_manager';
import { global_object } from '../data/context';
import { flog, log } from '../logging/logger';
import { project_root } from '../component/constants';
import { promises as fs } from 'fs';

import path from 'path';

/**
 * Background Task message
 *
 *
 *
 *
 * prefix : "bg"
 * separator : ":"
 *
 * example : bg:some:thing.
 *
 * //searching tasks
 * @see KawaiBgTaskManager._getTasks
 * bg:tasks := listing all task.
 * bg:tasks:{id} get task which has specific idenitifer.
 * bg:tasks:{category} := listing all task belong to category.
 *
 * bg:tasks:created
 * bg:tasks:completed
c *
 * task manipulation
 *
 * bg:delete:{id} := delete task
 * bg:pause:{id} := pause task
 * bg:resume:{id} := resume task
 *
 *
 *
 *
 * RECV callback data on Renderer Process
 * bg:progress := recv all progress data.
 * bg:progress:{id} : recv specific progress data
 * bg:progress:{category} recv specific category progress data.
 *
 * Recv stdout or stdErr and Task End(Close) Msg.
 *
 * bg:stdout :=
 * bg:stdout:{id} :=
 * bg:stderr
 * bg:stderr:{id}
 * bg:close
 * bg:close:{id} := specific id
 */

export type BgTaskMeta = {
    id: string;
    name: string;
    content: string;
};

export type KawaiBgMsgType = 'tasks' | 'pause' | 'resume' | 'delete';

export type KawaiMsgStatus = 'failed' | 'succeed';
export type KawaiBgTaskScheduleMode = 'sequential' | 'parallel';

export type KawaiBgMsgResult = {
    status: KawaiMsgStatus;
    flag: boolean;
    comment: string;
    result?: BgTaskMeta[];
};

/**
 * default mode is sequential
 */
export class KawaiBgTaskManager {
    private static __instance: KawaiBgTaskManager | undefined;
    private static __id: number = 0;
    private m_mode: KawaiBgTaskScheduleMode;
    private task_map: Map<string, KawaiBackgrounRunnable>;
    private constructor() {
        this.task_map = new Map<string, KawaiBackgrounRunnable>();
        this.m_mode = 'sequential';
    }

    public async setMode(mode: KawaiBgTaskScheduleMode): Promise<void> {
        this.m_mode = mode;
        this._changeOngoingTaskMode();
    }

    /**
     * Stop all tasks except the first ongoing task.
     */
    protected async _changeOngoingTaskMode(): Promise<void> {}

    
    protected async _findAndResumeIncompleteTasks(): Promise<void> {
        // const downloadDir = path.resolve(project_root, 'download');
        // try {
        //     const extracted: string[] = [];
        //     const files = await fs.readdir(downloadDir);
        //     files.forEach((filename: string) => {
        //         if (!filename.endsWith('.part')) return;
        //         const match = filename.match(/\[([^\[\]]+)\]/);
        //         if (match) {
        //             extracted.push(match[1]);
        //         }
        //     });
        // } catch (err) {}
        // if (!filename.endsWith('.part')) {
        //     return null;
        // }
        // const match = filename.match(/\[([^\[\]]+)\]/);
        // return match ? match[1] : null;
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
        this.setMode('sequential');
        await this._findAndResumeIncompleteTasks();
    }

    public async _initialize_message() {
        ipcMain.handle(
            KAWAI_API_LITERAL.custom.custom_callback,
            async (e: Electron.IpcMainInvokeEvent, ...args: any[]) => {
                const [message_type, ...remain_args] = args;

                if ((message_type as string).startsWith('bg:')) {
                    //if background type
                    const command = (message_type as string).slice(
                        'bg:'.length,
                    );
                    return await this._meesage_logic(
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
        switch (msg_type) {
            case 'tasks':
                return await this._getTasks(id);
            case 'pause':
                return await this._pauseTask(id);
            case 'delete':
                return await this._deleteTask(id);
            case 'resume':
                return await this._resumeTask(id);
        }

        return {
            status: 'failed',
            comment: `${msg_type} is not message Type`,
            flag: false,
        };
    }

    protected async _resumeTask(
        id_o_category?: string,
    ): Promise<KawaiBgMsgResult> {
        if (typeof id_o_category === 'undefined') {
            return {
                status: 'succeed',
                comment: `bg task is resumed.`,
                flag: true,
            };
        }

        const task = this.task_map.get(id_o_category);
        const result = (await task?.run()) ?? false;

        return {
            status: result ? 'succeed' : 'failed',
            comment: 'resume task',
            flag: result,
        };
    }
    protected async _deleteTask(
        id_o_category?: string,
    ): Promise<KawaiBgMsgResult> {
        if (typeof id_o_category === 'undefined') {
            return {
                status: 'succeed',
                comment: 'task is restarted.',
                flag: false,
            };
        }
        const task = this.task_map.get(id_o_category);
        if (typeof task === 'undefined') {
            return {
                status: 'failed',
                comment: "specified task wasn't exists.",
                flag: false,
            };
        }

        const status = await task.finalize();

        if (status) {
            this.task_map.delete(id_o_category);
        }

        return {
            status: status ? 'succeed' : 'failed',
            comment: 'task is restarted.',
            flag: status,
        };
    }

    protected async _pauseTask(
        id_o_category?: string,
    ): Promise<KawaiBgMsgResult> {
        if (typeof id_o_category === 'undefined') {
            Array.from(this.task_map.entries()).map(([id, task]) => {
                task.pause();
            });
            return {
                status: 'succeed',
                comment: 'All task is paused.',
                flag: true,
            };
        }
        const task = this.task_map.get(id_o_category);
        if (typeof task === 'undefined') {
            return {
                status: 'failed',
                comment: "Task isn'\t exists",
                flag: false,
            };
        }
        const status = await task.pause();

        return {
            status: status ? 'succeed' : 'failed',
            comment: `${id_o_category} task is paused.`,
            flag: status,
        };
    }

    protected async _getTasks(
        id_o_category?: string,
    ): Promise<KawaiBgMsgResult> {
        log.info('action : bg:tasks');
        if (typeof id_o_category === 'undefined') {
            const list: BgTaskMeta[] = [];
            Array.from(this.task_map.entries()).map(async ([id, task]) => {
                list.push({ id: id, ...(await task.meta()) });
            });

            return {
                status: 'succeed',
                comment: 'get All tasks.',
                flag: true,
                result: list,
            };
        }

        if (this.task_map.has(id_o_category)) {
            return {
                status: 'succeed',
                comment: `get ${id_o_category} meta.`,
                flag: true,
                result: [
                    {
                        id: id_o_category,
                        ...(await this.task_map.get(id_o_category)!.meta()),
                    },
                ],
            };
        }

        return {
            status: 'succeed',
            comment: `${id_o_category} Not exists in tasks.`,
            flag: false,
            result: [],
        };

        //TODO
        // category
    }

    protected _createId(): string {
        const id = ++KawaiBgTaskManager.__id;
        return id.toString();
    }

    protected static async _progressMessageLogic(
        id: string,
        data: KawaiPrgoress,
    ) {
        data.id = id;
        global_object.taskWindow?.webContents.send(
            KAWAI_API_LITERAL.custom.custom_callback,
            `bg:progress`,
            data,
        );
        global_object.taskWindow?.webContents.send(
            KAWAI_API_LITERAL.custom.custom_callback,
            `bg:progress:${id}`,
            data,
        );
        // log.info(data);
    }

    protected static async _stdoutLogic(id: string, msg: string) {
        global_object.taskWindow?.webContents.send(
            KAWAI_API_LITERAL.custom.custom_callback,
            `bg:stdout`,
            msg,
        );
        global_object.taskWindow?.webContents.send(
            KAWAI_API_LITERAL.custom.custom_callback,
            `bg:stdout:${id}`,
            msg,
        );
    }
    protected static async _stderrLogic(id: string, msg: string) {
        global_object.taskWindow?.webContents.send(
            KAWAI_API_LITERAL.custom.custom_callback,
            `bg:stderr`,
            msg,
        );
        global_object.taskWindow?.webContents.send(
            KAWAI_API_LITERAL.custom.custom_callback,
            `bg:stderr:${id}`,
            msg,
        );
    }
    protected async _closeLogic(id: string, msg: string) {
        this.task_map.delete(id);
        global_object.taskWindow?.webContents.send(
            KAWAI_API_LITERAL.custom.custom_callback,
            `bg:close`,
            msg,
        );
        global_object.taskWindow?.webContents.send(
            KAWAI_API_LITERAL.custom.custom_callback,
            `bg:close:${id}`,
            msg,
        );
        global_object.taskWindow?.webContents.send(
            KAWAI_API_LITERAL.custom.custom_callback,
            `bg:tasks:completed`,
            id,
        );
    }

    async registerBgTask(bg_task: KawaiBackgrounRunnable) {
        const id = this._createId().toString();
        this.task_map.set(id, bg_task);

        await bg_task.progressCallback(
            KawaiBgTaskManager._progressMessageLogic.bind(null, id.toString()),
        );
        await bg_task.attachStdoutCallback(
            KawaiBgTaskManager._stdoutLogic.bind(null, id.toString()),
        );
        await bg_task.attachStderrCallback(
            KawaiBgTaskManager._stderrLogic.bind(null, id.toString()),
        );
        await bg_task.attachCloseCallback(
            this._closeLogic.bind(this, id.toString()),
        );
        await bg_task.run(); // await meta data loading...
        global_object.taskWindow?.webContents.send(
            KAWAI_API_LITERAL.custom.custom_callback,
            `bg:tasks:created`,
            id,
        );
    }
}
