import { app } from 'electron';
import {
    ChildProcessByStdio,
    ChildProcessWithoutNullStreams,
    exec,
    spawn,
} from 'node:child_process';
import internal from 'node:stream';
import { third_party_bin_path } from '../component/constants';
import path from 'node:path';
import { log } from '../logging/logger';
import { promisify } from 'node:util';

export type BackgroundState =
    | 'idle' // 아직 시작되지 않음
    | 'ready' // 시작 가능 상태
    | 'running' // 실행 중
    | 'paused' // 일시 정지됨
    | 'error' // 오류 발생
    | 'finished'; // 완료됨

export type BackgroundEvent =
    | 'start' // 실행 시작
    | 'pause' // 실행 중단
    | 'resume' // 다시 실행
    | 'stop' // 실행 종료
    | 'fail' // 오류 발생
    | 'complete'; // 정상 종료

export type BgTaskMeta = {
    name: string;
    content: string;
};

export interface KawaiBackgrounRunnable {
    meta: () => Promise<BgTaskMeta>;
    getState: () => Promise<BackgroundState>;
    pause: () => Promise<boolean>;
    run: () => Promise<boolean>;
    finalize: () => Promise<boolean>;

    progressCallback: (callback: any) => Promise<boolean>;
    attachStdoutCallback: (callback: any) => Promise<boolean>;
    attachStderrCallback: (callback: any) => Promise<boolean>;
    attachCloseCallback: (callback: any) => Promise<boolean>;
}

export type KawaiPrgoress = {
    id: string;
    filename: string;
    value: {
        progress: number; // progress percentage (%)
        total_size: number; // total size (MiB)
        speed: number; // speed (MiB/s)
        eta_minutes: number; // min
        eta_seconds: number; //sec
    };
    state: BackgroundState;
};

export class KawaiAbstractBgTask implements KawaiBackgrounRunnable {
    private m_state: BackgroundState = 'idle';

    constructor() {}

    async getState(): Promise<BackgroundState> {
        return this.m_state;
    }

    async pause(): Promise<boolean> {
        return true;
    }

    async run(): Promise<boolean> {
        return true;
    }
    async finalize(): Promise<boolean> {
        return true;
    }

    async progressCallback(callback: any) {
        return true;
    }

    async meta(): Promise<BgTaskMeta> {
        return {
            name: '',
            content: '',
        };
    }

    async attachStdoutCallback(callback: any): Promise<boolean> {
        return true;
    }
    async attachStderrCallback(callback: any): Promise<boolean> {
        return true;
    }
    async attachCloseCallback(callback: any): Promise<boolean> {
        return true;
    }
}

/**
 * lazy initialize
 */
export class KawaiYoutuebeBgChild implements KawaiBackgrounRunnable {
    private m_obj: ChildProcessWithoutNullStreams | null;
    private m_prog: string;
    private m_url: string;
    private m_args: string[];
    private m_state: BackgroundState;

    private m_donwload_regex: RegExp;

    private m_filenamePattern: RegExp;
    private m_output_filename = '';

    private m_pregress_callbacks: any[] = [];
    private m_stdout_callbacks: any[] = [];
    private m_stderr_callbacks: any[] = [];
    private m_close_callbacks: any[] = [];

    constructor(url: string, args: string[]) {
        this.m_state = 'ready';
        this.m_obj = null;
        this.m_prog = path.join(third_party_bin_path, 'yt-dlp');
        this.m_args = args;
        this.m_url = url;
        this.m_donwload_regex =
            /(\d+\.\d+)% of\s+([\d.]+)MiB at\s+([\d.]+)MiB\/s ETA (\d+):(\d+)/;

        this.m_filenamePattern = /Destination:\s(.+)/;
    }

    async meta(): Promise<BgTaskMeta> {
        return {
            name: this.m_output_filename,
            content: '',
        };
    }

    async getState(): Promise<BackgroundState> {
        return this.m_state;
    }

