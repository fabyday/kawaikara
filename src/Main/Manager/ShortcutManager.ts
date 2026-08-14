import { globalShortcut, type Input } from 'electron';
import { APP_SHORTCUTS } from '../../Common/AppShortcuts';
import type { PreferenceManager } from './PreferenceManager';
import type { SiteManager } from './SiteManager';
import type { WindowManager } from './WindowManager';

interface ShortcutBinding {
  readonly id: string;
  readonly defaultKey: string;
  run(): void | Promise<void>;
}

const PICTURE_IN_PICTURE_SHORTCUT_ID = 'app.toggle-picture-in-picture';

export class ShortcutManager {
  private lastPictureInPictureToggleAt = 0;
  private pictureInPictureActive = false;
  private pictureInPictureTogglePromise?: Promise<void>;
  private registeredPictureInPictureAccelerator?: string;

  constructor(
    private readonly sites: SiteManager,
    private readonly windows: WindowManager,
    private readonly preferences: PreferenceManager,
  ) {}

  handleInput(input: Input, editing = false): boolean {
    if (
      input.type !== 'keyDown' ||
      input.isAutoRepeat ||
      input.isComposing
    ) {
      return false;
    }

    const overrides = this.preferences.get().shortcuts;
    const binding = this.getBindings().find(({ id, defaultKey }) => {
      const accelerator = overrides[id] ?? defaultKey;
      return accelerator.trim() && matchesAccelerator(input, accelerator);
    });
    if (!binding) {
      return false;
    }
    // A plain Tab belongs to the focused site input. Modifier-based app/site
    // shortcuts remain available while typing in the viewer.
    if (editing && binding.id === 'app.toggle-menu') {
      return false;
    }

    void Promise.resolve(binding.run()).catch((error: unknown) => {
      console.error(`Shortcut ${binding.id} failed.`, error);
    });
    return true;
  }

  setPictureInPictureActive(active: boolean): void {
    this.pictureInPictureActive = active;
    this.refreshGlobalShortcut();
  }

  refreshGlobalShortcut(): void {
    if (!this.pictureInPictureActive) {
      this.unregisterPictureInPictureGlobalShortcut();
      return;
    }

    const accelerator = this.getPictureInPictureAccelerator();
    if (
      accelerator === this.registeredPictureInPictureAccelerator &&
      globalShortcut.isRegistered(accelerator)
    ) {
      return;
    }

    this.unregisterPictureInPictureGlobalShortcut();
    if (!accelerator) return;

    try {
      const registered = globalShortcut.register(accelerator, () => {
        if (!this.pictureInPictureActive) return;
        void this.togglePictureInPicture().catch((error: unknown) => {
          console.error('The global PiP shortcut failed.', error);
        });
      });
      if (registered) {
        this.registeredPictureInPictureAccelerator = accelerator;
      } else {
        console.warn(
          `The global PiP shortcut could not be registered: ${accelerator}`,
        );
      }
    } catch (error) {
      console.warn(
        `The global PiP shortcut is invalid or unavailable: ${accelerator}`,
        error,
      );
    }
  }

  dispose(): void {
    this.pictureInPictureActive = false;
    this.unregisterPictureInPictureGlobalShortcut();
  }

