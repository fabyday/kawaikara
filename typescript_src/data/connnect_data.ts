import { KawaiViewManager } from '../manager/view_manager';
import { keyActionListenable } from '../definitions/action';
import { RegisterShortcut } from '../logics/register';

const mainview = 'mainview';

@RegisterShortcut
class KawaiMainTab implements keyActionListenable {
    id = 'goto_tab';
    targetView = mainview;
    actionKey = 'tab';
    onActivated() {
        const menuManager = KawaiViewManager.getInstance();
        if (menuManager.isMenuOpen()) {
            KawaiViewManager.getInstance().closeMenu();
        } else {
            KawaiViewManager.getInstance().openMenu();
        }
        return true;
    }
}

@RegisterShortcut
class KawaiFullscreenShortcut implements keyActionListenable {
    id = 'goto_fullscreen';
    targetView = mainview;
    actionKey = 'lalt+enter';
    onActivated() {
        KawaiViewManager.getInstance().fullscreen();
        return true;
    }
}
@RegisterShortcut
class KawaiPiPShortcut implements keyActionListenable {
    id = 'run_pip';
    targetView = mainview;
    actionKey = 'lctrl+p';
    onActivated() {
        KawaiViewManager.getInstance().pipMode();
        return true;
    }
}

@RegisterShortcut
class KawaiNetflixShortcut implements keyActionListenable {
    id = 'goto_netflix';
    targetView = mainview;
    actionKey = '';
}

@RegisterShortcut
class KawaiLaftelShortcut implements keyActionListenable {
    id = 'goto_laftel';
    targetView = mainview;
    actionKey = '';
}

@RegisterShortcut
class KawaiDisneyShortcut implements keyActionListenable {
    id = 'goto_disney';
    targetView = mainview;
    actionKey = '';
}

@RegisterShortcut
class KawaiYoutubeShortcut implements keyActionListenable {
    id = 'goto_youtube';
    targetView = mainview;
    actionKey = '';
}
@RegisterShortcut
class KawaiAmazonPrimeShortcut implements keyActionListenable {
    id = 'goto_amazonprime';
    targetView = mainview;
    actionKey = '';
}

@RegisterShortcut
class KawaiWavveShortcut implements keyActionListenable {
    id = 'goto_wavve';
    targetView = mainview;
    actionKey = '';
}

@RegisterShortcut
class KawaiWatchaShortcut implements keyActionListenable {
    id = 'goto_watcha';
    targetView = mainview;
    actionKey = '';
}

@RegisterShortcut
class KawaiCoupangPlayShortcut implements keyActionListenable {
    id = 'goto_coupangplay';
    targetView = mainview;
    actionKey = '';
}

@RegisterShortcut
class KawaiTvingShortcut implements keyActionListenable {
    id = 'goto_tving';
    targetView = mainview;
    actionKey = '';
}

@RegisterShortcut
class KawaiTwitchShortcut implements keyActionListenable {
    id = 'goto_twitch';
    targetView = mainview;
    actionKey = '';
}

@RegisterShortcut
class KawaiChzzkShortcut implements keyActionListenable {
    id = 'goto_chzzk';
    targetView = mainview;
    actionKey = '';
}

@RegisterShortcut
class KawaiAppleMusicShortcut implements keyActionListenable {
    id = 'goto_applemusic';
    targetView = mainview;
    actionKey = '';
}

@RegisterShortcut
class KawaiMainPageShortcut implements keyActionListenable {
    id = 'goto_main';
    targetView = mainview;
    actionKey = '';
}

@RegisterShortcut
class KawaiCrunchyrollShortcut implements keyActionListenable {
    id = 'goto_crunchyroll';
    targetView = mainview;
    actionKey = '';
}
