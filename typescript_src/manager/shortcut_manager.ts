export class ShortcutManager {
    static __instance: ShortcutManager | undefined;

    private constructor() {}

    public static getInstance() {
        if (typeof ShortcutManager.__instance === 'undefined') {
            ShortcutManager.__instance = new ShortcutManager();
        }
        return ShortcutManager.__instance;
    }

    public activateShortcut() {}
}
