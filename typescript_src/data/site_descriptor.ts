import { connect } from 'http2';
import { KawaiAbstractSiteDescriptor } from '../definitions/SiteDescriptor';
import {
    registerKawaiSiteDescriptor,
    connectToMenu as connectToMenu,
    connectToShortcut,
} from '../logics/register';
import {
    data_root_path,
    download_root_path,
    project_root,
    script_root_path,
    third_party_bin_path,
} from '../component/constants';
import path from 'path';
import { log } from '../logging/logger';
import * as fs from 'fs/promises';
import { ipcMain, net, session, shell } from 'electron';
import { spawn } from 'child_process';
import { KAWAI_API_LITERAL } from '../definitions/api';
import { Domain } from 'domain';
import { getValidCookieFile } from '../logics/cookies';
import { KawaiYoutuebeBgChild } from '../definitions/bg_task';
import { KawaiBgTaskManager } from '../manager/background_task_manager';
import { cvrt_electron_path } from '../logics/path';

@connectToShortcut('goto_netflix')
@connectToMenu('menu_netflix')
@registerKawaiSiteDescriptor
export class KawaiNetflixDesc extends KawaiAbstractSiteDescriptor {
    id: string = 'netflix';
    category: string | undefined = 'ott';
    shortcut_id: string = 'goto_netflix';

    onBeforeSendHeaders(detail: Electron.OnBeforeSendHeadersListenerDetails) {}

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://netflix.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://netflix.com/favicon.ico';
    }
}

@connectToShortcut('goto_laftel')
@connectToMenu('menu_laftel')
@registerKawaiSiteDescriptor
export class KawaiLaftelDesc extends KawaiAbstractSiteDescriptor {
    shortcut_id = 'goto_laftel';
    id = 'laftel';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://laftel.net/');
    }

    LoadFaviconUrl(): string {
        return 'https://static.laftel.net/favicon.ico';
    }

    // onNewWindowCreated(url: string): 'external' | 'open' | 'suppress' | 'basic' {
    //     return 'basic';
    // }
}

@connectToShortcut('goto_disney')
@connectToMenu('menu_disney')
@registerKawaiSiteDescriptor
export class KawaiDisneyDesc extends KawaiAbstractSiteDescriptor {
    id = 'disneyplus';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.disneyplus.com/');
    }
    LoadFaviconUrl(): string {
        return 'https://www.disneyplus.com/favicon.ico';
    }
}
@connectToShortcut('goto_youtube')
@connectToMenu('menu_youtube')
@registerKawaiSiteDescriptor
export class KawaiYoutubeDesc extends KawaiAbstractSiteDescriptor {
    id = 'youtube';

    event_: any = null; // add button callback
    event2_: any = null; // donwload callback

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://youtube.com/');

