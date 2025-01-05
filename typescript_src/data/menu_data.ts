// this is default menu data

import { KawaiMenuBase } from '../definitions/menu_def';
import { KawaiAction } from '../definitions/types';
import { registerKawaiMenuItem } from '../manager/menu_manager';

@registerKawaiMenuItem('ott', 'menu_netflix')
class KawaiMenuNetflix extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_laftel')
class KawaiMenuLaftel extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_disney')
class KawaiMenuDisney extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_laftel')
class KawaiMenuYoutube extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_amazonprime')
class KawaiMenuAmazonprime extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_amazonprime')
class KawaiMenuWavve extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_watcha')
class KawaiMenuWatcha extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_coupangplay')
class KawaiMenuCoupangPlay extends KawaiMenuBase {}

@registerKawaiMenuItem('ott', 'menu_tving')
class KawaiMenuTving extends KawaiMenuBase {}

@registerKawaiMenuItem('music', 'menu_applemusic')
class KawaiMenuAppleMusic extends KawaiMenuBase {}

@registerKawaiMenuItem('music', 'menu_applemusic')
class KawaiMenuChzzk extends KawaiMenuBase {}

@registerKawaiMenuItem('streaming', 'menu_twitch')
class KawaiMenuTwitch extends KawaiMenuBase {}

@registerKawaiMenuItem('options', 'menu_info')
class KawaiMenuInfo extends KawaiMenuBase {}

@registerKawaiMenuItem('options', 'menu_preference')
class KawaiMenuPreference extends KawaiMenuBase {}

@registerKawaiMenuItem('options', 'menu_pip')
class KawaiMenuPip extends KawaiMenuBase {}

@registerKawaiMenuItem('options', 'menu_checkupdate')
class KawaiMenuCheckUpdate extends KawaiMenuBase {}

@registerKawaiMenuItem('options', 'menu_github')
class KawaiMenuGithub extends KawaiMenuBase {}