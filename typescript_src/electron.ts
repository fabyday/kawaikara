import { app, components } from 'electron';

// import {DiscordSDK} from "@discord/embedded-app-sdk";

import { initialize } from './logics/app_logic';
import { log } from './logging/logger';

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    log.info('electron-castlab : component initialize...');
    await components.whenReady();
    log.info('components ready:', components.status());
    log.debug('initialize kawaikara components...');
    await initialize();
    log.info('app was initialized...');
});
