import { readFileSync } from 'node:fs';
import { BUILD_CHANNEL, type ReleaseChannel } from '../../Common/BuildConfig';
import type {
  AppLocale,
  AppTheme,
  GraphicsMode,
  LogLevelPreference,
  PreferenceState,
  ProviderSettingValue,
  ScopedLocale,
} from '../../Common/IPC';
import {
  DEFAULT_PICTURE_IN_PICTURE_PLACEMENT,
  DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
  DEFAULT_PICTURE_IN_PICTURE_SIZE,
  validatePictureInPicturePlacement,
  validatePictureInPicturePortraitSize,
  validatePictureInPictureSize,
} from '../../Common/PictureInPicture';
import {
  DEFAULT_VIDEO_SEEK_SECONDS,
  MAX_VIDEO_SEEK_SECONDS,
  MIN_VIDEO_SEEK_SECONDS,
} from '../../Common/VideoControls';
import { validateDevelopmentInspectorPort } from './DevelopmentValidation';

/** Defines the shared default preferences constant. */
export const DEFAULT_PREFERENCES: PreferenceState = {
  /** The always on top value. */
  alwaysOnTop: false,
  /** The graphics mode value. */
  graphicsMode: 'capture',
  /** The open menu on startup value. */
  openMenuOnStartup: false,
  /** The close menu on escape value. */
  closeMenuOnEscape: true,
  /** The close menu on outside click value. */
  closeMenuOnOutsideClick: true,
  /** The automatic updates value. */
  automaticUpdates: true,
  /** The update channel value. */
  updateChannel: BUILD_CHANNEL,
  /** The default site ID value. */
  defaultSiteId: 'kawaikara.youtube',
  /** The dev tools mode value. */
  devToolsMode: 'detach',
  /** The open dev tools automatically value. */
  openDevToolsAutomatically: false,
  /** The development mode value. */
  developmentMode: false,
  /** The development inspector enabled value. */
  developmentInspectorEnabled: false,
  /** The development inspector port value. */
  developmentInspectorPort: 9230,
  /** The app locale value. */
  appLocale: 'system',
  /** The app theme value. */
  appTheme: 'dark',
  /** The picture in picture placement value. */
  pictureInPicturePlacement: DEFAULT_PICTURE_IN_PICTURE_PLACEMENT,
  /** The picture in picture portrait size value. */
  pictureInPicturePortraitSize: DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
  /** The picture in picture size value. */
  pictureInPictureSize: DEFAULT_PICTURE_IN_PICTURE_SIZE,
  /** The plugin locales value. */
  pluginLocales: {},
  /** The site locales value. */
  siteLocales: {},
  /** The browser profiles value. */
  browserProfiles: [],
  /** The site browser profiles value. */
  siteBrowserProfiles: {},
  /** The provider settings value. */
  providerSettings: {},
  /** The menu category order value. */
  menuCategoryOrder: [],
  /** The menu site order value. */
  menuSiteOrder: [],
  /** The video seek seconds value. */
  videoSeekSeconds: DEFAULT_VIDEO_SEEK_SECONDS,
  /** The video overlay hide seconds value. */
  videoOverlayHideSeconds: 1.8,
  /** The video controls layout value. */
  videoControlsLayout: 'inline',
  /** The video volume value. */
  videoVolume: 100,
  /** The log level value. */
  logLevel: 'info',
  /** The shortcuts value. */
  shortcuts: {},
};

