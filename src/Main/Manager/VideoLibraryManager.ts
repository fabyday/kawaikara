import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { nativeImage } from 'electron';
import type {
  VideoDirectoryEntry,
  VideoDirectoryListing,
  VideoLibraryFolder,
  VideoLibraryLocation,
  VideoLibrarySnapshot,
  VideoLibraryVideo,
  VideoOpenRequest,
  VideoPathOpenResult,
} from '../../Common/IPC';

const MAX_RECENT_FOLDERS = 8;
const MAX_PINNED_FOLDERS = 32;
const MAX_RECENT_VIDEOS = 12;
const MAX_DIRECTORY_ENTRIES = 2_000;
const MAX_SEARCH_RESULTS = 200;
const MAX_SEARCH_DIRECTORIES = 800;
const MAX_SEARCH_ENTRIES = 25_000;
const MAX_PATH_LENGTH = 4_096;
const VIDEO_FILE_EXTENSIONS = new Set([
  '.3gp',
  '.avi',
  '.flv',
  '.m2ts',
  '.m4v',
  '.mkv',
  '.mov',
  '.mp4',
  '.mpeg',
  '.mpg',
  '.mts',
  '.ogv',
  '.ts',
  '.webm',
  '.wmv',
]);

interface StoredVideoLibraryState {
  readonly version: 1;
  readonly lastDirectory?: string;
  readonly recentFolders: readonly VideoLibraryFolder[];
  readonly recentVideos: readonly VideoLibraryVideo[];
}

export interface StandardVideoLocation {
  readonly name: string;
  readonly path: string;
}

const EMPTY_STATE: StoredVideoLibraryState = {
  version: 1,
  recentFolders: [],
  recentVideos: [],
};

export class VideoLibraryManager {
  private state: StoredVideoLibraryState = EMPTY_STATE;
  private readonly thumbnailCache = new Map<string, string | undefined>();

  constructor(
    private readonly filePath: string,
    private readonly standardLocations: readonly StandardVideoLocation[],
  ) {}

