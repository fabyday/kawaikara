import type { Dirent } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  VideoDirectoryEntry,
  VideoLibraryFolder,
  VideoLibraryLocation,
  VideoLibraryVideo,
  VideoOpenRequest,
} from '../../Common/IPC';

/** Defines the shared max recent folders constant. */
const MAX_RECENT_FOLDERS = 8;
/** Defines the shared max pinned folders constant. */
const MAX_PINNED_FOLDERS = 32;
/** Defines the shared max recent videos constant. */
export const MAX_RECENT_VIDEOS = 12;
/** Defines the shared max path length constant. */
export const MAX_PATH_LENGTH = 4_096;
/** Defines the shared video file extensions constant. */
const VIDEO_FILE_EXTENSIONS = new Set([
  '.3gp', '.avi', '.flv', '.m2ts', '.m4v', '.mkv', '.mov', '.mp4',
  '.mpeg', '.mpg', '.mts', '.ogv', '.ts', '.webm', '.wmv',
]);

/** Describes the stored video library state contract. */
export interface StoredVideoLibraryState {
  /** The version value. */
  readonly version: 1;
  /** The last directory value. */
  readonly lastDirectory?: string;
  /** The recent folders value. */
  readonly recentFolders: readonly VideoLibraryFolder[];
  /** The recent videos value. */
  readonly recentVideos: readonly VideoLibraryVideo[];
}

/** Describes the standard video location contract. */
export interface StandardVideoLocation {
  /** The name value. */
  readonly name: string;
  /** The path value. */
  readonly path: string;
}

/** Defines the shared empty video library state constant. */
export const EMPTY_VIDEO_LIBRARY_STATE: StoredVideoLibraryState = {
  /** The version value. */
  version: 1,
  /** The recent folders value. */
  recentFolders: [],
  /** The recent videos value. */
  recentVideos: [],
};

/** Validates the stored video library state. */
export function validateStoredVideoLibraryState(
  value: unknown,
): StoredVideoLibraryState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return EMPTY_VIDEO_LIBRARY_STATE;
  }
  const candidate = value as Record<string, unknown>;
  return {
    /** The version value. */
    version: 1,
    /** The last directory value. */
    lastDirectory: validateStoredPath(candidate.lastDirectory),
    /** The recent folders value. */
    recentFolders: trimVideoLibraryFolders(
      validateStoredFolders(candidate.recentFolders),
    ),
    /** The recent videos value. */
    recentVideos: validateStoredVideos(candidate.recentVideos).slice(
      0,
      MAX_RECENT_VIDEOS,
    ),
  };
}

/** Performs the trim video library folders operation. */
export function trimVideoLibraryFolders(
  folders: readonly VideoLibraryFolder[],
): VideoLibraryFolder[] {
  const pinned = folders.filter((folder) => folder.pinned).slice(0, MAX_PINNED_FOLDERS);
  const recent = folders.filter((folder) => !folder.pinned).slice(0, MAX_RECENT_FOLDERS);
  return [...pinned, ...recent].sort(
    (left, right) => Date.parse(right.lastOpenedAt) - Date.parse(left.lastOpenedAt),
  );
}

/** Performs the require absolute video path operation. */
export function requireAbsoluteVideoPath(value: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_PATH_LENGTH) {
    throw new TypeError('An absolute local path is required.');
  }
  const normalized = path.normalize(value.trim());
  if (!path.isAbsolute(normalized)) {
    throw new TypeError('An absolute local path is required.');
  }
  return normalized;
}

/** Determines whether the video path condition applies. */
export function isVideoPath(value: string): boolean {
  return VIDEO_FILE_EXTENSIONS.has(path.extname(value).toLowerCase());
}

/** Determines whether the visible video directory entry condition applies. */
export function isVisibleVideoDirectoryEntry(entry: Dirent): boolean {
  if (entry.isSymbolicLink()) return false;
  return entry.isDirectory() || (entry.isFile() && isVideoPath(entry.name));
}

/** Performs the compare video directory entries operation. */
export function compareVideoDirectoryEntries(
  left: VideoDirectoryEntry,
  right: VideoDirectoryEntry,
): number {
  if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1;
  return left.name.localeCompare(right.name, undefined, {
    /** The numeric value. */
    numeric: true,
  });
}

/** Creates the video entry. */
export async function createVideoEntry(
  filePath: string,
  name: string,
): Promise<VideoDirectoryEntry> {
  try {
    const fileStat = await stat(filePath);
    return {
      /** The kind value. */
      kind: 'video',
      /** The name value. */
      name,
      /** The path value. */
      path: filePath,
      /** The size value. */
      size: fileStat.size,
      /** The modified at value. */
      modifiedAt: fileStat.mtime.toISOString(),
    };
  } catch {
    return {
      /** The kind value. */
      kind: 'video',
      /** The name value. */
      name,
      /** The path value. */
      path: filePath,
    };
  }
}

