import fs from 'node:fs';
import logger from 'electron-log/main';
import path from 'node:path';
import { log_root_path, project_root } from '../component/constants';
import { Logger } from 'electron-log';
import os from 'os';
logger.initialize();

export const flog = logger.create({ logId: 'filelogger' });
flog.transports.file.level = 'debug';
flog.transports.file.fileName = 'file-only.log';
flog.transports.console.level = false;
flog.transports.file.resolvePathFn = () => {
    return path.join(log_root, flog.transports.file.fileName);
};

// const log_root = path.resolve(project_root, 'logs');
const log_root = log_root_path;
console.log(`Log File Root :${log_root}`);
if (!fs.existsSync(log_root)) {
    fs.mkdirSync(log_root, { recursive: true });
    console.log('make dir');
}

export const log = logger;

export const LoggerCollection: Map<string, Logger> = new Map<string, Logger>();

export const DefaultConsoleLogId = flog.logId;
export const DefaultFileLogId = logger.logId;

LoggerCollection.set(DefaultConsoleLogId, logger);
LoggerCollection.set(DefaultConsoleLogId, flog);

export function get_logger(logId: string): Logger {
    if (LoggerCollection.has(logId)) {
        return LoggerCollection.get(logId)!;
    } else {
        const newlog = logger.create({ logId: logId });
        LoggerCollection.set(logId, newlog);
        return newlog;
    }
}
export function get_flogger(
    logId: string,
    fileName: string,
    type: 'debug' | 'info',
): Logger {
    if (LoggerCollection.has(logId)) {
        return LoggerCollection.get(logId)!;
    } else {
        const newlog = logger.create({ logId: logId });
        // newlog.transports.file.level = type;
        newlog.transports.file.level = process.env.IS_DEV ? 'debug' : 'info';
        newlog.transports.console.level = false;
        newlog.transports.file.fileName = fileName + '.log';
        newlog.transports.file.resolvePathFn = () => {
            return path.join(log_root, newlog.transports.file.fileName);
        };
        LoggerCollection.set(logId, newlog);
        return newlog;
    }
}

export function setup_logger() {}

export type KawaiLogType = {
    loggerName: string; //
};
