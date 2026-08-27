import path from 'node:path';
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
import {
  compareVideoDirectoryEntries,
  createLocalVideoRequest,
  createVideoEntry,
  EMPTY_VIDEO_LIBRARY_STATE,
  filterExistingFolders,
  filterExistingVideos,
  getDirectoryDisplayName,
  getParentDirectory,
  isDirectory,
  isVideoPath,
  isVisibleVideoDirectoryEntry,
  listDriveLocations,
  MAX_RECENT_VIDEOS,
  normalizeVideoPathKey,
  requireAbsoluteVideoPath,
  trimVideoLibraryFolders,
  validateStoredVideoLibraryState,
  type StandardVideoLocation,
  type StoredVideoLibraryState,
} from '../Functional/VideoLibrary';

/** Defines the shared max directory entries constant. */
const MAX_DIRECTORY_ENTRIES = 2_000;
/** Defines the shared max search results constant. */
const MAX_SEARCH_RESULTS = 200;
/** Defines the shared max search directories constant. */
const MAX_SEARCH_DIRECTORIES = 800;
/** Defines the shared max search entries constant. */
const MAX_SEARCH_ENTRIES = 25_000;
/** Coordinates video library behavior. */
export class VideoLibraryManager {
  /** The state value. */
  private state: StoredVideoLibraryState = EMPTY_VIDEO_LIBRARY_STATE;
  /** The thumbnail cache value. */
  private readonly thumbnailCache = new Map<string, string | undefined>();

  /** Creates an instance of VideoLibraryManager. */
  constructor(
    /** The file path value. */
    private readonly filePath: string,
    /** The standard locations value. */
    private readonly standardLocations: readonly StandardVideoLocation[],
  ) {}