/** Merges the validated preferences. */
export function mergeValidatedPreferences(value: unknown): PreferenceState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_PREFERENCES
    };
  }
  const candidate = value as Partial<Record<keyof PreferenceState, unknown>>;
  return {
    /** The always on top value. */
    alwaysOnTop: typeof candidate.alwaysOnTop === 'boolean'
      ? candidate.alwaysOnTop
      : DEFAULT_PREFERENCES.alwaysOnTop,
    /** The graphics mode value. */
    graphicsMode: resolveGraphicsMode(candidate.graphicsMode, value),
    /** The open menu on startup value. */
    openMenuOnStartup: typeof candidate.openMenuOnStartup === 'boolean'
      ? candidate.openMenuOnStartup
      : DEFAULT_PREFERENCES.openMenuOnStartup,
    /** The close menu on escape value. */
    closeMenuOnEscape: typeof candidate.closeMenuOnEscape === 'boolean'
      ? candidate.closeMenuOnEscape
      : DEFAULT_PREFERENCES.closeMenuOnEscape,
    /** The close menu on outside click value. */
    closeMenuOnOutsideClick: typeof candidate.closeMenuOnOutsideClick === 'boolean'
      ? candidate.closeMenuOnOutsideClick
      : DEFAULT_PREFERENCES.closeMenuOnOutsideClick,
    /** The automatic updates value. */
    automaticUpdates: typeof candidate.automaticUpdates === 'boolean'
      ? candidate.automaticUpdates
      : DEFAULT_PREFERENCES.automaticUpdates,
    /** The update channel value. */
    updateChannel: resolveUpdateChannel(candidate.updateChannel),
    /** The default site ID value. */
    defaultSiteId: typeof candidate.defaultSiteId === 'string' &&
        candidate.defaultSiteId.trim()
      ? candidate.defaultSiteId
      : DEFAULT_PREFERENCES.defaultSiteId,
    /** The dev tools mode value. */
    devToolsMode: isDevToolsMode(candidate.devToolsMode)
      ? candidate.devToolsMode
      : DEFAULT_PREFERENCES.devToolsMode,
    /** The open dev tools automatically value. */
    openDevToolsAutomatically:
      typeof candidate.openDevToolsAutomatically === 'boolean'
        ? candidate.openDevToolsAutomatically
        : DEFAULT_PREFERENCES.openDevToolsAutomatically,
    /** The development mode value. */
    developmentMode: typeof candidate.developmentMode === 'boolean'
      ? candidate.developmentMode
      : DEFAULT_PREFERENCES.developmentMode,
    /** The development inspector enabled value. */
    developmentInspectorEnabled:
      typeof candidate.developmentInspectorEnabled === 'boolean'
        ? candidate.developmentInspectorEnabled
        : DEFAULT_PREFERENCES.developmentInspectorEnabled,
    /** The development inspector port value. */
    developmentInspectorPort: validateDevelopmentInspectorPort(
      candidate.developmentInspectorPort,
      DEFAULT_PREFERENCES.developmentInspectorPort,
    ),
    /** The app locale value. */
    appLocale: isAppLocale(candidate.appLocale)
      ? candidate.appLocale
      : DEFAULT_PREFERENCES.appLocale,
    /** The app theme value. */
    appTheme: isAppTheme(candidate.appTheme)
      ? candidate.appTheme
      : DEFAULT_PREFERENCES.appTheme,
    /** The picture in picture placement value. */
    pictureInPicturePlacement: validatePictureInPicturePlacement(
      candidate.pictureInPicturePlacement,
    ),
    /** The picture in picture portrait size value. */
    pictureInPicturePortraitSize: validatePictureInPicturePortraitSize(
      candidate.pictureInPicturePortraitSize,
    ),
    /** The picture in picture size value. */
    pictureInPictureSize: validatePictureInPictureSize(
      candidate.pictureInPictureSize,
    ),
    /** The plugin locales value. */
    pluginLocales: validateLocaleRecord(candidate.pluginLocales),
    /** The site locales value. */
    siteLocales: validateLocaleRecord(candidate.siteLocales),
    /** The browser profiles value. */
    browserProfiles: validateBrowserProfiles(candidate.browserProfiles),
    /** The site browser profiles value. */
    siteBrowserProfiles: validateBrowserProfileAssignments(
      candidate.siteBrowserProfiles,
    ),
    /** The provider settings value. */
    providerSettings: validateProviderSettings(candidate.providerSettings),
    /** The menu category order value. */
    menuCategoryOrder: validateOrderedIds(candidate.menuCategoryOrder, 160),
    /** The menu site order value. */
    menuSiteOrder: validateOrderedIds(candidate.menuSiteOrder, 320),
    /** The video seek seconds value. */
    videoSeekSeconds: validateVideoSeekSeconds(candidate.videoSeekSeconds),
    /** The video overlay hide seconds value. */
    videoOverlayHideSeconds: validateVideoOverlayHideSeconds(
      candidate.videoOverlayHideSeconds,
    ),
    /** The video controls layout value. */
    videoControlsLayout: candidate.videoControlsLayout === 'overlay'
      ? 'overlay'
      : 'inline',
    /** The video volume value. */
    videoVolume: validateVideoVolume(candidate.videoVolume),
    /** The log level value. */
    logLevel: isLogLevel(candidate.logLevel)
      ? candidate.logLevel
      : DEFAULT_PREFERENCES.logLevel,
    /** The shortcuts value. */
    shortcuts: validateShortcutRecord(candidate.shortcuts),
  };
}

/** Reads the startup graphics mode. */
export function readStartupGraphicsMode(filePath: string): GraphicsMode {
  try {
    const value = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return DEFAULT_PREFERENCES.graphicsMode;
    }
    return resolveGraphicsMode(
      (value as { readonly graphicsMode?: unknown
      }).graphicsMode,
      value,
    );
  } catch {
    return DEFAULT_PREFERENCES.graphicsMode;
  }
}

/** Resolves the graphics mode. */
function resolveGraphicsMode(value: unknown, source?: unknown): GraphicsMode {
  if (value === 'native' || value === 'capture' || value === 'software') {
    return value;
  }
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const legacy = (source as { readonly enableGpuAcceleration?: unknown
    })
      .enableGpuAcceleration;
    if (legacy === true) return 'native';
    if (legacy === false) return 'capture';
  }
  return DEFAULT_PREFERENCES.graphicsMode;
}