  async load(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.filePath, 'utf8')) as unknown;
      this.state = validateStoredState(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Video library state could not be loaded.', error);
      }
    }
  }

  async getSnapshot(): Promise<VideoLibrarySnapshot> {
    const [locations, recentFolders, recentVideos] = await Promise.all([
      this.collectLocations(),
      filterExistingFolders(this.state.recentFolders),
      filterExistingVideos(this.state.recentVideos),
    ]);
    const favoriteFolders = recentFolders.filter((folder) => folder.pinned);
    return {
      lastDirectory: await isDirectory(this.state.lastDirectory)
        ? this.state.lastDirectory
        : undefined,
      locations,
      favoriteFolders,
      recentFolders,
      recentVideos,
    };
  }

  async listDirectory(value: string): Promise<VideoDirectoryListing> {
    const directory = requireAbsolutePath(value);
    const directoryStat = await stat(directory);
    if (!directoryStat.isDirectory()) {
      throw new Error('The selected path is not a directory.');
    }

    const dirents = await readdir(directory, { withFileTypes: true });
    const visible = dirents
      .filter((entry) => isVisibleDirectoryEntry(entry))
      .slice(0, MAX_DIRECTORY_ENTRIES);
    const entries = await Promise.all(
      visible.map((entry) => this.createDirectoryEntry(directory, entry)),
    );
    entries.sort(compareDirectoryEntries);
    await this.recordDirectory(directory);
    return {
      directory,
      displayName: getDirectoryDisplayName(directory),
      parent: getParentDirectory(directory),
      entries,
    };
  }

  async openPath(value: string): Promise<VideoPathOpenResult> {
    const target = requireAbsolutePath(value);
    const targetStat = await stat(target);
    if (targetStat.isDirectory()) {
      return { kind: 'directory', listing: await this.listDirectory(target) };
    }
    if (!targetStat.isFile() || !isVideoPath(target)) {
      throw new Error('The selected path is not a supported video file.');
    }
    const directory = path.dirname(target);
    const request = createLocalVideoRequest(target);
    await this.recordVideo(request);
    return { kind: 'video', directory, request };
  }

  async searchDirectory(
    directoryValue: string,
    queryValue: string,
  ): Promise<VideoDirectoryEntry[]> {
    const root = requireAbsolutePath(directoryValue);
    if (!(await stat(root)).isDirectory()) {
      throw new Error('The search root is not a directory.');
    }
    const query = queryValue.trim().toLocaleLowerCase();
    if (!query) return [];

    const pending = [root];
    const results: VideoDirectoryEntry[] = [];
    let visitedDirectories = 0;
    let visitedEntries = 0;
    while (
      pending.length > 0 &&
      results.length < MAX_SEARCH_RESULTS &&
      visitedDirectories < MAX_SEARCH_DIRECTORIES &&
      visitedEntries < MAX_SEARCH_ENTRIES
    ) {
      const directory = pending.shift();
      if (!directory) break;
      visitedDirectories += 1;
      let entries: Dirent[];
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        visitedEntries += 1;
        if (visitedEntries >= MAX_SEARCH_ENTRIES) break;
        if (entry.isSymbolicLink()) continue;
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          pending.push(entryPath);
          continue;
        }
        if (
          entry.isFile() &&
          isVideoPath(entry.name) &&
          entry.name.toLocaleLowerCase().includes(query)
        ) {
          results.push(await createVideoEntry(entryPath, entry.name));
          if (results.length >= MAX_SEARCH_RESULTS) break;
        }
      }
    }
    return results.sort((left, right) => left.name.localeCompare(right.name));
  }

  async recordVideo(
    request: Extract<VideoOpenRequest, { readonly kind: 'local' }>,
  ): Promise<void> {
    const filePath = requireAbsolutePath(request.path);
    const directory = path.dirname(filePath);
    const now = new Date().toISOString();
    const key = normalizePathKey(filePath);
    const recentVideos = [
      {
        name: request.displayName,
        path: filePath,
        directory,
        lastOpenedAt: now,
      },
      ...this.state.recentVideos.filter(
        (item) => normalizePathKey(item.path) !== key,
      ),
    ].slice(0, MAX_RECENT_VIDEOS);
    this.state = {
      ...this.state,
      lastDirectory: directory,
      recentVideos,
    };
    await this.recordDirectory(directory);
  }

  async setFolderPinned(
    value: string,
    pinned: boolean,
  ): Promise<VideoLibrarySnapshot> {
    const folderPath = requireAbsolutePath(value);
    if (!(await stat(folderPath)).isDirectory()) {
      throw new Error('The selected folder is unavailable.');
    }
    const key = normalizePathKey(folderPath);
    const current = this.state.recentFolders.find(
      (item) => normalizePathKey(item.path) === key,
    );
    const next: VideoLibraryFolder = {
      name: current?.name ?? getDirectoryDisplayName(folderPath),
      path: folderPath,
      pinned,
      lastOpenedAt: current?.lastOpenedAt ?? new Date().toISOString(),
    };
    this.state = {
      ...this.state,
      recentFolders: trimFolders([
        next,
        ...this.state.recentFolders.filter(
          (item) => normalizePathKey(item.path) !== key,
        ),
      ]),
    };
    await this.persist();
    return this.getSnapshot();
  }

  async removeFolder(value: string): Promise<VideoLibrarySnapshot> {
    const folderPath = requireAbsolutePath(value);
    const key = normalizePathKey(folderPath);
    this.state = {
      ...this.state,
      lastDirectory:
        this.state.lastDirectory &&
        normalizePathKey(this.state.lastDirectory) === key
          ? undefined
          : this.state.lastDirectory,
      recentFolders: this.state.recentFolders.filter(
        (item) => normalizePathKey(item.path) !== key,
      ),
    };
    await this.persist();
    return this.getSnapshot();
  }

  async getThumbnail(value: string): Promise<string | undefined> {
    const filePath = requireAbsolutePath(value);
    if (!isVideoPath(filePath)) return undefined;
    const cached = this.thumbnailCache.get(filePath);
    if (cached !== undefined || this.thumbnailCache.has(filePath)) return cached;
    try {
      if (!(await stat(filePath)).isFile()) return undefined;
      const thumbnail = await nativeImage.createThumbnailFromPath(filePath, {
        width: 320,
        height: 180,
      });
      const dataUrl = thumbnail.isEmpty() ? undefined : thumbnail.toDataURL();
      if (this.thumbnailCache.size >= 96) {
        const oldestKey = this.thumbnailCache.keys().next().value as
          | string
          | undefined;
        if (oldestKey) this.thumbnailCache.delete(oldestKey);
      }
      this.thumbnailCache.set(filePath, dataUrl);
      return dataUrl;
    } catch {
      this.thumbnailCache.set(filePath, undefined);
      return undefined;
    }
  }

  createFolderRequest(value: string): Extract<
    VideoOpenRequest,
    { readonly kind: 'folder' }
  > {
    const folderPath = requireAbsolutePath(value);
    return {
      kind: 'folder',
      displayName: getDirectoryDisplayName(folderPath),
      path: folderPath,
    };
  }

  createLocalRequest(value: string): Extract<
    VideoOpenRequest,
    { readonly kind: 'local' }
  > {
    return createLocalVideoRequest(requireAbsolutePath(value));
  }

  private async createDirectoryEntry(
    directory: string,
    entry: Dirent,
  ): Promise<VideoDirectoryEntry> {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return { kind: 'directory', name: entry.name, path: entryPath };
    }
    return createVideoEntry(entryPath, entry.name);
  }

  private async recordDirectory(directory: string): Promise<void> {
    const key = normalizePathKey(directory);
    const current = this.state.recentFolders.find(
      (item) => normalizePathKey(item.path) === key,
    );
    const next: VideoLibraryFolder = {
      name: getDirectoryDisplayName(directory),
      path: directory,
      pinned: current?.pinned ?? false,
      lastOpenedAt: new Date().toISOString(),
    };
    this.state = {
      ...this.state,
      lastDirectory: directory,
      recentFolders: trimFolders([
        next,
        ...this.state.recentFolders.filter(
          (item) => normalizePathKey(item.path) !== key,
        ),
      ]),
    };
    await this.persist();
  }

  private async collectLocations(): Promise<VideoLibraryLocation[]> {
    const candidates: VideoLibraryLocation[] = [
      ...(await listDriveLocations()),
      ...this.standardLocations.map((location) => ({
        ...location,
        kind: 'system' as const,
      })),
    ];
    const seen = new Set<string>();
    const available: VideoLibraryLocation[] = [];
    for (const location of candidates) {
      const key = normalizePathKey(location.path);
      if (seen.has(key) || !(await isDirectory(location.path))) continue;
      seen.add(key);
      available.push(location);
    }
    return available;
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(
      this.filePath,
      `${JSON.stringify(this.state, null, 2)}\n`,
      'utf8',
    );
  }
}