  /** Loads the operation. */
  async load(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.filePath, 'utf8')) as unknown;
      this.state = validateStoredVideoLibraryState(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Video library state could not be loaded.', error);
      }
    }
  }

  /** Returns the snapshot. */
  async getSnapshot(): Promise<VideoLibrarySnapshot> {
    const [locations, recentFolders, recentVideos] = await Promise.all([
      this.collectLocations(),
      filterExistingFolders(this.state.recentFolders),
      filterExistingVideos(this.state.recentVideos),
    ]);
    const favoriteFolders = recentFolders.filter((folder) => folder.pinned);
    return {
      /** The last directory value. */
      lastDirectory: await isDirectory(this.state.lastDirectory)
        ? this.state.lastDirectory
        : undefined,
      /** The locations value. */
      locations,
      /** The favorite folders value. */
      favoriteFolders,
      /** The recent folders value. */
      recentFolders,
      /** The recent videos value. */
      recentVideos,
    };
  }

  /** Lists the directory. */
  async listDirectory(value: string): Promise<VideoDirectoryListing> {
    const directory = requireAbsoluteVideoPath(value);
    const directoryStat = await stat(directory);
    if (!directoryStat.isDirectory()) {
      throw new Error('The selected path is not a directory.');
    }

    const dirents = await readdir(directory, { withFileTypes: true
    });
    const visible = dirents
      .filter((entry) => isVisibleVideoDirectoryEntry(entry))
      .slice(0, MAX_DIRECTORY_ENTRIES);
    const entries = await Promise.all(
      visible.map((entry) => this.createDirectoryEntry(directory, entry)),
    );
    entries.sort(compareVideoDirectoryEntries);
    await this.recordDirectory(directory);
    return {
      /** The directory value. */
      directory,
      /** The display name value. */
      displayName: getDirectoryDisplayName(directory),
      /** The parent value. */
      parent: getParentDirectory(directory),
      /** The entries value. */
      entries,
    };
  }

  /** Opens the path. */
  async openPath(value: string): Promise<VideoPathOpenResult> {
    const target = requireAbsoluteVideoPath(value);
    const targetStat = await stat(target);
    if (targetStat.isDirectory()) {
      return {
        /** The kind value. */
        kind: 'directory',
        /** The listing value. */
        listing: await this.listDirectory(target),
      };
    }
    if (!targetStat.isFile() || !isVideoPath(target)) {
      throw new Error('The selected path is not a supported video file.');
    }
    const directory = path.dirname(target);
    const request = createLocalVideoRequest(target);
    await this.recordVideo(request);
    return {
      /** The kind value. */
      kind: 'video',
      /** The directory value. */
      directory,
      /** The request value. */
      request,
    };
  }

  /** Performs the search directory operation. */
  async searchDirectory(
    directoryValue: string,
    queryValue: string,
  ): Promise<VideoDirectoryEntry[]> {
    const root = requireAbsoluteVideoPath(directoryValue);
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
        entries = await readdir(directory, { withFileTypes: true
        });
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

  /** Performs the record video operation. */
  async recordVideo(
    request: Extract<VideoOpenRequest, {
      /** The kind value. */
      readonly kind: 'local';
    }>,
  ): Promise<void> {
    const filePath = requireAbsoluteVideoPath(request.path);
    const directory = path.dirname(filePath);
    const now = new Date().toISOString();
    const key = normalizeVideoPathKey(filePath);
    const recentVideos = [
      {
        name: request.displayName,
        path: filePath,
        directory,
        lastOpenedAt: now,
      },
      ...this.state.recentVideos.filter(
        (item) => normalizeVideoPathKey(item.path) !== key,
      ),
    ].slice(0, MAX_RECENT_VIDEOS);
    this.state = {
      ...this.state,
      lastDirectory: directory,
      recentVideos,
    };
    await this.recordDirectory(directory);
  }

  /** Sets the folder pinned. */
  async setFolderPinned(
    value: string,
    pinned: boolean,
  ): Promise<VideoLibrarySnapshot> {
    const folderPath = requireAbsoluteVideoPath(value);
    if (!(await stat(folderPath)).isDirectory()) {
      throw new Error('The selected folder is unavailable.');
    }
    const key = normalizeVideoPathKey(folderPath);
    const current = this.state.recentFolders.find(
      (item) => normalizeVideoPathKey(item.path) === key,
    );
    const next: VideoLibraryFolder = {
      name: current?.name ?? getDirectoryDisplayName(folderPath),
      path: folderPath,
      pinned,
      lastOpenedAt: current?.lastOpenedAt ?? new Date().toISOString(),
    };
    this.state = {
      ...this.state,
      recentFolders: trimVideoLibraryFolders([
        next,
        ...this.state.recentFolders.filter(
          (item) => normalizeVideoPathKey(item.path) !== key,
        ),
      ]),
    };
    await this.persist();
    return this.getSnapshot();
  }

  /** Removes the folder. */
  async removeFolder(value: string): Promise<VideoLibrarySnapshot> {
    const folderPath = requireAbsoluteVideoPath(value);
    const key = normalizeVideoPathKey(folderPath);
    this.state = {
      ...this.state,
      lastDirectory:
        this.state.lastDirectory &&
        normalizeVideoPathKey(this.state.lastDirectory) === key
          ? undefined
          : this.state.lastDirectory,
      recentFolders: this.state.recentFolders.filter(
        (item) => normalizeVideoPathKey(item.path) !== key,
      ),
    };
    await this.persist();
    return this.getSnapshot();
  }

  /** Returns the thumbnail. */
  async getThumbnail(value: string): Promise<string | undefined> {
    const filePath = requireAbsoluteVideoPath(value);
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

  /** Creates the folder request. */
  createFolderRequest(value: string): Extract<
    VideoOpenRequest,
    {
      /** The kind value. */
      readonly kind: 'folder';
    }
  > {
    const folderPath = requireAbsoluteVideoPath(value);
    return {
      /** The kind value. */
      kind: 'folder',
      /** The display name value. */
      displayName: getDirectoryDisplayName(folderPath),
      /** The path value. */
      path: folderPath,
    };
  }

  /** Creates the local request. */
  createLocalRequest(value: string): Extract<
    VideoOpenRequest,
    {
      /** The kind value. */
      readonly kind: 'local';
    }
  > {
    return createLocalVideoRequest(requireAbsoluteVideoPath(value));
  }

  /** Creates the directory entry. */
  private async createDirectoryEntry(
    directory: string,
    entry: Dirent,
  ): Promise<VideoDirectoryEntry> {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return {
        /** The kind value. */
        kind: 'directory',
        /** The name value. */
        name: entry.name,
        /** The path value. */
        path: entryPath,
      };
    }
    return createVideoEntry(entryPath, entry.name);
  }

  /** Performs the record directory operation. */
  private async recordDirectory(directory: string): Promise<void> {
    const key = normalizeVideoPathKey(directory);
    const current = this.state.recentFolders.find(
      (item) => normalizeVideoPathKey(item.path) === key,
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
      recentFolders: trimVideoLibraryFolders([
        next,
        ...this.state.recentFolders.filter(
          (item) => normalizeVideoPathKey(item.path) !== key,
        ),
      ]),
    };
    await this.persist();
  }

  /** Collects the locations. */
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
      const key = normalizeVideoPathKey(location.path);
      if (seen.has(key) || !(await isDirectory(location.path))) continue;
      seen.add(key);
      available.push(location);
    }
    return available;
  }

  /** Performs the persist operation. */
  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true
    });
    await writeFile(
      this.filePath,
      `${JSON.stringify(this.state, null, 2)}\n`,
      'utf8',
    );
  }
}
