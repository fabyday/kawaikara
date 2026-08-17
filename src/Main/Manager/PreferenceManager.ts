import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type {
  AppLocale,
  AppTheme,
  LogLevelPreference,
  PreferencePatch,
  PreferenceState,
  ScopedLocale,
} from '../../Common/IPC';
import {
  BUILD_CHANNEL,
  isReleaseChannel,
  type ReleaseChannel,
} from '../../Common/BuildConfig';
import {
  DEFAULT_PICTURE_IN_PICTURE_SIZE,
  DEFAULT_PICTURE_IN_PICTURE_PLACEMENT,
  DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
  validatePictureInPicturePlacement,
  validatePictureInPicturePortraitSize,
  validatePictureInPictureSize,
} from '../../Common/PictureInPicture';
import {
  DEFAULT_VIDEO_SEEK_SECONDS,
  MAX_VIDEO_SEEK_SECONDS,
  MIN_VIDEO_SEEK_SECONDS,
} from '../../Common/VideoControls';

const DEFAULT_PREFERENCES: PreferenceState = {
  alwaysOnTop: false,
  openMenuOnStartup: false,
  closeMenuOnEscape: true,
  closeMenuOnOutsideClick: true,
  automaticUpdates: false,
  updateChannel: BUILD_CHANNEL,
  defaultSiteId: 'kawaikara.youtube',
  devToolsMode: 'detach',
  appLocale: 'system',
  appTheme: 'dark',
  pictureInPicturePlacement: DEFAULT_PICTURE_IN_PICTURE_PLACEMENT,
  pictureInPicturePortraitSize: DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
  pictureInPictureSize: DEFAULT_PICTURE_IN_PICTURE_SIZE,
  pluginLocales: {},
  siteLocales: {},
  browserProfiles: [],
  siteBrowserProfiles: {},
  menuCategoryOrder: [],
  menuSiteOrder: [],
  videoSeekSeconds: DEFAULT_VIDEO_SEEK_SECONDS,
  videoOverlayHideSeconds: 1.8,
  videoControlsLayout: 'inline',
  videoVolume: 100,
  logLevel: 'info',
  shortcuts: {},
};

export class PreferenceManager {
  private state: PreferenceState = DEFAULT_PREFERENCES;

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.filePath, 'utf8')) as unknown;
      this.state = this.mergeValidated(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Preferences could not be loaded; defaults are used.', error);
      }
    }
  }

  get(): PreferenceState {
    return {
      ...this.state,
      pictureInPicturePlacement: {
        ...this.state.pictureInPicturePlacement,
        monitor: { ...this.state.pictureInPicturePlacement.monitor },
        ...(this.state.pictureInPicturePlacement.lastPlacement
          ? {
              lastPlacement: {
                ...this.state.pictureInPicturePlacement.lastPlacement,
              },
            }
          : {}),
      },
      pictureInPictureSize: { ...this.state.pictureInPictureSize },
      pictureInPicturePortraitSize: {
        ...this.state.pictureInPicturePortraitSize,
      },
      pluginLocales: { ...this.state.pluginLocales },
      siteLocales: { ...this.state.siteLocales },
      browserProfiles: this.state.browserProfiles.map((profile) => ({ ...profile })),
      siteBrowserProfiles: { ...this.state.siteBrowserProfiles },
      menuCategoryOrder: [...this.state.menuCategoryOrder],
      menuSiteOrder: [...this.state.menuSiteOrder],
      shortcuts: { ...this.state.shortcuts },
    };
  }

  async update(patch: unknown): Promise<PreferenceState> {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new TypeError('Preference update must be an object.');
    }

    this.state = this.mergeValidated({ ...this.state, ...(patch as PreferencePatch) });
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
    return this.get();
  }

  private mergeValidated(value: unknown): PreferenceState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ...DEFAULT_PREFERENCES };
    }

    const candidate = value as Partial<Record<keyof PreferenceState, unknown>>;
    return {
      alwaysOnTop:
        typeof candidate.alwaysOnTop === 'boolean'
          ? candidate.alwaysOnTop
          : DEFAULT_PREFERENCES.alwaysOnTop,
      openMenuOnStartup:
        typeof candidate.openMenuOnStartup === 'boolean'
          ? candidate.openMenuOnStartup
          : DEFAULT_PREFERENCES.openMenuOnStartup,
      closeMenuOnEscape:
        typeof candidate.closeMenuOnEscape === 'boolean'
          ? candidate.closeMenuOnEscape
          : DEFAULT_PREFERENCES.closeMenuOnEscape,
      closeMenuOnOutsideClick:
        typeof candidate.closeMenuOnOutsideClick === 'boolean'
          ? candidate.closeMenuOnOutsideClick
          : DEFAULT_PREFERENCES.closeMenuOnOutsideClick,
      automaticUpdates:
        typeof candidate.automaticUpdates === 'boolean'
          ? candidate.automaticUpdates
          : DEFAULT_PREFERENCES.automaticUpdates,
      updateChannel: resolveUpdateChannel(candidate.updateChannel),
      defaultSiteId:
        typeof candidate.defaultSiteId === 'string' && candidate.defaultSiteId.trim()
          ? candidate.defaultSiteId
          : DEFAULT_PREFERENCES.defaultSiteId,
      devToolsMode: isDevToolsMode(candidate.devToolsMode)
        ? candidate.devToolsMode
        : DEFAULT_PREFERENCES.devToolsMode,
      appLocale: isAppLocale(candidate.appLocale)
        ? candidate.appLocale
        : DEFAULT_PREFERENCES.appLocale,
      appTheme: isAppTheme(candidate.appTheme)
        ? candidate.appTheme
        : DEFAULT_PREFERENCES.appTheme,
      pictureInPicturePlacement: validatePictureInPicturePlacement(
        candidate.pictureInPicturePlacement,
      ),
      pictureInPicturePortraitSize: validatePictureInPicturePortraitSize(
        candidate.pictureInPicturePortraitSize,
      ),
      pictureInPictureSize: validatePictureInPictureSize(
        candidate.pictureInPictureSize,
      ),
      pluginLocales: validateLocaleRecord(candidate.pluginLocales),
      siteLocales: validateLocaleRecord(candidate.siteLocales),
      browserProfiles: validateBrowserProfiles(candidate.browserProfiles),
      siteBrowserProfiles: validateBrowserProfileAssignments(
        candidate.siteBrowserProfiles,
      ),
      menuCategoryOrder: validateOrderedIds(candidate.menuCategoryOrder, 160),
      menuSiteOrder: validateOrderedIds(candidate.menuSiteOrder, 320),
      videoSeekSeconds: validateVideoSeekSeconds(candidate.videoSeekSeconds),
      videoOverlayHideSeconds: validateVideoOverlayHideSeconds(
        candidate.videoOverlayHideSeconds,
      ),
      videoControlsLayout:
        candidate.videoControlsLayout === 'overlay' ? 'overlay' : 'inline',
      videoVolume: validateVideoVolume(candidate.videoVolume),
      logLevel: isLogLevel(candidate.logLevel)
        ? candidate.logLevel
        : DEFAULT_PREFERENCES.logLevel,
      shortcuts: validateShortcutRecord(candidate.shortcuts),
    };
  }
}

function validateVideoOverlayHideSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PREFERENCES.videoOverlayHideSeconds;
  }
  return Math.min(30, Math.max(0.5, Math.round(value * 10) / 10));
}

function validateVideoVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PREFERENCES.videoVolume;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function isLogLevel(value: unknown): value is LogLevelPreference {
  return (
    typeof value === 'string' &&
    ['error', 'warn', 'info', 'verbose', 'debug', 'none'].includes(value)
  );
}

function isAppTheme(value: unknown): value is AppTheme {
  return value === 'dark' || value === 'light';
}

function validateVideoSeekSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_VIDEO_SEEK_SECONDS;
  }
  return Math.min(
    MAX_VIDEO_SEEK_SECONDS,
    Math.max(MIN_VIDEO_SEEK_SECONDS, Math.round(value)),
  );
}

function validateOrderedIds(value: unknown, maximumItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || id.length > 160 || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= maximumItems) break;
  }
  return result;
}

function validateBrowserProfiles(
  value: unknown,
): PreferenceState['browserProfiles'] {
  if (!Array.isArray(value)) return [];

  const ids = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    if (
      !id ||
      ids.has(id) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id) ||
      !name ||
      name.length > 80
    ) {
      return [];
    }
    ids.add(id);
    return [{
      id,
      name,
      persistent: candidate.persistent !== false,
    }];
  });
}

function validateBrowserProfileAssignments(
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([siteId, profileId]) =>
        Boolean(siteId.trim()) &&
        siteId.length <= 160 &&
        typeof profileId === 'string' &&
        profileId.length <= 320 &&
        (profileId === 'isolated' ||
          profileId.startsWith('user:') ||
          profileId.startsWith('plugin:')),
    ),
  );
}

function resolveUpdateChannel(value: unknown): ReleaseChannel {
  if (BUILD_CHANNEL === 'nightly') return 'nightly';
  return isReleaseChannel(value) ? value : BUILD_CHANNEL;
}

function isAppLocale(value: unknown): value is AppLocale {
  return ['system', 'ko-KR', 'en-US', 'ja-JP'].includes(String(value));
}

function isDevToolsMode(value: unknown): value is PreferenceState['devToolsMode'] {
  return ['left', 'right', 'bottom', 'undocked', 'detach'].includes(String(value));
}

function isScopedLocale(value: unknown): value is ScopedLocale {
  return (
    value === 'inherit' ||
    isAppLocale(value) ||
    (typeof value === 'string' &&
      /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value))
  );
}

function validateLocaleRecord(value: unknown): Record<string, ScopedLocale> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      ([id, locale]) => Boolean(id.trim()) && isScopedLocale(locale),
    ),
  ) as Record<string, ScopedLocale>;
}

function validateShortcutRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      ([id, shortcut]) =>
        Boolean(id.trim()) &&
        typeof shortcut === 'string' &&
        shortcut.length <= 128,
    ),
  );
}
