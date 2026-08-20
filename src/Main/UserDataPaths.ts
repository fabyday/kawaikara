import path from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';
import { constants, mkdirSync } from 'node:fs';
import { app } from 'electron';
import { BUILD_CHANNEL } from '../Common/BuildConfig';

const legacyUserDataPath = app.getPath('userData');
const userRootPath = BUILD_CHANNEL === 'stable'
  ? legacyUserDataPath
  : path.join(
      path.dirname(legacyUserDataPath),
      `${path.basename(legacyUserDataPath)} ${capitalize(BUILD_CHANNEL)}`,
    );
const electronDataPath = path.join(userRootPath, 'Electron');
const kawaiDataPath = path.join(userRootPath, 'KawaiData');
let configured = false;

export function configureUserDataPaths(): void {
  if (configured) return;
  mkdirSync(electronDataPath, { recursive: true });
  mkdirSync(kawaiDataPath, { recursive: true });
  configured = true;
  app.setPath('userData', electronDataPath);
  app.setPath('sessionData', electronDataPath);
}

export function getKawaiDataPath(...segments: readonly string[]): string {
  return path.join(kawaiDataPath, ...segments);
}

export function getUserDataLayout(): {
  readonly userRoot: string;
  readonly electron: string;
  readonly kawaiData: string;
} {
  return {
    userRoot: userRootPath,
    electron: electronDataPath,
    kawaiData: kawaiDataPath,
  };
}

export async function initializeUserDataLayout(): Promise<void> {
  await Promise.all([
    mkdir(electronDataPath, { recursive: true }),
    mkdir(kawaiDataPath, { recursive: true }),
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

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

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
