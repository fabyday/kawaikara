import { ShortcutManager } from '../../../typescript_src/manager/shortcut_manager';

describe('short binding test', () => {
    ShortcutManager.getInstance().initialize();

    beforeEach(() => {

    });

    afterEach(() => {
    });

    test('action key', () => {
        expect(1).toBe(1);
        const a = ShortcutManager.getInstance();
        a.register({
            actionKey: ['LCtrl+LSHIFT+R', 'LCtrl+Q'],
            onActivated: () => {
                return true;
            },
            targetView: 'test',
        });
        // a.onActivate();
    });
});

describe('shortcut activate test', () => {});