  private getBindings(): ShortcutBinding[] {
    const appActions: Record<string, () => void | Promise<void>> = {
      'app.toggle-menu': () => this.windows.toggleOverlay(),
      'app.toggle-fullscreen': () => this.windows.toggleAppFullScreen(),
      'app.open-preferences': () => this.windows.showPreferencesOverlay(),
      'app.toggle-always-on-top': async () => {
        const current = this.preferences.get();
        const next = await this.preferences.update({
          alwaysOnTop: !current.alwaysOnTop,
        });
        this.windows.setAlwaysOnTop(next.alwaysOnTop);
      },
      'app.toggle-picture-in-picture': async () => {
        await this.togglePictureInPicture();
      },
      'app.reload-site': () => this.windows.reloadViewer(),
      'app.go-back': () => this.windows.goBack(),
      'app.go-forward': () => this.windows.goForward(),
    };
    const appBindings = APP_SHORTCUTS.map((definition) => ({
      ...definition,
      run: appActions[definition.id],
    })).filter(
      (binding): binding is typeof binding & { run: () => void | Promise<void> } =>
        Boolean(binding.run),
    );
    const siteBindings = this.sites.listMenuItems().map((site) => ({
      id: `site:${site.id}`,
      defaultKey: site.defaultShortcut,
      run: async () => {
        this.windows.hideOverlay();
        await this.sites.load(site.id);
      },
    }));
    return [...appBindings, ...siteBindings];
  }

  private getPictureInPictureAccelerator(): string {
    const definition = APP_SHORTCUTS.find(
      ({ id }) => id === PICTURE_IN_PICTURE_SHORTCUT_ID,
    );
    return (
      this.preferences.get().shortcuts[PICTURE_IN_PICTURE_SHORTCUT_ID] ??
      definition?.defaultKey ??
      ''
    ).trim();
  }

  private togglePictureInPicture(): Promise<void> {
    if (this.pictureInPictureTogglePromise) {
      return this.pictureInPictureTogglePromise;
    }
    const now = Date.now();
    if (now - this.lastPictureInPictureToggleAt < 300) {
      return Promise.resolve();
    }
    this.lastPictureInPictureToggleAt = now;

    const operation = this.windows
      .togglePictureInPicture()
      .then(() => undefined);
    this.pictureInPictureTogglePromise = operation;
    const clear = () => {
      if (this.pictureInPictureTogglePromise === operation) {
        this.pictureInPictureTogglePromise = undefined;
      }
    };
    void operation.then(clear, clear);
    return operation;
  }

  private unregisterPictureInPictureGlobalShortcut(): void {
    const accelerator = this.registeredPictureInPictureAccelerator;
    this.registeredPictureInPictureAccelerator = undefined;
    if (accelerator && globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
    }
  }
}

export function matchesAccelerator(input: Input, accelerator: string): boolean {
  const parts = accelerator
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const key = parts.pop();
  if (!key) {
    return false;
  }

  let needsControl = false;
  let needsMeta = false;
  let needsAlt = false;
  let needsShift = false;
  for (const modifier of parts) {
    switch (modifier) {
      case 'commandorcontrol':
      case 'cmdorctrl':
        if (process.platform === 'darwin') needsMeta = true;
        else needsControl = true;
        break;
      case 'command':
      case 'cmd':
      case 'super':
        needsMeta = true;
        break;
      case 'control':
      case 'ctrl':
        needsControl = true;
        break;
      case 'alt':
      case 'option':
        needsAlt = true;
        break;
      case 'shift':
        needsShift = true;
        break;
      default:
        return false;
    }
  }

  return (
    input.control === needsControl &&
    input.meta === needsMeta &&
    input.alt === needsAlt &&
    input.shift === needsShift &&
    normalizeInputKey(input) === normalizeAcceleratorKey(key)
  );
}

function normalizeInputKey(input: Input): string {
  if (/^Key[A-Z]$/i.test(input.code)) return input.code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(input.code)) return input.code.slice(5);
  if (/^Numpad[0-9]$/.test(input.code)) return input.code.slice(6);
  return normalizeAcceleratorKey(input.key);
}

function normalizeAcceleratorKey(key: string): string {
  const normalized = key.toLowerCase();
  const aliases: Record<string, string> = {
    arrowleft: 'left',
    arrowright: 'right',
    arrowup: 'up',
    arrowdown: 'down',
    return: 'enter',
    esc: 'escape',
    space: ' ',
    spacebar: ' ',
    comma: ',',
  };
  return aliases[normalized] ?? normalized;
}