function validateStoredState(value: unknown): StoredVideoLibraryState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return EMPTY_STATE;
  }
  const candidate = value as Record<string, unknown>;
  return {
    version: 1,
    lastDirectory: validateStoredPath(candidate.lastDirectory),
    recentFolders: trimFolders(validateStoredFolders(candidate.recentFolders)),
    recentVideos: validateStoredVideos(candidate.recentVideos).slice(
      0,
      MAX_RECENT_VIDEOS,
    ),
  };
}

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
    const key = normalizePathKey(folderPath);
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
    const key = normalizePathKey(filePath);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ name, path: filePath, directory, lastOpenedAt }];
  });
}

function validateStoredPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > MAX_PATH_LENGTH) return undefined;
  return path.isAbsolute(value) ? path.normalize(value) : undefined;
}

function validateStoredName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const name = value.trim();
  return name && name.length <= 260 ? name : undefined;
}

function validateStoredDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    return undefined;
  }
  return value;
}

function trimFolders(folders: readonly VideoLibraryFolder[]): VideoLibraryFolder[] {
  const pinned = folders.filter((folder) => folder.pinned).slice(0, MAX_PINNED_FOLDERS);
  const recent = folders.filter((folder) => !folder.pinned).slice(0, MAX_RECENT_FOLDERS);
  return [...pinned, ...recent].sort(
    (left, right) => Date.parse(right.lastOpenedAt) - Date.parse(left.lastOpenedAt),
  );
}

