// this is default menu data

import { app, dialog, shell } from 'electron';
import { KawaiMenuBase } from '../definitions/menu_def';
import { get_preference_instance } from '../component/preference';
import { registerKawaiMenuItem } from '../logics/register';
import { checkForUpdates } from '../component/autoupdater';
import { download_root_path, project_root } from '../component/constants';
import path from 'path';
import { global_object } from './context';
import * as fs from 'fs';
import { get_bgtask_view_instnace } from '../component/background_task_view';
import { KawaiViewManager } from '../manager/view_manager';
import { get_mainview_instance } from '../component/mainview';

@registerKawaiMenuItem('OTT', 'menu_netflix')
class KawaiMenuNetflix extends KawaiMenuBase {}

@registerKawaiMenuItem('OTT', 'menu_laftel')
class KawaiMenuLaftel extends KawaiMenuBase {}

@registerKawaiMenuItem('OTT', 'menu_disney')
class KawaiMenuDisney extends KawaiMenuBase {}

@registerKawaiMenuItem('OTT', 'menu_youtube')
class KawaiMenuYoutube extends KawaiMenuBase {}

@registerKawaiMenuItem('OTT', 'menu_amazonprime')
class KawaiMenuAmazonprime extends KawaiMenuBase {}

@registerKawaiMenuItem('OTT', 'menu_wavve')
class KawaiMenuWavve extends KawaiMenuBase {}

@registerKawaiMenuItem('OTT', 'menu_watcha')
class KawaiMenuWatcha extends KawaiMenuBase {}

@registerKawaiMenuItem('OTT', 'menu_coupangplay')
class KawaiMenuCoupangPlay extends KawaiMenuBase {}

@registerKawaiMenuItem('OTT', 'menu_tving')
class KawaiMenuTving extends KawaiMenuBase {}

@registerKawaiMenuItem('OTT', 'menu_appletv')
class KawaiMenuAppleTv extends KawaiMenuBase {}

@registerKawaiMenuItem('Music', 'menu_applemusic')
class KawaiMenuAppleMusic extends KawaiMenuBase {}

@registerKawaiMenuItem('Music', 'menu_spotify')
class KawaiMenuSpotify extends KawaiMenuBase {}

@registerKawaiMenuItem('Music', 'menu_youtubemusic')
class KawaiMenuYoutubeMusic extends KawaiMenuBase {}

@registerKawaiMenuItem('Streaming', 'menu_chzzk')
class KawaiMenuChzzk extends KawaiMenuBase {}

// @registerKawaiMenuItem('Streaming', 'menu_soop')
// class KawaiMenuSoop extends KawaiMenuBase {}

@registerKawaiMenuItem('Streaming', 'menu_twitch')
class KawaiMenuTwitch extends KawaiMenuBase {}

@registerKawaiMenuItem('Options', 'menu_info')
class KawaiMenuInfo extends KawaiMenuBase {
    public activate(): void {
        const message = `Welcome to Kawaikara ${app.getVersion()}. This application is CHoooO Kawai OTT Streaming Viewer.`;
        dialog.showMessageBox(global_object!.mainWindow!, {
            title: 'Kawaikara Info',
            message: `Kawaikara v${app.getVersion()}`,
            detail: message,
        });
    }
    public getFaviconUrl() {
        return 'kawai://resources/icons/info.png';
    }
}

@registerKawaiMenuItem('Options', 'menu_opendownloaddirectory')
class KawaiMenuOpenDownloadDirectory extends KawaiMenuBase {
    public activate(): void {
        if (!fs.existsSync(download_root_path)) {
            fs.mkdirSync(download_root_path, {
                recursive: true,
            });
        }
        shell.openPath(download_root_path);
    }

    public getFaviconUrl() {
        return 'kawai://resources/icons/folder.png';
    }
}

@registerKawaiMenuItem('Options', 'menu_bgtaskview')
class KawaiMenuBackgroundTaskView extends KawaiMenuBase {
    public activate(): void {
        get_bgtask_view_instnace();
    }

    public getFaviconUrl() {
        return 'kawai://resources/icons/bgtask.png';
    }
}

@registerKawaiMenuItem('Options', 'menu_preference')
class KawaiMenuPreference extends KawaiMenuBase {
    public activate(): void {
        get_preference_instance();
    }

    public getFaviconUrl() {
        return 'kawai://resources/icons/setting.png';
    }
}

@registerKawaiMenuItem('Options', 'menu_main')
class KawaiMenuMainPage extends KawaiMenuBase {
    public getFaviconUrl() {
        return 'kawai://resources/icons/home.png';
    }
}

@registerKawaiMenuItem('Options', 'menu_checkupdate')
class KawaiMenuCheckUpdate extends KawaiMenuBase {
    public activate(): void {
        checkForUpdates();
    }

    public getFaviconUrl() {
        return 'kawai://resources/icons/update.png';
    }
}

@registerKawaiMenuItem('Options', 'menu_github')
class KawaiMenuGithub extends KawaiMenuBase {
    public activate(): void {
        shell.openExternal('https://github.com/fabyday/kawaikara');
    }

    public getFaviconUrl() {
        return 'https://github.com/favicon.ico';
    }
}
@registerKawaiMenuItem('Options', 'menu_discord')
class KawaiMenuDiscord extends KawaiMenuBase {
    public activate(): void {
        shell.openExternal('https://discord.com/invite/JJs974BX45');
    }

    public getFaviconUrl() {
        return 'kawai://resources/icons/discord.ico';
    }
}

@registerKawaiMenuItem('Options', 'menu_alwaysontop')
class KawaiMenuAlwaysOnTop extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().alwaysOnTopMode();
    }

    public getFaviconUrl() {
        return '';
    }
}

@registerKawaiMenuItem('Options', 'menu_devconsole')
class KawaiMenuDevConsole extends KawaiMenuBase {
    public activate(): void {
        get_mainview_instance().webContents.openDevTools({ mode: 'detach' });
    }

    public getFaviconUrl() {
        return '';
    }
}

@registerKawaiMenuItem('OTT', 'menu_crunchyroll')
class KawaiMenuCrunchyroll extends KawaiMenuBase {}
