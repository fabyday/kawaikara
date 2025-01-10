import fs from 'node:fs';
import logger from 'electron-log/main';
import path from 'node:path';
import { project_root } from '../component/constants';
import { Logger } from 'electron-log';

logger.initialize();

export const flog = logger.create({ logId: 'filelogger' });
flog.transports.file.level = 'debug';
flog.transports.file.fileName = 'file-only.log';
flog.transports.console.level = false;
flog.transports.file.resolvePathFn = () => {
    return path.join(log_root, flog.transports.file.fileName);
};
console.log('root ; ', path.resolve(project_root, 'logs'));
const log_root = path.resolve(project_root, 'logs');
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

export function setup_logger() {}

export type KawaiLogType = {
    loggerName: string; //
};
