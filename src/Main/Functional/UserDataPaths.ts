import path from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';
import {
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { app } from 'electron';
import { BUILD_CHANNEL } from '../../Common/BuildConfig';

/** Stores the legacy user data path value. */
const legacyUserDataPath = app.getPath('userData');
/** Stores the user root path value. */
const userRootPath = BUILD_CHANNEL === 'stable'
  ? legacyUserDataPath
  : path.join(
      path.dirname(legacyUserDataPath),
      `${path.basename(legacyUserDataPath)} ${capitalize(BUILD_CHANNEL)}`,
    );
/** Stores the Electron data path value. */
const electronDataPath = path.join(userRootPath, 'Electron');
/** Stores the kawai data path value. */
const kawaiDataPath = path.join(userRootPath, 'KawaiData');
/** Stores the pending reset path value. */
const pendingResetPath = path.join(userRootPath, '.pending-data-reset');
/** Stores the configured value. */
let configured = false;

/** Defines the user data reset mode type. */
export type UserDataResetMode = 'cache' | 'application';

/** Defines the shared Electron cache directory names constant. */
const ELECTRON_CACHE_DIRECTORY_NAMES = new Set([
  'Cache',
  'CacheStorage',
  'Code Cache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'GPUCache',
  'GrShaderCache',
  'ShaderCache',
]);

/** Performs the configure user data paths operation. */
export function configureUserDataPaths(): void {
  if (configured) return;
  applyPendingUserDataReset();
  mkdirSync(electronDataPath, { recursive: true
  });
  mkdirSync(kawaiDataPath, { recursive: true
  });
  configured = true;
  app.setPath('userData', electronDataPath);
  app.setPath('sessionData', electronDataPath);
}

/**
 * Defers deletion until the next process starts, before Chromium, logging, or
 * PreferenceManager opens files beneath the data roots.
 */
export function requestUserDataReset(mode: UserDataResetMode): void {
  mkdirSync(userRootPath, { recursive: true
  });
  writeFileSync(pendingResetPath, mode, { encoding: 'utf8', mode: 0o600
  });
}

/** Returns the kawai data path. */
export function getKawaiDataPath(...segments: readonly string[]): string {
  return path.join(kawaiDataPath, ...segments);
}

/** Returns the user data layout. */
export function getUserDataLayout(): {
  /** The user root value. */
  readonly userRoot: string;
  /** The Electron value. */
  readonly electron: string;
  /** The kawai data value. */
  readonly kawaiData: string;
} {
  return {
    /** The user root value. */
    userRoot: userRootPath,
    /** The Electron value. */
    electron: electronDataPath,
    /** The kawai data value. */
    kawaiData: kawaiDataPath,
  };
}

/** Initializes the user data layout. */
export async function initializeUserDataLayout(): Promise<void> {
  await Promise.all([
    mkdir(electronDataPath, { recursive: true
    }),
    mkdir(kawaiDataPath, { recursive: true
    }),
  ]);
  if (BUILD_CHANNEL === 'stable') {
    await Promise.all(
      ['preferences.json', 'video-library.json'].map((fileName) =>
        copyLegacyFileIfNeeded(
          path.join(legacyUserDataPath, fileName),
          path.join(kawaiDataPath, fileName),
        ),
      ),
    );
  }
}

/** Applies the pending user data reset. */
function applyPendingUserDataReset(): void {
  if (!existsSync(pendingResetPath)) return;

  let mode: string;
  try {
    mode = readFileSync(pendingResetPath, 'utf8').trim();
  } catch {
    return;
  }

  if (mode === 'application') {
    rmSync(electronDataPath, { force: true, recursive: true
    });
    rmSync(kawaiDataPath, { force: true, recursive: true
    });
    // Prevent the stable-channel compatibility migration from restoring data
    // that predates the split Electron/KawaiData layout.
    for (const fileName of ['preferences.json', 'video-library.json']) {
      const legacyPath = path.join(legacyUserDataPath, fileName);
      if (legacyPath !== path.join(kawaiDataPath, fileName)) {
        rmSync(legacyPath, { force: true
        });
      }
    }
  } else if (mode === 'cache') {
    removeElectronCacheDirectories(electronDataPath);
  }

  try {
    unlinkSync(pendingResetPath);
  } catch {
    // A completed reset must not fail startup only because its marker vanished.
  }
}

/** Removes the Electron cache directories. */
function removeElectronCacheDirectories(directoryPath: string): void {
  let entries;
  try {
    entries = readdirSync(directoryPath, { withFileTypes: true
    });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const entryPath = path.join(directoryPath, entry.name);
    if (ELECTRON_CACHE_DIRECTORY_NAMES.has(entry.name)) {
      rmSync(entryPath, { force: true, recursive: true
      });
      continue;
    }
    removeElectronCacheDirectories(entryPath);
  }
}

/** Performs the capitalize operation. */
function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

/** Copies the legacy file if needed. */
async function copyLegacyFileIfNeeded(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  if (sourcePath === destinationPath) return;
  try {
    await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'EEXIST') throw error;
  }
}
