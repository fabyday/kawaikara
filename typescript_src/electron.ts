import { app, components, session, BrowserWindow } from 'electron';

// import {DiscordSDK} from "@discord/embedded-app-sdk";

import { initialize } from './logics/app_logic';
import { get_flogger, log } from './logging/logger';
const flog = get_flogger('AppLogger', 'App', 'debug');

if (process.env.IS_DEV) {
    flog.debug('app debug mode...');
    app.commandLine.appendSwitch('remote-debugging-port', '9223');
}

app.disableHardwareAcceleration();

import { chromium, Cookie } from 'patchright';

async function importCookiesToElectron(cookies: Cookie[]) {
    const ses = session.defaultSession;

    for (const cookie of cookies) {
        let sameSiteValue:
            | 'no_restriction'
            | 'lax'
            | 'strict'
            | 'unspecified'
            | undefined;

        if (cookie.sameSite === 'None') {
            sameSiteValue = 'no_restriction';
        } else if (cookie.sameSite === 'Lax') {
            sameSiteValue = 'lax';
        } else if (cookie.sameSite === 'Strict') {
            sameSiteValue = 'strict';
        } else {
            sameSiteValue = 'unspecified';
        }
        const cookieDetails = {
            url: `https://${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}${cookie.path}`,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expires,
            sameSite: sameSiteValue,
        };

        await session.defaultSession.cookies.set(cookieDetails);
    }
}

app.whenReady().then(async () => {
    log.info('electron-castlab : component initialize...');
    await components.whenReady();
    log.info('components ready:', components.status());
    log.debug('initialize kawaikara components...');
    await initialize();
    log.info('app was initialized...');
});
