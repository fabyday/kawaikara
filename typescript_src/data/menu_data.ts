// this is default menu data

import { shell } from 'electron';
import { KawaiMenuBase } from '../definitions/menu_def';
import { KawaiAction } from '../definitions/types';
import { registerKawaiMenuItem } from '../manager/menu_manager';
import { get_preference_instance } from '../component/preference';
import { KawaiSiteDescriptorManager } from '../definitions/SiteDescriptor';
import { get_mainview_instance } from '../component/mainview';
import { KawaiViewManager } from '../manager/view_manager';

@registerKawaiMenuItem('ott', 'menu_netflix')
class KawaiMenuNetflix extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().loadUrl("netflix");
    }
}

@registerKawaiMenuItem('ott', 'menu_laftel')
class KawaiMenuLaftel extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().loadUrl("laftel");
    }
}

@registerKawaiMenuItem('ott', 'menu_disney')
class KawaiMenuDisney extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().loadUrl("disneyplus");
    }
}

@registerKawaiMenuItem('ott', 'menu_youtube')
class KawaiMenuYoutube extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().loadUrl("youtube");
    }
}

@registerKawaiMenuItem('ott', 'menu_amazonprime')
class KawaiMenuAmazonprime extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().loadUrl("amazonprime");
    }
}

@registerKawaiMenuItem('ott', 'menu_wavve')
class KawaiMenuWavve extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().loadUrl("amazonprime");
    }
}

@registerKawaiMenuItem('ott', 'menu_watcha')
class KawaiMenuWatcha extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().loadUrl("watcha");
    }
}

@registerKawaiMenuItem('ott', 'menu_coupangplay')
class KawaiMenuCoupangPlay extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().loadUrl("coupangplay");
    }
}

@registerKawaiMenuItem('ott', 'menu_tving')
class KawaiMenuTving extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().loadUrl("tving");
    }
}

@registerKawaiMenuItem('music', 'menu_applemusic')
class KawaiMenuAppleMusic extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().loadUrl("applemusic");

    }
}

@registerKawaiMenuItem('streaming', 'menu_chzzk')
class KawaiMenuChzzk extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().loadUrl("chzzk");
    }
}

@registerKawaiMenuItem('streaming', 'menu_twitch')
class KawaiMenuTwitch extends KawaiMenuBase {
    public activate(): void {
        KawaiViewManager.getInstance().loadUrl("twitch");
    }
}

@registerKawaiMenuItem('options', 'menu_info')
class KawaiMenuInfo extends KawaiMenuBase {
    public activate(): void {

    }
}

@registerKawaiMenuItem('options', 'menu_preference')
class KawaiMenuPreference extends KawaiMenuBase {
    public activate(): void {
        get_preference_instance();
    }
}

@registerKawaiMenuItem('options', 'menu_pip')
class KawaiMenuPip extends KawaiMenuBase {
    public activate(): void {}
}

@registerKawaiMenuItem('options', 'menu_checkupdate')
class KawaiMenuCheckUpdate extends KawaiMenuBase {
    public activate(): void {}
}

@registerKawaiMenuItem('options', 'menu_github')
class KawaiMenuGithub extends KawaiMenuBase {
    public activate(): void {
        shell.openExternal("https://github.com/fabyday/kawaikara")
    }
}
