export interface AppShortcutDefinition {
  readonly id: string;
  readonly title: string;
  readonly defaultKey: string;
}

/** App-owned shortcuts live in src; site-owned defaults live in @site metadata. */
export const APP_SHORTCUTS = [
  { id: 'app.toggle-menu', title: 'Open or close menu', defaultKey: 'Tab' },
  {
    id: 'app.toggle-fullscreen',
    title: 'Toggle app fullscreen',
    defaultKey: 'Alt+Enter',
  },
  {
    id: 'app.open-preferences',
    title: 'Open preferences',
    defaultKey: 'CommandOrControl+,',
  },
  {
    id: 'app.toggle-always-on-top',
    title: 'Toggle always on top',
    defaultKey: 'CommandOrControl+Shift+L',
  },
  {
    id: 'app.toggle-picture-in-picture',
    title: 'Toggle Picture in Picture',
    defaultKey: 'CommandOrControl+Shift+P',
  },
  {
    id: 'app.reload-site',
    title: 'Reload current site',
    defaultKey: 'CommandOrControl+R',
  },
  { id: 'app.go-back', title: 'Go back', defaultKey: 'Alt+Left' },
  { id: 'app.go-forward', title: 'Go forward', defaultKey: 'Alt+Right' },
] as const satisfies readonly AppShortcutDefinition[];