    /**
     *
     * @param pipe_args this is for Windows. Win platform doesn't support suspend program.
     * @returns
     */
    async pause() {
        if (this.m_obj == null) {
            return false; // do nothing .
        }

        switch (process.platform) {
            case 'win32':
                this.m_obj.stdin.write('p');
                break;
            case 'linux':
            case 'darwin':
            default:
                this.m_obj.kill('SIGSTOP');
        }
        this.m_state = 'paused';
        return true;
    }

    _parseStdoutString(str: string) {}

    _attachCallback() {
        if (this.m_obj == null) {
            return;
        }

        this.m_obj.stdout.on(
            'data',
            ((data: any) => {
                const datastring: string = data.toString().trim();
                this.m_stdout_callbacks.forEach((callback) => {
                    callback(data);
                });

                // const filematch = datastring.match(this.m_filenamePattern);
                // if (filematch != null) {
                //     this.m_output_filename = filematch[1];
                // }

                const match = datastring.match(this.m_donwload_regex);
                if (match != null) {
                    const progress = parseFloat(match[1]); // progress percentage (%)
                    const totalSize = parseFloat(match[2]); // total size (MiB)
                    const speed = parseFloat(match[3]); // speed (MiB/s)
                    const etaMinutes = parseInt(match[4], 10); // min
                    const etaSeconds = parseInt(match[5], 10); //sec
                    const value: KawaiPrgoress = {
                        id: '',
                        filename: this.m_output_filename,
                        value: {
                            progress: progress,
                            total_size: totalSize,
                            speed: speed,
                            eta_minutes: etaMinutes,
                            eta_seconds: etaSeconds,
                        },
                        state: 'running',
                    };

                    this.m_pregress_callbacks.forEach((callback) => {
                        callback(value);
                    });
                }
            }).bind(this),
        );
        this.m_obj.on('close', (code: any) => {
            log.info(`[yt-dlp] process was terminated. (code: ${code})`);
            this.m_close_callbacks.forEach((callback) => {
                callback(code);
            });
        });
        this.m_obj.stderr.on('data', (data) => {
            log.error(`[yt-dlp ERROR] ${data.toString().trim()}`);
            this.m_stderr_callbacks.forEach((callback) => {
                callback(data.toString().trim());
            });
        });
    }

    async run() {
        const execProm = promisify(exec);
        const get_title_command_args = '--get-title';
        log.info(
            `test code : ${this.m_prog} ${get_title_command_args} ${this.m_url}`,
        );
        try {
            const { stdout } = await execProm(
                `${this.m_prog} ${get_title_command_args} ${this.m_url}`,
                { encoding: 'utf-8' },
            );
            this.m_output_filename = stdout.trim();
            log.info(`file name : ${this.m_output_filename}`);
        } catch (error) {
            throw new Error(`Error fetching title ${error}`);
        }

        if (this.m_state === 'ready' || this.m_obj == null) {
            this.m_obj = spawn(this.m_prog, [...this.m_args, this.m_url], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            this.m_state = 'running';
            this._attachCallback();
        } else if (this.m_state === 'paused') {
            switch (process.platform) {
                case 'win32':
                    return this.m_obj.stdin.write('p');
                    break;
                case 'darwin':
                case 'linux':
                default:
                    return this.m_obj.kill('SIGCONT');
            }
        } else {
            return false;
        }

        return true;
    }
    async finalize() {
        if (this.m_obj != null) {
            this.m_obj?.kill();
            return true;
        }
        return false;
    }

    async progressCallback(callback: any) {
        this.m_pregress_callbacks.push(callback);
        return true;
    }

    async attachStdoutCallback(callback: any) {
        this.m_stdout_callbacks.push(callback);

        return true;
    }

    async attachStderrCallback(callback: any) {
        this.m_stderr_callbacks.push(callback);
        return false;
    }

    async attachCloseCallback(callback: any) {
        this.m_close_callbacks.push(callback);
        return true;
    }
}
