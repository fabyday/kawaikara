import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { PreferencePatch, PreferenceState } from '../../Common/IPC';
import {
  DEFAULT_PREFERENCES,
  mergeValidatedPreferences,
} from '../Functional/Preferences';

/** Coordinates preference behavior. */
export class PreferenceManager {
  /** The state value. */
  private state: PreferenceState = DEFAULT_PREFERENCES;

  /** Creates an instance of PreferenceManager. */
  constructor(
    /** The file path value. */
    private readonly filePath: string,
  ) {}

  /** Loads the operation. */
  async load(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.filePath, 'utf8')) as unknown;
      this.state = mergeValidatedPreferences(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Preferences could not be loaded; defaults are used.', error);
      }
    }
  }

  /** Returns the operation. */
  get(): PreferenceState {
    return {
      ...this.state,
      /** The picture in picture placement value. */
      pictureInPicturePlacement: {
        ...this.state.pictureInPicturePlacement,
        /** The monitor value. */
        monitor: { ...this.state.pictureInPicturePlacement.monitor
        },
        ...(this.state.pictureInPicturePlacement.lastPlacement
          ? { lastPlacement: { ...this.state.pictureInPicturePlacement.lastPlacement
          }
          }
          : {}),
      },
      /** The picture in picture size value. */
      pictureInPictureSize: { ...this.state.pictureInPictureSize
      },
      /** The picture in picture portrait size value. */
      pictureInPicturePortraitSize: {
        ...this.state.pictureInPicturePortraitSize,
      },
      /** The plugin locales value. */
      pluginLocales: { ...this.state.pluginLocales
      },
      /** The site locales value. */
      siteLocales: { ...this.state.siteLocales
      },
      /** The browser profiles value. */
      browserProfiles: this.state.browserProfiles.map((profile) => ({ ...profile
      })),
      /** The site browser profiles value. */
      siteBrowserProfiles: { ...this.state.siteBrowserProfiles
      },
      /** The provider settings value. */
      providerSettings: Object.fromEntries(
        Object.entries(this.state.providerSettings).map(([providerId, settings]) => [
          providerId,
          Object.fromEntries(
            Object.entries(settings).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.map((item) => ({ ...item
              })) : value,
            ]),
          ),
        ]),
      ),
      /** The menu category order value. */
      menuCategoryOrder: [...this.state.menuCategoryOrder],
      /** The menu site order value. */
      menuSiteOrder: [...this.state.menuSiteOrder],
      /** The shortcuts value. */
      shortcuts: { ...this.state.shortcuts
      },
    };
  }

  /** Updates the operation. */
  async update(patch: unknown): Promise<PreferenceState> {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new TypeError('Preference update must be an object.');
    }
    this.state = mergeValidatedPreferences({
      ...this.state,
      ...(patch as PreferencePatch),
    });
    await mkdir(path.dirname(this.filePath), { recursive: true
    });
    await writeFile(this.filePath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
    return this.get();
  }
}
