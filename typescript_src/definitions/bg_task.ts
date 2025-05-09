import {
    ChildProcessWithoutNullStreams,
    exec,
    spawn,
} from 'node:child_process';
import {
    data_root_path,
    project_root,
    third_party_bin_path,
} from '../component/constants';
import path, { format } from 'node:path';
import { log } from '../logging/logger';
import { promisify } from 'node:util';
import psTree from 'ps-tree';
import fsprom from 'fs/promises';
import { getValidCookieFile } from '../logics/cookies';
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

const killChildrenRecursivelyPromise = (pid: number) => {
    return new Promise((resolve, reject) => {
        psTree(pid, (err, children) => {
            if (err) {
                reject(err);
                log.info('FAILED.... ', err);
            }

            children.forEach((child) => {
                try {
                    process.kill(Number(child.PID), 'SIGINT');
                    log.info(`success to terminate child process ${child.PID}`);
                } catch (err) {
                    log.info(
                        `failed to terminate child process ${child.PID}`,
                        err,
                    );
                }
            });

            resolve(true);
        });
    });
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

type KawaiYoutubeBgTaskArgs = {
    format?: string; // -f option
    merge_output_format?: string; // --merge-output-format option
    save_directory?: string; // -P option
    cookie_path?: string; // --cookies option
};

/**
 * lazy initialize
 * 
 * 
 * NOTICE
 * https://github.com/yt-dlp/yt-dlp/issues/8227
 * I first tried to export cookies and use --cookies "%~dp0\cookies.txt" to specify cookies, but after a few minutes, 
 * it became invalid. When I downloaded member-only videos, it prompted me to need a higher level. permission.


 */
export class KawaiYoutuebeBgChild implements KawaiBackgrounRunnable {
    private m_obj: ChildProcessWithoutNullStreams | null;
    private m_prog: string;
    private m_url: string;
    private m_args: KawaiYoutubeBgTaskArgs;
    private m_state: BackgroundState;

    private m_donwload_regex: RegExp;

    private m_filenamePattern: RegExp;
    private m_output_filename = '';

    private m_pregress_callbacks: any[] = [];
    private m_stdout_callbacks: any[] = [];
    private m_stderr_callbacks: any[] = [];
    private m_close_callbacks: any[] = [];

    constructor(url: string, args?: KawaiYoutubeBgTaskArgs) {
        this.m_state = 'ready';
        this.m_obj = null;
        this.m_prog = path.join(third_party_bin_path, 'yt-dlp');
        this.m_args = args ?? {};
        this.m_url = url;
        this.m_donwload_regex =
            /\[download\]\s+([\d.]+)%\s+of\s+([\d.]+[KMGT]?iB)\s+at\s+([\d.]+[KMGT]?iB\/s)?\s+ETA\s+(\d+:\d+)/;
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
        await killChildrenRecursivelyPromise(this.m_obj.pid!);
        this.m_obj = null;
        this.m_state = 'paused';
        return true;
    }

    _parseStdoutString(str: string) {}

    protected async _inflateArgs(): Promise<string[]> {
        const args = [];
        if (typeof this.m_args.format !== 'undefined') {
            args.push('-f', this.m_args.format);
        }
        if (typeof this.m_args.merge_output_format !== 'undefined') {
            args.push('--merge-output-format', this.m_args.merge_output_format);
        }
        if (typeof this.m_args.save_directory !== 'undefined') {
            args.push('-P', this.m_args.save_directory);
        }
        if (typeof this.m_args.cookie_path !== 'undefined') {
            await getValidCookieFile(
                '.youtube.com',
                this.m_args.cookie_path,
                'https://www.youtube.com/getAccountInfo',
            );
            args.push('--cookies', this.m_args.cookie_path);
        }

        const ffmpeg_pth = path.resolve(
            third_party_bin_path,
            process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
        );
        args.push('--ffmpeg-location', ffmpeg_pth);

    

        return args;
    }

    protected async _check_yt_dlp_updated() {
        const target_file = path.join(data_root_path, 'yt_dlp_updated.txt');
        const today = new Date();
        const formatted_today_string = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const execProm = promisify(exec);
        const isYtDlpUpdated = (stdout: string): boolean => {
            return (
                stdout.includes('Updating to') &&
                stdout.includes('Updated yt-dlp to')
            );
        };
        const parseYtDlpUpdate = (
            stdout: string,
        ): { from: string; to: string } | null => {
            const currentVersionMatch = stdout.match(
                /Current version: (stable@\d{4}\.\d{2}\.\d{2})/,
            );
            const newVersionMatch = stdout.match(
                /Updating to (stable@\d{4}\.\d{2}\.\d{2})/,
            );

            if (currentVersionMatch && newVersionMatch) {
                return {
                    from: currentVersionMatch[1], // 업데이트 전 버전
                    to: newVersionMatch[1], // 업데이트 후 버전
                };
            }

            return null; // 업데이트되지 않았거나 정보 부족
        };

        const parseYtDlpVersion = (stdout: string): string | null => {
            const match = stdout.match(
                /yt-dlp is up to date \(?(stable@\d{4}\.\d{2}\.\d{2}) from yt-dlp\/yt-dlp\)?/,
            );
            return match ? match[1] : null;
        };

        try {
            fsprom.access(target_file);
            const content = await fsprom.readFile(target_file, 'utf8');
            // if (content < formatted_today_string) {
            const { stdout } = await execProm(`${this.m_prog} -U`);
            if (isYtDlpUpdated(stdout)) {
                const updated = parseYtDlpUpdate(stdout);
                log.info(`upadated from ${updated?.from} to ${updated?.to}`);
            } else {
                // if stable
                const version = parseYtDlpVersion(stdout);
                log.info(`ytdlp is up to date, version : ${version}`);
            }
            fsprom.writeFile(target_file, formatted_today_string);
            // }
        } catch (err) {
            log.info('file not exists.');
            fsprom.writeFile(target_file, formatted_today_string);
            const { stdout } = await execProm(`${this.m_prog} -U`);
            log.info('check updated...');
            if (isYtDlpUpdated(stdout)) {
                const updated = parseYtDlpUpdate(stdout);
                log.info(`upadated from ${updated?.from} to ${updated?.to}`);
            } else {
                // if stable
                const version = parseYtDlpVersion(stdout);
                log.info(`ytdlp is up to date, version : ${version}`);
            }
        }
    }

    protected _attachCallback() {
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
                // console.log(`${datastring}`);
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

                    // console.log(value);

                    this.m_pregress_callbacks.forEach((callback) => {
                        callback(value);
                    });
                }
            }).bind(this),
        );
        this.m_obj.on('close', (code: any) => {
            log.info(`[yt-dlp] process was terminated. (code: ${code})`);
            if (this.m_state === 'paused') {
                return; // if paused do nothing.
            }
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
        await this._check_yt_dlp_updated();
        if (this.m_state === 'ready') {
            const get_title_command_args = '--get-title --encoding utf-8';
            log.info(
                `test code : ${this.m_prog} ${get_title_command_args} ${
                    this.m_args.cookie_path
                        ? `--cookies "${this.m_args.cookie_path}"`
                        : ''
                } ${this.m_url}`,
            );
            try {
                const { stdout } = await execProm(
                    `${this.m_prog} ${get_title_command_args} ${
                        this.m_args.cookie_path
                            ? `--cookies "${this.m_args.cookie_path}"`
                            : ''
                    } ${this.m_url}`,
                );

                this.m_output_filename = stdout.trim();
                log.info(`file name : ${this.m_output_filename}`);
            } catch (error) {
                throw new Error(`Error fetching title ${error}`);
            }
        }

        if (
            this.m_state === 'paused' ||
            this.m_state === 'ready' ||
            this.m_obj == null
        ) {
            log.info(`status : ${this.m_state} => running`);

            log.info(this.m_prog);
            log.info(
                `inflate : ${[...(await this._inflateArgs())]},url ${this.m_url}`,
            );
            this.m_obj = spawn(
                this.m_prog,
                [...(await this._inflateArgs()), this.m_url],
                {
                    stdio: ['pipe', 'pipe', 'pipe'],
                },
            );
            this.m_state = 'running';
            this._attachCallback();
        } else {
            return false;
        }

        return true;
    }
    async finalize() {
        if (this.m_state === 'paused') {
            this.m_close_callbacks.forEach((callback) => {
                callback(0);
            });
            return true;
        }

        if (this.m_obj != null) {
            this.m_obj.on('exit', async (code, signal) => {
                log.info(
                    `Process Terminated: Exit Code ${code}, Terminate Signal ${signal}`,
                );

                // delete temoprary files.
                const yotube_regex =
                    /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/|live\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;

                const url = this.m_url.match(yotube_regex);

                if (url != null) {
                    const youtube_link = url[1];

                    const searching_pattern = new RegExp(
                        `^.*${youtube_link}.*\\.[a-zA-Z0-9]+$`,
                    );
                    const files = await fsprom.readdir(
                        path.resolve(project_root, 'download'),
                    );
                    log.info(files);
                    const matched_file = files.filter((file) =>
                        searching_pattern.test(file),
                    );
                    matched_file.forEach(async (pth) => {
                        try {
                            await fsprom.unlink(
                                path.resolve(
                                    path.join(project_root, 'download'),
                                    pth,
                                ),
                            );
                            log.info(
                                `deleted file ${path.resolve(path.join(project_root, 'download'), pth)}`,
                            );
                        } catch (err) {
                            log.info(
                                `Failed to delete file ${path.resolve(path.join(project_root, 'download'), pth)}\n ${err}`,
                            );
                        }
                    });
                }
            });
            // kill childprocess recursively.
            await killChildrenRecursivelyPromise(this.m_obj.pid!);

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
