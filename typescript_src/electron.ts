import {
    app,
    desktopCapturer,
    BrowserWindow,
    dialog,
    screen,
    session,
    components,
    nativeTheme,
    Session,
    globalShortcut,
} from 'electron';
import {
    ipcMain,
    ipcRenderer,
    Menu,
    MenuItem,
    BrowserView,
    webContents,
} from 'electron';

import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';

import * as autoUpdater from './component/autoupdater';
import lodash from 'lodash';
import { script_root_path } from './component/constants';
import * as fs_p from 'node:fs/promises';
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
