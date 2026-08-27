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
import {
  isRepeatableShortFormNavigationShortcut,
  matchesAccelerator,
  matchesVideoShortcutInput,
  supportsShortFormShortcut,
  type ShortcutBinding,
} from '../Functional/Shortcut';
import type { PreferenceManager } from './PreferenceManager';
import type { SiteManager } from './SiteManager';
import type { WindowManager } from './WindowManager';

/** Defines the shared picture in picture shortcut ID constant. */
const PICTURE_IN_PICTURE_SHORTCUT_ID = 'app.toggle-picture-in-picture';
/** Defines the shared always on top shortcut ID constant. */
const ALWAYS_ON_TOP_SHORTCUT_ID = 'app.toggle-always-on-top';

/** Coordinates shortcut behavior. */
export class ShortcutManager {
  /** The last always on top toggle at value. */
  private lastAlwaysOnTopToggleAt = 0;
  /** The last picture in picture toggle at value. */
  private lastPictureInPictureToggleAt = 0;
  /** The picture in picture active value. */
  private pictureInPictureActive = false;
  /** The picture in picture toggle promise value. */
  private pictureInPictureTogglePromise?: Promise<void>;
  /** The registered picture in picture accelerator value. */
  private registeredPictureInPictureAccelerator?: string;
  /** The registered always on top accelerator value. */
  private registeredAlwaysOnTopAccelerator?: string;
  /** The registered short form accelerators value. */
  private readonly registeredShortFormAccelerators = new Map<string, string>();

  /** Creates an instance of ShortcutManager. */
  constructor(
    /** The sites value. */
    private readonly sites: SiteManager,
    /** The Windows value. */
    private readonly windows: WindowManager,
    /** The preferences value. */
    private readonly preferences: PreferenceManager,
  ) {}

  /** Handles the input. */
  handleInput(input: Input, editing = false): boolean {
    if (
      input.type !== 'keyDown' ||
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
    if (
      input.isAutoRepeat &&
      !isRepeatableShortFormNavigationShortcut(binding.id)
    ) {
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

  /** Sets the picture in picture active. */
  setPictureInPictureActive(active: boolean): void {
    this.pictureInPictureActive = active;
    this.refreshGlobalShortcut();
  }

  /** Performs the refresh global shortcut operation. */
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

  /** Releases the operation. */
  dispose(): void {
    this.pictureInPictureActive = false;
    this.unregisterAlwaysOnTopGlobalShortcut();
    this.unregisterPictureInPictureGlobalShortcut();
    this.unregisterShortFormGlobalShortcuts();
  }

  /** Returns the bindings. */
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
      'app.go-back': () => {
        this.windows.goBack();
      },
      'app.go-forward': () => {
        this.windows.goForward();
      },
    };
    const appBindings = APP_SHORTCUTS.map((definition) => ({
      ...definition,
      run: appActions[definition.id],
    })).filter(
      (binding): binding is typeof binding & { run: () => void | Promise<void>
      } =>
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

  /** Returns the picture in picture accelerator. */
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

  /** Returns the always on top accelerator. */
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

  /** Performs the refresh always on top global shortcut operation. */
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

  /** Toggles the always on top. */
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

  /** Runs the short form action. */
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
    const providerSettings = { ...current.providerSettings
    };
    const settings = { ...(providerSettings[siteId] ?? {})
    };
    const { defaultValue, settingKey } = contribution.autoAdvance;
    const currentValue = settings[settingKey];
    settings[settingKey] =
      typeof currentValue === 'boolean' ? !currentValue : !defaultValue;
    providerSettings[siteId] = settings;
    await this.preferences.update({ providerSettings
    });
    await this.sites.applyCurrentProviderSettings();
    await this.sites.handleAction(
      SHORT_FORM_VIDEO_ACTIONS.announceAutoAdvance,
    );
  }

  /** Performs the refresh short form global shortcuts operation. */
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

  /** Performs the ban current short form publisher operation. */
  private async banCurrentShortFormPublisher(
    siteId: string,
    contribution: ShortFormVideoContribution,
  ): Promise<void> {
    const settingKey = contribution.publisherBan?.settingKey;
    if (!settingKey) return;
    const publisher = await this.sites.getCurrentShortFormVideoPublisher();
    if (!publisher?.id.trim()) return;

    const current = this.preferences.get();
    const providerSettings = { ...current.providerSettings
    };
    const settings = { ...(providerSettings[siteId] ?? {})
    };
    const existing = Array.isArray(settings[settingKey])
      ? settings[settingKey] as readonly ProviderSettingListItem[]
      : [];
    const nextItem: ProviderSettingListItem = {
      id: publisher.id,
      label: publisher.label || publisher.id,
      description: publisher.handle,
      imageUrl: publisher.imageUrl,
    };
    const existingIndex = existing.findIndex((item) => item.id === publisher.id);
    const shouldEnrichExisting = existingIndex >= 0 && Boolean(
      (publisher.imageUrl && !existing[existingIndex]?.imageUrl) ||
      (publisher.handle && !existing[existingIndex]?.description),
    );
    if (existingIndex < 0 || shouldEnrichExisting) {
      settings[settingKey] = existingIndex < 0
        ? [...existing, nextItem]
        : existing.map((item, index) => index === existingIndex
          ? {
              ...item,
              label: publisher.label || item.label,
              description: publisher.handle ?? item.description,
              imageUrl: publisher.imageUrl ?? item.imageUrl,
            }
          : item);
      providerSettings[siteId] = settings;
      await this.preferences.update({ providerSettings
      });
      await this.sites.applyCurrentProviderSettings();
      if (existingIndex < 0) {
        await this.sites.handleAction(
          SHORT_FORM_VIDEO_ACTIONS.announcePublisherBan,
        );
      }
    }
    // Applying a newly added ban refreshes the Provider and makes it skip the
    // now-blocked current publisher. Sending `next` as well used to skip both
    // the blocked Short and the following valid Short.
    if (contribution.next && existingIndex >= 0 && !shouldEnrichExisting) {
      await this.sites.handleAction(SHORT_FORM_VIDEO_ACTIONS.next);
    }
  }

  /** Toggles the picture in picture. */
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
    /** Clears the operation. */
    const clear = () => {
      if (this.pictureInPictureTogglePromise === operation) {
        this.pictureInPictureTogglePromise = undefined;
      }
    };
    void operation.then(clear, clear);
    return operation;
  }

  /** Performs the unregister picture in picture global shortcut operation. */
  private unregisterPictureInPictureGlobalShortcut(): void {
    const accelerator = this.registeredPictureInPictureAccelerator;
    this.registeredPictureInPictureAccelerator = undefined;
    if (accelerator && globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
    }
  }

  /** Performs the unregister always on top global shortcut operation. */
  private unregisterAlwaysOnTopGlobalShortcut(): void {
    const accelerator = this.registeredAlwaysOnTopAccelerator;
    this.registeredAlwaysOnTopAccelerator = undefined;
    if (accelerator && globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
    }
  }

  /** Performs the unregister short form global shortcuts operation. */
  private unregisterShortFormGlobalShortcuts(): void {
    for (const accelerator of this.registeredShortFormAccelerators.values()) {
      if (globalShortcut.isRegistered(accelerator)) {
        globalShortcut.unregister(accelerator);
      }
    }
    this.registeredShortFormAccelerators.clear();
  }
}
