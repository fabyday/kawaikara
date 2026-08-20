import { globalShortcut, type Input } from 'electron';
import {
  SHORT_FORM_VIDEO_ACTIONS,
  type ProviderSettingListItem,
  type ShortFormVideoContribution,
} from '@kawaikara/site-api';
import { APP_SHORTCUTS } from '../../Common/AppShortcuts';
import {
  SHORT_FORM_VIDEO_SHORTCUTS,
} from '../../Common/ShortFormVideo';
import { VIDEO_SHORTCUTS } from '../../Common/VideoControls';
import type { PreferenceManager } from './PreferenceManager';
import type { SiteManager } from './SiteManager';
import type { WindowManager } from './WindowManager';

interface ShortcutBinding {
  readonly id: string;
  readonly defaultKey: string;
  run(): void | Promise<void>;
}

const PICTURE_IN_PICTURE_SHORTCUT_ID = 'app.toggle-picture-in-picture';
const ALWAYS_ON_TOP_SHORTCUT_ID = 'app.toggle-always-on-top';

export class ShortcutManager {
  private lastAlwaysOnTopToggleAt = 0;
  private lastPictureInPictureToggleAt = 0;
  private pictureInPictureActive = false;
  private pictureInPictureTogglePromise?: Promise<void>;
  private registeredPictureInPictureAccelerator?: string;
  private registeredAlwaysOnTopAccelerator?: string;
  private readonly registeredShortFormAccelerators = new Map<string, string>();

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

    if (
      this.windows.isPictureInPictureActive() &&
      input.key.toLowerCase() === 'tab'
    ) {
      return true;
    }

    const overrides = this.preferences.get().shortcuts;
    if (
      this.sites.isCurrentSite('kawaikara.video') &&
      matchesVideoShortcutInput(input, overrides)
    ) {
      // The internal Video renderer owns these keys, including its optional
      // Control/Alt precision modifiers. Let the DOM key event reach it.
      return false;
    }
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
    this.refreshAlwaysOnTopGlobalShortcut();
    if (!this.pictureInPictureActive) {
      this.unregisterPictureInPictureGlobalShortcut();
      this.unregisterShortFormGlobalShortcuts();
      return;
    }

    const accelerator = this.getPictureInPictureAccelerator();
    if (
      accelerator === this.registeredPictureInPictureAccelerator &&
      globalShortcut.isRegistered(accelerator)
    ) {
      this.refreshShortFormGlobalShortcuts();
      return;
    }

