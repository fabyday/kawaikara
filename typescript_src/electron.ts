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
    // console.log('test0');
    // const browser = await chromium.launchPersistentContext('./useData', {
    //     headless: false,
    //     channel: 'chrome',
    //     viewport: null,
    // });
    // console.log('test1');

    // const page = browser.pages()[0] || (await browser.newPage());
    // console.log('test3');

    // await page.goto('https://www.coupangplay.com', {});
    // try {
    //     // 3. /home이 포함된 URL로 바뀔 때까지 최대 5초 대기
    //     await page.waitForURL(/\/(home|profile)/, { timeout: 5000 });
    //     console.log('login succ');
    // } catch (error) {
    //     console.log('loging err');
    //     // 현재 URL 확인해보기
    //     console.log('현재 위치:', page.url());
    // }

    // // await page.setViewportSize({ width: 1080, height: 1024 });
    // await page.once('close', async () => {
    //     console.log('test');
    //     const cookies = await page.context().cookies();

    //     console.log('test32');
    //     // test(cookies);
    //     await importCookiesToElectron(cookies);
    //     const view = new BrowserWindow({
    //         webPreferences: {},
    //     });
    //     console.log('test323');
    //     view.loadURL('https://www.coupangplay.com', {
    //         userAgent:
    //             'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    //     });
    //     console.log('test32322');
    // });

    log.info('components ready:', components.status());
    log.debug('initialize kawaikara components...');
    await initialize();
    log.info('app was initialized...');
});
