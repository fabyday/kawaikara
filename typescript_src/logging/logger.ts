import fs from 'node:fs';
import logger from 'electron-log/main';
import path from 'node:path';
import { project_root } from '../component/constants';

logger.initialize();

export const flog = logger.create({ logId: 'filelogger' });
flog.transports.file.level = 'debug';
flog.transports.file.fileName = 'file-only.log';
flog.transports.console.level = false;
flog.transports.file.resolvePathFn = () => {
    return path.join(log_root, flog.transports.file.fileName);
};
console.log("root ; ",  path.resolve(project_root, 'logs'))
const log_root = path.resolve(project_root, 'logs');
if (!fs.existsSync(log_root)) {
    fs.mkdirSync(log_root, {recursive:true});
    console.log("make dir")
}

export const log = logger;


