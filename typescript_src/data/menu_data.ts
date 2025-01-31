// this is default menu data

import { shell } from 'electron';
import { KawaiMenuBase } from '../definitions/menu_def';
import { KawaiAction } from '../definitions/types';
import { get_preference_instance } from '../component/preference';
import { get_mainview_instance } from '../component/mainview';
import { KawaiViewManager } from '../manager/view_manager';
import { connectToMenu, registerKawaiMenuItem } from '../logics/register';

@registerKawaiMenuItem('ott', 'menu_netflix')
class KawaiMenuNetflix extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_laftel')
class KawaiMenuLaftel extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_disney')
class KawaiMenuDisney extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_youtube')
class KawaiMenuYoutube extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_amazonprime')
class KawaiMenuAmazonprime extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_wavve')
class KawaiMenuWavve extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_watcha')
class KawaiMenuWatcha extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_coupangplay')
class KawaiMenuCoupangPlay extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_tving')
class KawaiMenuTving extends KawaiMenuBase {}

@registerKawaiMenuItem('music', 'menu_applemusic')
class KawaiMenuAppleMusic extends KawaiMenuBase {}

@registerKawaiMenuItem('streaming', 'menu_chzzk')
class KawaiMenuChzzk extends KawaiMenuBase {}

@registerKawaiMenuItem('streaming', 'menu_twitch')
class KawaiMenuTwitch extends KawaiMenuBase {}

@registerKawaiMenuItem('options', 'menu_info')
class KawaiMenuInfo extends KawaiMenuBase {}

@registerKawaiMenuItem('options', 'menu_preference')
class KawaiMenuPreference extends KawaiMenuBase {
    public activate(): void {
        get_preference_instance();
    }
}

@registerKawaiMenuItem('options', 'menu_main')
class KawaiMenuMainPage extends KawaiMenuBase {}

@registerKawaiMenuItem('options', 'menu_checkupdate')
class KawaiMenuCheckUpdate extends KawaiMenuBase {
    public activate(): void {}
}

@registerKawaiMenuItem('options', 'menu_github')
class KawaiMenuGithub extends KawaiMenuBase {
    public activate(): void {
        shell.openExternal('https://github.com/fabyday/kawaikara');
    }

    public getFaviconUrl() {
        return 'https://github.com/favicon.ico';
    }
}
@registerKawaiMenuItem('options', 'menu_discord')
class KawaiMenuDiscord extends KawaiMenuBase {
    public activate(): void {
        shell.openExternal('https://discord.com/invite/JJs974BX45');
    }

    public getFaviconUrl() {
        return 'https://discord.com/assets/favicon.ico';
    }
}