        this.event_ = async () => {
            log.info('apply this');
            await browser.webContents.executeJavaScript(`
                const observer = new MutationObserver((mutations) => {
    if (
        document.querySelector(
            'div.ytp-popup.ytp-contextmenu div.ytp-panel-menu',
        )
    ) {
        console.log('video 태그가 생성되었습니다!');

        const newItem = window.document.createElement('div');
        newItem.classList.add('ytp-menuitem');
        // 아이콘 생성
        const icon = window.document.createElement('div');
        icon.classList.add('ytp-menuitem-icon');

        // 라벨(텍스트) 생성
        const label = window.document.createElement('div');
        label.classList.add('ytp-menuitem-label');
        label.textContent = 'Download Video'; // ✅ Trusted DOM 정책을 위반하지 않음

        // 내용 생성
        const content = window.document.createElement('div');
        content.classList.add('ytp-menuitem-content');

        // 요소 추가
        newItem.appendChild(icon);
        newItem.appendChild(label);
        newItem.appendChild(content);
        newItem.onclick = (e) => {
            const ctxmenu = document.querySelector(
                'div.ytp-popup.ytp-contextmenu',
            );
            if (ctxmenu) {
                ctxmenu.style.display = 'none'; // 메뉴 닫기
            }
            // https://stackoverflow.com/questions/3452546/how-do-i-get-the-youtube-video-id-from-a-url
            const videoUrl = window.location.href;
            console.log(videoUrl)
            const yotube_regex =
            // \/^.*(?:(?:youtu\\.be\\/|v\\/|vi\/|u\\/\\w\\/|embed\\/|shorts\\/|live\\/)|(?:(?:watch)?\\?v(?:i)?=|\\&v(?:i)?=))([^#\\&\\?]*).*\/;
                 \/^.*(?:(?:youtu\.be\\/|v\\/|vi\\/|u\\/\\w\\/|embed\\/|shorts\\/|live\\/)|(?:(?:watch)?\\?v(?:i)?=|\\&v(?:i)?=))([^#\\&\\?]*).*\/;
            // this regex transform this https://www.youtube.com/watch?v=7qX8_vf7Yt4&ab_channel=%EB%AA%B0%EB%9D%BC as 7qX8_vf7Yt4;
            // if you want to create youtu.be link concat it yotu.be+"/"+7qX8_vf7Yt4
            console.log(videoUrl.match(yotube_regex)[1]);
            // 클릭 시 전파 방지 (필요한 경우)
            const url = videoUrl.match(yotube_regex)[1];
            e.stopPropagation();
            window.KAWAI_API.custom.custom_callback('youtube', url);
        };
        // get context panel code.
        const ctxmenu = window.document.querySelector(
            'div.ytp-popup.ytp-contextmenu div.ytp-panel-menu',
        );
        ctxmenu.appendChild(newItem);
        observer.disconnect(); // 감지가 완료되면 더 이상 감지할 필요 없으므로 중단
    }
});

// body 태그 아래의 모든 요소 변화를 감지
observer.observe(document.body, { childList: true, subtree: true });

                `);
            log.info('apply extention');
        };

        (this.event2_ = async (
            e: Electron.IpcMainEvent,
            tag: string,
            youtube_video_tag: string,
        ) => {
            if (tag === 'youtube') {
                log.info(path.join(third_party_bin_path, 'yt-dlp'));
                try {
                    await fs.access(download_root_path);
                } catch {
                    await fs.mkdir(download_root_path, {
                        recursive: true,
                    });
                }

                log.info(path.resolve(data_root_path, './yt.txt'));
                const yt_cookie_pth = path.resolve(data_root_path, './yt.txt');
                const res = await getValidCookieFile(
                    '.youtube.com',
                    yt_cookie_pth,
                    'https://www.youtube.com/getAccountInfo',
                );

                switch (res.result) {
                    case 'success':
                        {
                            const bgtask = new KawaiYoutuebeBgChild(
                                'https://youtu.be/' + youtube_video_tag,
                                {
                                    merge_output_format: 'mp4',
                                    cookie_path: yt_cookie_pth,
                                    format: 'bestvideo+bestaudio',
                                    save_directory: download_root_path,
                                },
                            );

                            KawaiBgTaskManager.getInstance().registerBgTask(
                                bgtask,
                            );
                        }

                        break;
                    case 'fail':
                        break;
                }
            } else if (tag.startsWith('youtube:bg')) {
                const child_strings = tag.slice('youtube:bg'.length + 1);
            }
        }),
            ipcMain.on(KAWAI_API_LITERAL.custom.custom_callback, this.event2_);

