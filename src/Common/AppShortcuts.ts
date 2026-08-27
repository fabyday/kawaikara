/** Describes the app shortcut definition contract. */
export interface AppShortcutDefinition {
  /** The ID value. */
  readonly id: string;
  /** The title value. */
  readonly title: string;
  /** The default key value. */
  readonly defaultKey: string;
}

/** App-owned shortcuts live in src; site-owned defaults live in `@site` metadata. */
export const APP_SHORTCUTS = [
  {
    /** The ID value. */
    id: 'app.toggle-menu',
    /** The title value. */
    title: 'Open or close menu',
    /** The default key value. */
    defaultKey: 'Tab',
  },
  {
    /** The ID value. */
    id: 'app.toggle-fullscreen',
    /** The title value. */
    title: 'Toggle app fullscreen',
    /** The default key value. */
    defaultKey: 'Alt+Enter',
  },
  {
    /** The ID value. */
    id: 'app.open-preferences',
    /** The title value. */
    title: 'Open preferences',
    /** The default key value. */
    defaultKey: 'CommandOrControl+,',
  },
  {
    /** The ID value. */
    id: 'app.toggle-always-on-top',
    /** The title value. */
    title: 'Toggle always on top',
    /** The default key value. */
    defaultKey: 'CommandOrControl+Shift+L',
  },
  {
    /** The ID value. */
    id: 'app.toggle-picture-in-picture',
    /** The title value. */
    title: 'Toggle Picture in Picture',
    /** The default key value. */
    defaultKey: 'CommandOrControl+Shift+P',
  },
  {
    /** The ID value. */
    id: 'app.reload-site',
    /** The title value. */
    title: 'Reload current site',
    /** The default key value. */
    defaultKey: 'CommandOrControl+R',
  },
  {
    /** The ID value. */
    id: 'app.go-back',
    /** The title value. */
    title: 'Go back',
    /** The default key value. */
    defaultKey: 'Alt+Left',
  },
  {
    /** The ID value. */
    id: 'app.go-forward',
    /** The title value. */
    title: 'Go forward',
    /** The default key value. */
    defaultKey: 'Alt+Right',
  },
] as const satisfies readonly AppShortcutDefinition[];
