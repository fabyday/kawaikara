import { app, components, session, BrowserWindow } from 'electron';

import { initialize } from './logics/app_logic';
import { get_flogger, log } from './logging/logger';
const flog = get_flogger('AppLogger', 'App', 'debug');

if (process.env.IS_DEV) {
    flog.debug('app debug mode...');
    app.commandLine.appendSwitch('remote-debugging-port', '9223');
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    log.info('electron-castlab : component initialize...');
    await components.whenReady();
    log.info('components ready:', components.status());
    log.debug('initialize kawaikara components...');
    await initialize();
    log.info('app was initialized...');
});