/** Creates the local video request. */
export function createLocalVideoRequest(
  filePath: string,
): Extract<VideoOpenRequest, {
  /** The kind value. */
  readonly kind: 'local';
}> {
  if (!isVideoPath(filePath)) {
    throw new Error('The selected file is not a supported video.');
  }
  return {
    /** The kind value. */
    kind: 'local',
    /** The display name value. */
    displayName: path.basename(filePath),
    /** The directory value. */
    directory: path.dirname(filePath),
    /** The path value. */
    path: filePath,
    /** The URL value. */
    url: pathToFileURL(filePath).href,
  };
}

/** Returns the directory display name. */
export function getDirectoryDisplayName(directory: string): string {
  const root = path.parse(directory).root;
  if (normalizeVideoPathKey(root) === normalizeVideoPathKey(directory)) {
    return process.platform === 'win32' ? root.replace(/[\\/]$/, '') : root;
  }
  return path.basename(directory) || directory;
}

/** Returns the parent directory. */
export function getParentDirectory(directory: string): string | undefined {
  const parent = path.dirname(directory);
  return normalizeVideoPathKey(parent) === normalizeVideoPathKey(directory)
    ? undefined
    : parent;
}

/** Normalizes the video path key. */
export function normalizeVideoPathKey(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/** Determines whether the directory condition applies. */
export async function isDirectory(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  try {
    return (await stat(value)).isDirectory();
  } catch {
    return false;
  }
}

/** Performs the filter existing folders operation. */
export async function filterExistingFolders(
  folders: readonly VideoLibraryFolder[],
): Promise<VideoLibraryFolder[]> {
  const available = await Promise.all(
    folders.map(async (folder) => ((await isDirectory(folder.path)) ? folder : undefined)),
  );
  return available.filter((folder): folder is VideoLibraryFolder => Boolean(folder));
}

/** Performs the filter existing videos operation. */
export async function filterExistingVideos(
  videos: readonly VideoLibraryVideo[],
): Promise<VideoLibraryVideo[]> {
  const available = await Promise.all(
    videos.map(async (video) => {
      try {
        return (await stat(video.path)).isFile() ? video : undefined;
      } catch {
        return undefined;
      }
    }),
  );
  return available.filter((video): video is VideoLibraryVideo => Boolean(video));
}

/** Lists the drive locations. */
export async function listDriveLocations(): Promise<VideoLibraryLocation[]> {
  if (process.platform !== 'win32') {
    return [{
      /** The kind value. */
      kind: 'drive',
      /** The name value. */
      name: '/',
      /** The path value. */
      path: '/',
    }];
  }
  const candidates = Array.from({ length: 26
  }, (_, index) =>
    `${String.fromCharCode(65 + index)}:\\`,
  );
  const available = await Promise.all(
    candidates.map(async (drive) =>
      (await isDirectory(drive))
        ? { kind: 'drive' as const, name: drive.slice(0, 2), path: drive
        }
        : undefined,
    ),
  );
  return available.filter(
    (location): location is NonNullable<typeof location> => Boolean(location),
  );
}

/** Validates the stored folders. */
function validateStoredFolders(value: unknown): VideoLibraryFolder[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    const folderPath = validateStoredPath(candidate.path);
    const name = validateStoredName(candidate.name);
    const lastOpenedAt = validateStoredDate(candidate.lastOpenedAt);
    if (!folderPath || !name || !lastOpenedAt) return [];
    const key = normalizeVideoPathKey(folderPath);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      name,
      path: folderPath,
      pinned: candidate.pinned === true,
      lastOpenedAt,
    }];
  });
}

/** Validates the stored videos. */
function validateStoredVideos(value: unknown): VideoLibraryVideo[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    const filePath = validateStoredPath(candidate.path);
    const directory = validateStoredPath(candidate.directory);
    const name = validateStoredName(candidate.name);
    const lastOpenedAt = validateStoredDate(candidate.lastOpenedAt);
    if (!filePath || !directory || !name || !lastOpenedAt || !isVideoPath(filePath)) {
      return [];
    }
    const key = normalizeVideoPathKey(filePath);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ name, path: filePath, directory, lastOpenedAt
    }];
  });
}

/** Validates the stored path. */
function validateStoredPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > MAX_PATH_LENGTH) return undefined;
  return path.isAbsolute(value) ? path.normalize(value) : undefined;
}

/** Validates the stored name. */
function validateStoredName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const name = value.trim();
  return name && name.length <= 260 ? name : undefined;
}

/** Validates the stored date. */
function validateStoredDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    return undefined;
  }
  return value;
}