        browser.webContents.on('did-finish-load', this.event_);
    }

    onNewWindowCreated(
        url: string,
    ): 'external' | 'open' | 'suppress' | 'basic' {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            if (
                /https?:\/\/(www\.)?youtube\.com\/(redirect\?|ads\/|pagead\/)/.test(
                    url,
                )
            ) {
                return 'external';
            }
            return 'open';
        } else {
            return 'external';
        }
    }

    async unload(browser: Electron.BrowserWindow): Promise<void> {
        if (this.event_ != null) {
            browser.webContents.removeListener('did-finish-load', this.event_);
        }
        if (this.event2_ != null) {
            ipcMain.removeListener(
                KAWAI_API_LITERAL.custom.custom_callback,
                this.event2_,
            );
        }
    }

    LoadFaviconUrl(): string {
        return 'https://youtube.com/favicon.ico';
    }
}
@connectToShortcut('goto_amazonprime')
@connectToMenu('menu_amazonprime')
@registerKawaiSiteDescriptor
export class KawaiAmazonPrimeDesc extends KawaiAbstractSiteDescriptor {
    id = 'amazonprime';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.primevideo.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.primevideo.com/favicon.ico';
    }
}
@connectToShortcut('goto_wavve')
@connectToMenu('menu_wavve')
@registerKawaiSiteDescriptor
export class KawaiWavveDesc extends KawaiAbstractSiteDescriptor {
    id = 'wavve';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.wavve.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.wavve.com/favicon.ico';
    }
}

@connectToShortcut('goto_watcha')
@connectToMenu('menu_watcha')
@registerKawaiSiteDescriptor
export class KawaiWatchaDesc extends KawaiAbstractSiteDescriptor {
    id = 'watcha';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://watcha.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://watcha.com/favicon.ico';
    }
}

@connectToShortcut('goto_coupangplay')
@connectToMenu('menu_coupangplay')
@registerKawaiSiteDescriptor
export class KawaiCoupangPlayDesc extends KawaiAbstractSiteDescriptor {
    id = 'coupangplay';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.coupangplay.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.coupangplay.com/favicon.ico';
    }
    onBeforeSendHeaders(
        details: Electron.OnBeforeSendHeadersListenerDetails,
    ): void {
        details.requestHeaders['Sec-Ch-Ua'] =
            '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
        details.requestHeaders['User-Agent'] =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    }
}

@connectToShortcut('goto_tving')
@connectToMenu('menu_tving')
@registerKawaiSiteDescriptor
export class KawaiTvingDesc extends KawaiAbstractSiteDescriptor {
    id = 'tving';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.tving.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://www.tving.com/favicon.ico';
    }
}

@connectToShortcut('goto_twitch')
@connectToMenu('menu_twitch')
@registerKawaiSiteDescriptor
export class KawaiTwitchDesc extends KawaiAbstractSiteDescriptor {
    id = 'twitch';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.twitch.tv/', {
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        });
    }

    LoadFaviconUrl(): string {
        return 'https://twitch.com/favicon.ico';
    }
}

@connectToShortcut('goto_appletv')
@connectToMenu('menu_appletv')
@registerKawaiSiteDescriptor
export class KawaiAppleTvDesc extends KawaiAbstractSiteDescriptor {
    id = 'appletv';
    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://tv.apple.com/', {
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        });
    }

    LoadFaviconUrl(): string {
        return 'https://tv.apple.com/favicon.ico';
    }
}
@connectToShortcut('goto_chzzk')
@connectToMenu('menu_chzzk')
@registerKawaiSiteDescriptor
export class KawaiChzzkDesc extends KawaiAbstractSiteDescriptor {
    id = 'chzzk';

    event_: any = null; // variable for anonymous event
    adfree_event: any = null;