    this.unregisterPictureInPictureGlobalShortcut();
    if (!accelerator) {
      this.refreshShortFormGlobalShortcuts();
      return;
    }

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
    this.refreshShortFormGlobalShortcuts();
  }

  dispose(): void {
    this.pictureInPictureActive = false;
    this.unregisterAlwaysOnTopGlobalShortcut();
    this.unregisterPictureInPictureGlobalShortcut();
    this.unregisterShortFormGlobalShortcuts();
  }

  private getBindings(): ShortcutBinding[] {
    const appActions: Record<string, () => void | Promise<void>> = {
      'app.toggle-menu': () => this.windows.toggleOverlay(),
      'app.toggle-fullscreen': () => this.windows.toggleAppFullScreen(),
      'app.open-preferences': () => this.windows.showPreferencesOverlay(),
      'app.toggle-always-on-top': async () => {
        await this.toggleAlwaysOnTop();
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
    const shortFormContribution = this.sites.getCurrentShortFormVideoContribution();
    const shortFormBindings = shortFormContribution
      ? SHORT_FORM_VIDEO_SHORTCUTS
        .filter((definition) =>
          supportsShortFormShortcut(definition.id, shortFormContribution),
        )
        .map((definition) => ({
          ...definition,
          run: () => this.runShortFormAction(definition.id),
        }))
      : [];
    const providerActionBindings = this.sites.listMenuItems()
      .filter((site) => site.isCurrent)
      .flatMap((site) =>
      site.actionShortcuts.map((shortcut) => ({
        ...shortcut,
        run: async () => {
          if (!this.sites.isCurrentSite(site.id)) return;
          await this.sites.handleAction(shortcut.action);
        },
      })),
      );
    return [
      ...appBindings,
      ...shortFormBindings,
      ...providerActionBindings,
      ...siteBindings,
    ];
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

  private getAlwaysOnTopAccelerator(): string {
    const definition = APP_SHORTCUTS.find(
      ({ id }) => id === ALWAYS_ON_TOP_SHORTCUT_ID,
    );
    return (
      this.preferences.get().shortcuts[ALWAYS_ON_TOP_SHORTCUT_ID] ??
      definition?.defaultKey ??
      ''
    ).trim();
  }

  private refreshAlwaysOnTopGlobalShortcut(): void {
    const accelerator = this.getAlwaysOnTopAccelerator();
    if (
      accelerator === this.registeredAlwaysOnTopAccelerator &&
      globalShortcut.isRegistered(accelerator)
    ) {
      return;
    }
    this.unregisterAlwaysOnTopGlobalShortcut();
    if (!accelerator) return;
    try {
      const registered = globalShortcut.register(accelerator, () => {
        void this.toggleAlwaysOnTop().catch((error: unknown) => {
          console.error('The global always-on-top shortcut failed.', error);
        });
      });
      if (registered) {
        this.registeredAlwaysOnTopAccelerator = accelerator;
      } else {
        console.warn(
          `The global always-on-top shortcut could not be registered: ${accelerator}`,
        );
      }
    } catch (error) {
      console.warn(
        `The global always-on-top shortcut is invalid or unavailable: ${accelerator}`,
        error,
      );
    }
  }

  private async toggleAlwaysOnTop(): Promise<void> {
    const now = Date.now();
    if (now - this.lastAlwaysOnTopToggleAt < 250) return;
    this.lastAlwaysOnTopToggleAt = now;

    const current = this.preferences.get();
    const next = await this.preferences.update({
      alwaysOnTop: !current.alwaysOnTop,
    });
    this.windows.setAlwaysOnTop(next.alwaysOnTop);
  }

  private async runShortFormAction(shortcutId: string): Promise<void> {
    const siteId = this.sites.getCurrentSiteId();
    const contribution = this.sites.getCurrentShortFormVideoContribution();
    if (!siteId || !contribution) return;

    if (shortcutId === 'short-form-video.previous' && contribution.previous) {
      await this.sites.handleAction(SHORT_FORM_VIDEO_ACTIONS.previous);
      return;
    }
    if (shortcutId === 'short-form-video.next' && contribution.next) {
      await this.sites.handleAction(SHORT_FORM_VIDEO_ACTIONS.next);
      return;
    }

    if (shortcutId === 'short-form-video.ban-current-publisher') {
      await this.banCurrentShortFormPublisher(siteId, contribution);
      return;
    }

    if (
      shortcutId !== 'short-form-video.toggle-auto-advance' ||
      !contribution.autoAdvance
    ) {
      return;
    }

    const current = this.preferences.get();
    const providerSettings = { ...current.providerSettings };
    const settings = { ...(providerSettings[siteId] ?? {}) };
    const { defaultValue, settingKey } = contribution.autoAdvance;
    const currentValue = settings[settingKey];
    settings[settingKey] =
      typeof currentValue === 'boolean' ? !currentValue : !defaultValue;
    providerSettings[siteId] = settings;
    await this.preferences.update({ providerSettings });
    await this.sites.applyCurrentProviderSettings();
    await this.sites.handleAction(
      SHORT_FORM_VIDEO_ACTIONS.announceAutoAdvance,
    );
  }

  private refreshShortFormGlobalShortcuts(): void {
    this.unregisterShortFormGlobalShortcuts();
    const contribution = this.sites.getCurrentShortFormVideoContribution();
    if (
      !this.pictureInPictureActive ||
      !contribution
    ) {
      return;
    }

    for (const definition of SHORT_FORM_VIDEO_SHORTCUTS) {
      if (!supportsShortFormShortcut(definition.id, contribution)) continue;
      const accelerator = (
        this.preferences.get().shortcuts[definition.id] ?? definition.defaultKey
      ).trim();
      if (!accelerator || globalShortcut.isRegistered(accelerator)) continue;
      try {
        const registered = globalShortcut.register(accelerator, () => {
          if (!this.pictureInPictureActive) return;
          void this.runShortFormAction(definition.id).catch((error: unknown) => {
            console.error(`The global ${definition.id} shortcut failed.`, error);
          });
        });
        if (registered) {
          this.registeredShortFormAccelerators.set(definition.id, accelerator);
        } else {
          console.warn(
            `The global short-form shortcut could not be registered: ${accelerator}`,
          );
        }
      } catch (error) {
        console.warn(
          `The global short-form shortcut is invalid or unavailable: ${accelerator}`,
          error,
        );
      }
    }
  }

  private async banCurrentShortFormPublisher(
    siteId: string,
    contribution: ShortFormVideoContribution,
  ): Promise<void> {
    const settingKey = contribution.publisherBan?.settingKey;
    if (!settingKey) return;
    const publisher = await this.sites.getCurrentShortFormVideoPublisher();
    if (!publisher?.id.trim()) return;

    const current = this.preferences.get();
    const providerSettings = { ...current.providerSettings };
    const settings = { ...(providerSettings[siteId] ?? {}) };
    const existing = Array.isArray(settings[settingKey])
      ? settings[settingKey] as readonly ProviderSettingListItem[]
      : [];
    if (!existing.some((item) => item.id === publisher.id)) {
      settings[settingKey] = [
        ...existing,
        {
          id: publisher.id,
          label: publisher.label || publisher.id,
          description: publisher.handle,
          imageUrl: publisher.imageUrl,
        },
      ];
      providerSettings[siteId] = settings;
      await this.preferences.update({ providerSettings });
      await this.sites.applyCurrentProviderSettings();
      await this.sites.handleAction(
        SHORT_FORM_VIDEO_ACTIONS.announcePublisherBan,
      );
    }
    if (contribution.next) {
      await this.sites.handleAction(SHORT_FORM_VIDEO_ACTIONS.next);
    }
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

  private unregisterAlwaysOnTopGlobalShortcut(): void {
    const accelerator = this.registeredAlwaysOnTopAccelerator;
    this.registeredAlwaysOnTopAccelerator = undefined;
    if (accelerator && globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
    }
  }

  private unregisterShortFormGlobalShortcuts(): void {
    for (const accelerator of this.registeredShortFormAccelerators.values()) {
      if (globalShortcut.isRegistered(accelerator)) {
        globalShortcut.unregister(accelerator);
      }
    }
    this.registeredShortFormAccelerators.clear();
  }
}

function supportsShortFormShortcut(
  shortcutId: string,
  contribution: ShortFormVideoContribution,
): boolean {
  if (shortcutId === 'short-form-video.previous') return contribution.previous === true;
  if (shortcutId === 'short-form-video.next') return contribution.next === true;
  if (shortcutId === 'short-form-video.toggle-auto-advance') {
    return Boolean(contribution.autoAdvance);
  }
  if (shortcutId === 'short-form-video.ban-current-publisher') {
    return Boolean(contribution.publisherBan);
  }
  return false;
}

function matchesVideoShortcutInput(
  input: Input,
  overrides: Readonly<Record<string, string>>,
): boolean {
  return VIDEO_SHORTCUTS.some(({ id, defaultKey }) => {
    const accelerator = overrides[id] ?? defaultKey;
    if (!accelerator.trim()) return false;
    if (matchesAccelerator(input, accelerator)) return true;

    // Control and Alt can be layered on top of a configured Video shortcut
    // to request a smaller seek distance.
    const variants: Input[] = [];
    if (input.control) variants.push({ ...input, control: false });
    if (input.alt) variants.push({ ...input, alt: false });
    if (input.control && input.alt) {
      variants.push({ ...input, control: false, alt: false });
    }
    return variants.some((variant) => matchesAccelerator(variant, accelerator));
  });
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
  if (input.code === 'Comma') return ',';
  if (input.code === 'Period') return '.';
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
