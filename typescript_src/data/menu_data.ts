// this is default menu data

import { KawaiMenuBehavior } from '../definitions/menu_def';
import { KawaiAction } from '../definitions/types';
function test(d: KawaiMenuBehavior) {}

class KawaiMenuNetflix implements KawaiMenuBehavior {
    id: string = 'menu_netflix';
    category: string = 'ott';
    menuClicked(): KawaiAction {
        return { action_type: 'descriptor', target_id: '' };
    }
}

class KawaiMenuLaftel implements KawaiMenuBehavior {
    id: string = 'menu_netflix';
    category: string = 'ott';
    menuClicked(): KawaiAction {
        return { action_type: 'descriptor', target_id: '' };
    }
}

class KawaiMenuDisney implements KawaiMenuBehavior {
    id: string = 'menu_netflix';
    category: string = 'ott';
    menuClicked(): KawaiAction {
        return { action_type: 'descriptor', target_id: '' };
    }
}

class KawaiMenuYoutube implements KawaiMenuBehavior {
    id: string = 'menu_netflix';
    category: string = 'ott';
    menuClicked(): KawaiAction {
        return { action_type: 'descriptor', target_id: '' };
    }
}

class KawaiMenuAmazonprime implements KawaiMenuBehavior {
    id: string = 'menu_netflix';
    category: string = 'ott';
    menuClicked(): KawaiAction {
        return { action_type: 'descriptor', target_id: '' };
    }
}
class KawaiMenuWavve implements KawaiMenuBehavior {
    id: string = 'menu_netflix';
    category: string = 'ott';
    menuClicked(): KawaiAction {
        return { action_type: 'descriptor', target_id: '' };
    }
}
class KawaiMenuWatcha implements KawaiMenuBehavior {
    id: string = 'menu_netflix';
    category: string = 'ott';
    menuClicked(): KawaiAction {
        return { action_type: 'descriptor', target_id: '' };
    }
}
class KawaiMenuCoupangPlay implements KawaiMenuBehavior {
    id: string = 'menu_netflix';
    category: string = 'ott';
    menuClicked(): KawaiAction {
        return { action_type: 'descriptor', target_id: '' };
    }
}
class KawaiMenuTving implements KawaiMenuBehavior {
    id: string = 'menu_netflix';
    category: string = 'ott';
    menuClicked(): KawaiAction {
        return { action_type: 'descriptor', target_id: '' };
    }
}

class KawaiMenuAppleMusic implements KawaiMenuBehavior {
    id: string = 'menu_netflix';
    category: string = 'music';
    menuClicked(): KawaiAction {
        return { action_type: 'descriptor', target_id: '' };
    }
}