    onBeforeRequest(details: Electron.OnBeforeRequestListenerDetails): {
        cancel?: boolean;
        redirectURL?: string;
    } {
        // @seeaslso https://github.com/bass9030/FUCK-CHZZK-GRID/blob/master/background.js
        const requestFilter = {
            urls: ['<all_urls>'],
            types: ['xmlhttprequest'],
        };

        const URL_MATCH_PATTERN = [
            /chunklist_480p.m3u8/g,
            /[A-z0-9]+\/480p\/hdntl=.+\/chunklist.m3u8/g,
            /[0-9a-z]+\/480p\/chunklist.m3u8/g,
        ];
        function changeResolution(url: string, newResolution: string): string {
            // Find and replace the resolution part in the URL
            return url.replace(/(\d{3})p/, `${newResolution}p`);
        }
        function changeResolutionIfExists(
            url: string,
            newResolution: string,
        ): string | null {
            // Check if the resolution exists in the URL
            if (url.includes('480p')) {
                // If it exists, replace 480p with the new resolution
                return url.replace('480p', `${newResolution}p`);
            } else {
                // If it doesn't exist, return the original URL
                // console.log('Resolution 480p not found in URL.');
                return null;
            }
        }
        const url = details.url;
        const new_url = changeResolutionIfExists(url, '1080');
        if (new_url == null) {
            return {};
        }
        return { redirectURL: new_url };
        // for (let i = 0; i < URL_MATCH_PATTERN.length; i++) {
        // if (url.match(URL_MATCH_PATTERN[i])) {
        // log.info(`pattern matched ${url}`);
        // return { redirectURL: url.replace('480p', '1080p') };
        // }
        // }

        return {};
    }

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://chzzk.naver.com/', {
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        });

        browser.webContents.executeJavaScript(`
            
            var FCG_attempt = 0;

console.log("[FUCK CHZZK GRID] script inject!");

function changeText() {
    if (FCG_attempt > 5) {
        console.log("[FUCK CHZZK GRID] Failed to inject - element not found");
        return;
    }
    FCG_attempt++;
    let qualitys = document.querySelectorAll(
        "div.pzp-setting-quality-pane > div:nth-child(2) > ul > li"
    );
    let qualityElement;
    // 480p 텍스트 찾기
    for (let i = 0; i < qualitys.length; i++) {
        let e = qualitys[i];
        if (e.innerText.trim().includes("480p")) {
            qualityElement = e;
            break;
        }
    }
    let video = document.querySelector(
        "div[class^='live_information_details']"
    );

    if (!!video && !!qualityElement) {
        qualityElement.querySelector(
            "li > div:nth-child(2) > span > div"
        ).innerHTML =
            '<span class="pzp-pc-ui-setting-quality-item__prefix">1080p&nbsp;<div class="pzp-ui-track-badge"><em style="vertical-align:super;" class="pzp-ui-track-badge__badge">with FUCK GRID™</em> <!----></div></span>';
        console.log("[FUCK CHZZK GRID] inject complete!");
    } else setTimeout(changeText, 500);



    console.log("script done")
}

changeText();
            `);

        //add free scripts
        net.fetch(
            'https://raw.githubusercontent.com/krkarma777/UltraFastAdSkipperFromCHZZK/main/CHZZK-Ad-Blocker.user.js',
        )
            .then((response) => response.text())
            .then((script) => {
                this.event_ = () => {
                    browser.webContents.executeJavaScript(script);
                };
                browser.webContents.on('did-finish-load', this.event_);
                log.info('load scripts succ');
            })
            .catch(() => {
                log.info('error when download script.');
            });
    }

    async unload(browser: Electron.BrowserWindow): Promise<void> {
        browser.webContents.removeListener('did-finish-load', this.event_);
    }

    LoadFaviconUrl(): string {
        return 'https://chzzk.naver.com/favicon.ico';
    }
}

// @connectToShortcut('goto_soop')
// @connectToMenu('menu_soop')
// @registerKawaiSiteDescriptor
// export class KawaiSoopDesc extends KawaiAbstractSiteDescriptor {
//     id = 'soop';

//     onBeforeRequest(details: Electron.OnBeforeRequestListenerDetails): {
//         cancel?: boolean;
//         redirectURL?: string;
//     } {
//         function changeResolutionIfExists(
//             url: string,
//             newResolution: string,
//         ): string | null {
//             // Check if the resolution exists in the URL
//             if (url.includes('960x540')) {
//                 // If it exists, replace 480p with the new resolution
//                 return url.replace('960x540', `${newResolution}`);
//             } else if (url.includes('640x360')) {
//                 return url.replace('640x360', `${newResolution}`);
//             } else {
//                 // If it doesn't exist, return the original URL
//                 // console.log('Resolution 480p not found in URL.');
//                 return null;
//             }
//         }
//         const url = details.url;
//         if (!url.includes('preview')) {
//             const new_url = changeResolutionIfExists(url, '640x360');
//             if (new_url == null) {
//                 return {};
//             }
//             return { redirectURL: new_url };
//         } else {
//             return {};
//         }
//     }