function requireAbsolutePath(value: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_PATH_LENGTH) {
    throw new TypeError('An absolute local path is required.');
  }
  const normalized = path.normalize(value.trim());
  if (!path.isAbsolute(normalized)) {
    throw new TypeError('An absolute local path is required.');
  }
  return normalized;
}

function isVideoPath(value: string): boolean {
  return VIDEO_FILE_EXTENSIONS.has(path.extname(value).toLowerCase());
}

function isVisibleDirectoryEntry(entry: Dirent): boolean {
  if (entry.isSymbolicLink()) return false;
  return entry.isDirectory() || (entry.isFile() && isVideoPath(entry.name));
}

function compareDirectoryEntries(
  left: VideoDirectoryEntry,
  right: VideoDirectoryEntry,
): number {
  if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1;
  return left.name.localeCompare(right.name, undefined, { numeric: true });
}

async function createVideoEntry(
  filePath: string,
  name: string,
): Promise<VideoDirectoryEntry> {
  try {
    const fileStat = await stat(filePath);
    return {
      kind: 'video',
      name,
      path: filePath,
      size: fileStat.size,
      modifiedAt: fileStat.mtime.toISOString(),
    };
  } catch {
    return { kind: 'video', name, path: filePath };
  }
}

function createLocalVideoRequest(
  filePath: string,
): Extract<VideoOpenRequest, { readonly kind: 'local' }> {
  if (!isVideoPath(filePath)) {
    throw new Error('The selected file is not a supported video.');
  }
  return {
    kind: 'local',
    displayName: path.basename(filePath),
    directory: path.dirname(filePath),
    path: filePath,
    url: pathToFileURL(filePath).href,
  };
}

function getDirectoryDisplayName(directory: string): string {
  const root = path.parse(directory).root;
  if (normalizePathKey(root) === normalizePathKey(directory)) {
    return process.platform === 'win32'
      ? root.replace(/[\\/]$/, '')
      : root;
  }
  return path.basename(directory) || directory;
}

function getParentDirectory(directory: string): string | undefined {
  const parent = path.dirname(directory);
  return normalizePathKey(parent) === normalizePathKey(directory)
    ? undefined
    : parent;
}

function normalizePathKey(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

async function isDirectory(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  try {
    return (await stat(value)).isDirectory();
  } catch {
    return false;
  }
}

async function filterExistingFolders(
  folders: readonly VideoLibraryFolder[],
): Promise<VideoLibraryFolder[]> {
  const available = await Promise.all(
    folders.map(async (folder) => ((await isDirectory(folder.path)) ? folder : undefined)),
  );
  return available.filter((folder): folder is VideoLibraryFolder => Boolean(folder));
}

async function filterExistingVideos(
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

async function listDriveLocations(): Promise<VideoLibraryLocation[]> {
  if (process.platform !== 'win32') {
    return [{ kind: 'drive', name: '/', path: '/' }];
  }
  const candidates = Array.from({ length: 26 }, (_, index) =>
    `${String.fromCharCode(65 + index)}:\\`,
  );
  const available = await Promise.all(
    candidates.map(async (drive) =>
      (await isDirectory(drive))
        ? { kind: 'drive' as const, name: drive.slice(0, 2), path: drive }
        : undefined,
    ),
  );
  return available.filter(
    (location): location is NonNullable<typeof location> => Boolean(location),
  );
}