/** Validates the video overlay hide seconds. */
function validateVideoOverlayHideSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PREFERENCES.videoOverlayHideSeconds;
  }
  return Math.min(30, Math.max(0.5, Math.round(value * 10) / 10));
}

/** Validates the video volume. */
function validateVideoVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PREFERENCES.videoVolume;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Determines whether the log level condition applies. */
function isLogLevel(value: unknown): value is LogLevelPreference {
  return typeof value === 'string' &&
    ['error', 'warn', 'info', 'verbose', 'debug', 'none'].includes(value);
}

/** Determines whether the app theme condition applies. */
function isAppTheme(value: unknown): value is AppTheme {
  return value === 'dark' || value === 'light';
}

/** Validates the video seek seconds. */
function validateVideoSeekSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_VIDEO_SEEK_SECONDS;
  }
  return Math.min(
    MAX_VIDEO_SEEK_SECONDS,
    Math.max(MIN_VIDEO_SEEK_SECONDS, Math.round(value)),
  );
}

/** Validates the ordered IDs. */
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

/** Validates the browser profiles. */
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
      !id || ids.has(id) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id) ||
      !name || name.length > 80
    ) {
      return [];
    }
    ids.add(id);
    return [{ id, name, persistent: candidate.persistent !== false
    }];
  });
}

/** Validates the browser profile assignments. */
function validateBrowserProfileAssignments(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([siteId, profileId]) =>
        Boolean(siteId.trim()) && siteId.length <= 160 &&
        typeof profileId === 'string' && profileId.length <= 320 &&
        (profileId === 'isolated' || profileId.startsWith('user:') ||
          profileId.startsWith('plugin:')),
    ),
  );
}

/** Validates the provider settings. */
function validateProviderSettings(
  value: unknown,
): PreferenceState['providerSettings'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const providers: Record<string, Record<string, ProviderSettingValue>> = {};
  for (const [providerId, rawSettings] of Object.entries(value).slice(0, 200)) {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(providerId) ||
      !rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)
    ) {
      continue;
    }
    const settings: Record<string, ProviderSettingValue> = {};
    for (const [key, setting] of Object.entries(rawSettings).slice(0, 100)) {
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(key)) continue;
      if (
        setting === null || typeof setting === 'boolean' ||
        typeof setting === 'string' ||
        (typeof setting === 'number' && Number.isFinite(setting))
      ) {
        settings[key] = setting;
      } else if (Array.isArray(setting)) {
        const seen = new Set<string>();
        settings[key] = setting.flatMap((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
          const candidate = item as Record<string, unknown>;
          const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
          const label = typeof candidate.label === 'string'
            ? candidate.label.trim()
            : '';
          const description = typeof candidate.description === 'string'
            ? candidate.description.trim().slice(0, 160)
            : undefined;
          const imageUrl = typeof candidate.imageUrl === 'string' &&
            /^https:\/\//i.test(candidate.imageUrl)
            ? candidate.imageUrl.slice(0, 2_048)
            : undefined;
          if (!id || id.length > 256 || seen.has(id)) return [];
          seen.add(id);
          return [{
            id,
            label: (label || id).slice(0, 160),
            description,
            imageUrl,
          }];
        }).slice(0, 500);
      }
    }
    if (Object.keys(settings).length > 0) providers[providerId] = settings;
  }
  return providers;
}

/** Resolves the update channel. */
function resolveUpdateChannel(_value: unknown): ReleaseChannel {
  return BUILD_CHANNEL;
}

/** Determines whether the app locale condition applies. */
function isAppLocale(value: unknown): value is AppLocale {
  return ['system', 'ko-KR', 'en-US', 'ja-JP'].includes(String(value));
}

/** Determines whether the dev tools mode condition applies. */
function isDevToolsMode(value: unknown): value is PreferenceState['devToolsMode'] {
  return ['left', 'right', 'bottom', 'undocked', 'detach'].includes(String(value));
}

/** Determines whether the scoped locale condition applies. */
function isScopedLocale(value: unknown): value is ScopedLocale {
  return value === 'inherit' || isAppLocale(value) ||
    (typeof value === 'string' &&
      /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value));
}

/** Validates the locale record. */
function validateLocaleRecord(value: unknown): Record<string, ScopedLocale> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([id, locale]) => Boolean(id.trim()) && isScopedLocale(locale),
    ),
  ) as Record<string, ScopedLocale>;
}

/** Validates the shortcut record. */
function validateShortcutRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([id, shortcut]) =>
        Boolean(id.trim()) && typeof shortcut === 'string' && shortcut.length <= 128,
    ),
  );
}