//     async loadUrl(browser: Electron.BrowserWindow) {
//         browser.loadURL('https://www.sooplive.co.kr/', {
//             userAgent:
//                 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
//         });
//     }

//     onBeforeSendHeaders(
//         details: Electron.OnBeforeSendHeadersListenerDetails,
//     ): void {
//         if (typeof details.url === 'undefined') {
//             return;
//         }
//         try {
//             if (details.url.includes('play.sooplive.co.kr')) {
//                 // details.requestHeaders['Referer'] = 'https://play.sooplive.co.kr'; // 원하는 Referer로 변경
//                 // details.requestHeaders['Origin'] = 'https://play.sooplive.co.kr'; // CORS 우회용 Origin 수정
//                 const pth = details.requestHeaders['path'];
//                 if (pth.includes('640x360')) {
//                     pth.replace('960x540', '1920x1080');
//                 } else if (pth.includes('960x540'))
//                     pth.replace('960x540', '1920x1080');
//                 details.requestHeaders['path'] = pth;
//             }
//         } catch (err) {
//             console.log(err);
//         }
//     }

//     LoadFaviconUrl(): string {
//         return 'https://www.sooplive.co.kr/favicon.ico';
//     }
// }

@connectToShortcut('goto_applemusic')
@connectToMenu('menu_applemusic')
@registerKawaiSiteDescriptor
export class KawaiAppleMusicDesc extends KawaiAbstractSiteDescriptor {
    id = 'applemusic';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://music.apple.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://music.apple.com/favicon.ico';
    }
}

@connectToShortcut('goto_spotify')
@connectToMenu('menu_spotify')
@registerKawaiSiteDescriptor
export class KawaiSpotifyDesc extends KawaiAbstractSiteDescriptor {
    id = 'spotify';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://spotify.com');
    }

    LoadFaviconUrl(): string {
        return 'https://spotify.com/favicon.ico';
    }
}

@connectToShortcut('goto_youtubemusic')
@connectToMenu('menu_youtubemusic')
@registerKawaiSiteDescriptor
export class KawaiYoutubeMusicDesc extends KawaiAbstractSiteDescriptor {
    id = 'youtubemusic';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://music.youtube.com/');
    }

    LoadFaviconUrl(): string {
        return 'https://music.youtube.com/favicon.ico';
    }

    async unload(browser: Electron.BrowserWindow) {
        // youtube music need to stop when change view.(I have no idea what reason it is)
        await browser.webContents.executeJavaScript(
            "window.document.querySelector('video').pause();",
        );
    }
}

@connectToShortcut('goto_main')
@connectToMenu('menu_main')
@registerKawaiSiteDescriptor
export class KawaiMainDesc extends KawaiAbstractSiteDescriptor {
    id = 'main';

    async loadUrl(browser: Electron.BrowserWindow) {
        let html_path = cvrt_electron_path(
            path.resolve(script_root_path, './pages/main.html'),
        );
        browser.loadURL(
            process.env.IS_DEV ? 'http://localhost:3000/main.html' : html_path,
        );
    }

    // LoadFaviconUrl(): string {
    //     return '';
    // }
}

@connectToShortcut('goto_crunchyroll')
@connectToMenu('menu_crunchyroll')
@registerKawaiSiteDescriptor
export class KawaiCrunchyrollDesc extends KawaiAbstractSiteDescriptor {
    id = 'crunchyroll';

    async loadUrl(browser: Electron.BrowserWindow) {
        browser.loadURL('https://www.crunchyroll.com/');
    }

    LoadFaviconUrl(): string {
        return 'kawai://resources/icons/crunchyroll.png';
    }
}
