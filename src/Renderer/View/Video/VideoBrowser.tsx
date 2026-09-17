import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type {
  AppTheme,
  VideoBrowserMessages,
  VideoDirectoryEntry,
  VideoDirectoryListing,
  VideoLibraryFolder,
  VideoLibraryLocation,
  VideoLibrarySnapshot,
  VideoOpenRequest,
} from '../../../Common/IPC';
import { VideoDirectoryHistory } from '../../../Common/VideoDirectoryHistory';
import { RightArrowIcon } from '../../Component/RightArrowIcon';
import { VideoThumbnail } from '../../Component/VideoThumbnail';
import {
  VideoHomeIcon,
  VideoSearchIcon,
  VideoUpIcon,
} from '../../Component/VideoIcons';
import { loadVideoThumbnail } from '../../Domain/VideoThumbnailLoader';

/** Describes the browser folder context menu contract. */
interface BrowserFolderContextMenu {
  /** The folder value. */
  readonly folder: VideoLibraryFolder;
  /** The x value. */
  readonly x: number;
  /** The y value. */
  readonly y: number;
}

/** Describes the video browser props contract. */
interface VideoBrowserProps {
  /** The initial directory value. */
  readonly initialDirectory?: string;
  /** The labels value. */
  readonly labels: VideoBrowserMessages;
  /** The theme value. */
  readonly theme: AppTheme;
  /** Whether the close option is enabled. */
  readonly canClose: boolean;
  /** The backend label value. */
  readonly backendLabel: string;
  /** The backend warning value. */
  readonly backendWarning?: string;
  /** Callback used to handle on close. */
  readonly onClose: () => void;
  /** Callback used to handle on open hls. */
  readonly onOpenHls: () => void;
  /** Callback used to handle on open video. */
  readonly onOpenVideo: (
    request: Extract<VideoOpenRequest, {
      /** The kind value. */
      readonly kind: 'local';
    }>,
    directory: string,
  ) => void;
  /** Callback used to handle on select file. */
  readonly onSelectFile: () => Promise<VideoOpenRequest | null>;
}

/** Performs the video browser operation. */
export function VideoBrowser({
  initialDirectory,
  labels,
  theme,
  canClose,
  backendLabel,
  backendWarning,
  onClose,
  onOpenHls,
  onOpenVideo,
  onSelectFile,
}: VideoBrowserProps) {
  const [snapshot, setSnapshot] = useState<VideoLibrarySnapshot>();
  const [listing, setListing] = useState<VideoDirectoryListing>();
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VideoDirectoryEntry[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [contextMenu, setContextMenu] = useState<BrowserFolderContextMenu>();
  const historyRef = useRef(new VideoDirectoryHistory());
  const navigationGenerationRef = useRef(0);
  const historyNavigationQueueRef = useRef<(-1 | 1)[]>([]);
  const historyNavigationRunRef = useRef(0);
  const historyNavigationBusyRef = useRef(false);
  const mountedRef = useRef(true);
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  /** Cancels queued history work without waiting on an inaccessible folder's IPC. */
  const cancelHistoryNavigation = useCallback(() => {
    historyNavigationQueueRef.current.length = 0;
    historyNavigationRunRef.current += 1;
    historyNavigationBusyRef.current = false;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      navigationGenerationRef.current += 1;
    };
  }, []);

  const loadThumbnail = useCallback((path: string) =>
    loadVideoThumbnail(
      path,
      window.kawaikaraVideo.videoLibrary.getThumbnail,
    ), []);

  const refreshSnapshot = useCallback(async () => {
    const next = await window.kawaikaraVideo.videoLibrary.getSnapshot();
    if (mountedRef.current) setSnapshot(next);
    return next;
  }, []);

  const loadDirectory = useCallback(async (directory: string | undefined, offset?: -1 | 1) => {
    if (offset === undefined) cancelHistoryNavigation();
    const generation = ++navigationGenerationRef.current;
    setLoading(true);
    setError(undefined);
    try {
      const next = directory === undefined ? undefined
        : await window.kawaikaraVideo.videoLibrary.listDirectory(directory);
      if (generation !== navigationGenerationRef.current) return false;
      historyRef.current.commit(next?.directory, offset);
      setListing(next);
      setAddress(next?.directory ?? '');
      setQuery('');
      setSearchResults(undefined);
      setContextMenu(undefined);
      void refreshSnapshot().catch(() => undefined);
      return true;
    } catch (reason) {
      if (generation === navigationGenerationRef.current) {
        setError(getErrorMessage(reason, labelsRef.current.folderUnavailable));
      }
      return false;
    } finally {
      if (generation === navigationGenerationRef.current) setLoading(false);
    }
  }, [cancelHistoryNavigation, refreshSnapshot]);

  useEffect(() => {
    let active = true;
    /** Processes rapid physical presses in order, after each successful visit. */
    const drain = async () => {
      if (historyNavigationBusyRef.current) return;
      historyNavigationBusyRef.current = true;
      const run = ++historyNavigationRunRef.current;
      try {
        while (active && run === historyNavigationRunRef.current &&
            historyNavigationQueueRef.current.length > 0) {
          const offset = historyNavigationQueueRef.current.shift()!;
          const target = historyRef.current.target(offset);
          if (target) {
            const loaded = await loadDirectory(target.directory, offset);
            if (run !== historyNavigationRunRef.current) return;
            if (!loaded) historyNavigationQueueRef.current.length = 0;
          }
        }
      } finally {
        if (run === historyNavigationRunRef.current) historyNavigationBusyRef.current = false;
      }
    };
    const unsubscribe = window.kawaikaraVideo.application.onDirectoryNavigationRequested(
      (direction) => {
        historyNavigationQueueRef.current.push(direction === 'back' ? -1 : 1);
        void drain();
      },
    );
    return () => {
      active = false;
      cancelHistoryNavigation();
      unsubscribe();
    };
  }, [cancelHistoryNavigation, loadDirectory]);

  useEffect(() => {
    const generation = ++navigationGenerationRef.current;
    let active = true;
    /** Prevents delayed initialization from overwriting a newer folder visit. */
    const isCurrent = () => active && generation === navigationGenerationRef.current;
    historyRef.current.reset(undefined);
    cancelHistoryNavigation();
    setLoading(true);
    void refreshSnapshot()
      .then(async (next) => {
        if (!isCurrent()) return;
        const startDirectory = initialDirectory ?? next.lastDirectory;
        if (startDirectory) {
          try {
            const initialListing =
              await window.kawaikaraVideo.videoLibrary.listDirectory(
                startDirectory,
              );
            if (!isCurrent()) return;
            historyRef.current.reset(initialListing.directory);
            setListing(initialListing);
            setAddress(initialListing.directory);
          } catch {
            if (isCurrent()) setListing(undefined);
          }
        }
      })
      .catch((reason: unknown) => {
        if (isCurrent()) setError(getErrorMessage(reason, labelsRef.current.folderUnavailable));
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cancelHistoryNavigation, initialDirectory, refreshSnapshot]);

  /** Opens the path. */
  const openPath = async (value: string) => {
    const target = value.trim();
    if (!target) return;
    cancelHistoryNavigation();
    const generation = ++navigationGenerationRef.current;
    setLoading(true);
    setError(undefined);
    try {
      const result = await window.kawaikaraVideo.videoLibrary.openPath(target);
      if (generation !== navigationGenerationRef.current) return;
      if (result.kind === 'directory') {
        historyRef.current.commit(result.listing.directory);
        setListing(result.listing);
        setAddress(result.listing.directory);
        setQuery('');
        setSearchResults(undefined);
      } else {
        // Opening playback must not wait for the parent directory to be read
        // again. Large, disconnected, or permission-limited folders can make
        // that refresh slow or fail even though the selected file is valid.
        onOpenVideo(result.request, result.directory);
      }
      void refreshSnapshot().catch(() => undefined);
    } catch (reason) {
      if (generation === navigationGenerationRef.current) {
        setError(getErrorMessage(reason, labels.pathUnavailable));
      }
    } finally {
      if (generation === navigationGenerationRef.current) setLoading(false);
    }
  };

  /** Performs the submit address operation. */
  const submitAddress = (event: FormEvent) => {
    event.preventDefault();
    void openPath(address);
  };

  /** Performs the submit search operation. */
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!listing || !query.trim()) {
      setSearchResults(undefined);
      return;
    }
    const generation = ++navigationGenerationRef.current;
    setLoading(true);
    setError(undefined);
    void window.kawaikaraVideo.videoLibrary
      .searchDirectory(listing.directory, query)
      .then((results) => {
        if (generation === navigationGenerationRef.current) setSearchResults(results);
      })
      .catch((reason: unknown) => {
        if (generation === navigationGenerationRef.current) {
          setError(getErrorMessage(reason, labels.searchFailed));
        }
      })
      .finally(() => {
        if (generation === navigationGenerationRef.current) setLoading(false);
      });
  };

  /** Performs the show home operation. */
  const showHome = () => {
    void loadDirectory(undefined);
  };

  useEffect(() => {
    if (!contextMenu) return;
    /** Closes the operation. */
    const close = () => setContextMenu(undefined);
    /** Handles the key down. */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [contextMenu]);

  /** Sets the favorite. */
  const setFavorite = async (folder: VideoLibraryFolder, pinned: boolean) => {
    setContextMenu(undefined);
    try {
      setSnapshot(
        await window.kawaikaraVideo.videoLibrary.setFolderPinned(
          folder.path,
          pinned,
        ),
      );
    } catch (reason) {
      setError(getErrorMessage(reason, labels.favoriteFailed));
    }
  };

  const entries = searchResults ?? listing?.entries ?? [];
  const drives = snapshot?.locations.filter((item) => item.kind === 'drive') ?? [];
  const favorites = snapshot?.locations.filter((item) => item.kind === 'system') ?? [];
  const kawaikaraFavorites = snapshot?.favoriteFolders.map((folder) => ({
    kind: 'pinned' as const,
    name: folder.name,
    path: folder.path,
  })) ?? [];
  const favoritePaths = new Set(snapshot?.favoriteFolders.map((folder) => folder.path));

  return (
    <>
    <section className="video-browser" aria-label={labels.library}>
      <div className="video-browser-surface">
        <header className="video-browser-header">
          <div>
            <span className="video-browser-eyebrow">{labels.library}</span>
            <h1>{listing?.displayName ?? labels.computer}</h1>
            <p>{listing?.directory ?? labels.description}</p>
          </div>
          <div className="video-browser-header-actions">
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget.blur();
                onOpenHls();
              }}
            >
              {labels.hls}
            </button>
            {canClose ? (
              <button type="button" onClick={onClose}>{labels.close}</button>
            ) : null}
          </div>
        </header>

        <div className="video-browser-toolbar">
          <button
            aria-label={labels.home}
            className="video-icon-button"
            type="button"
            onClick={showHome}
          >
            <VideoHomeIcon className="video-browser-action-icon" />
          </button>
          <button
            className="video-icon-button"
            type="button"
            disabled={!listing?.parent}
            onClick={() => listing?.parent && void loadDirectory(listing.parent)}
            aria-label={labels.up}
          >
            <VideoUpIcon className="video-browser-action-icon" />
          </button>
          <form className="video-browser-address" onSubmit={submitAddress}>
            <input
              aria-label={labels.address}
              placeholder={labels.addressPlaceholder}
              spellCheck={false}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
            <button
              aria-label={labels.go}
              className="video-icon-button"
              title={labels.go}
              type="submit"
            >
              <RightArrowIcon className="video-browser-action-icon" />
            </button>
          </form>
          {listing ? (
            <form className="video-browser-search" onSubmit={submitSearch}>
              <input
                aria-label={labels.search}
                placeholder={labels.searchPlaceholder}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (!event.target.value) setSearchResults(undefined);
                }}
              />
              <button
                aria-label={labels.search}
                className="video-icon-button"
                type="submit"
              >
                <VideoSearchIcon className="video-browser-action-icon" />
              </button>
            </form>
          ) : null}
        </div>

        <div className="video-browser-content">
          {loading ? <div className="video-browser-loading" /> : null}
          {error ? <p className="video-browser-error" role="alert">{error}</p> : null}

          {!listing ? (
            <div className="video-browser-home">
              <LocationSection
                title={labels.drives}
                locations={drives}
                emptyLabel={labels.noDrives}
                onOpen={(directory) => void loadDirectory(directory)}
              />
              <LocationSection
                title={labels.favorites}
                locations={favorites}
                emptyLabel={labels.noFavorites}
                onOpen={(directory) => void loadDirectory(directory)}
              />
              <LocationSection
                title={labels.kawaikaraFavorites}
                locations={kawaikaraFavorites}
                emptyLabel={labels.noKawaikaraFavorites}
                onOpen={(directory) => void loadDirectory(directory)}
              />
              <button
                className="video-browser-select-file"
                type="button"
                onClick={() => {
                  void onSelectFile().then((request) => {
                    if (request?.kind === 'local') {
                      onOpenVideo(request, request.directory);
                    }
                  });
                }}
              >
                <span aria-hidden="true">＋</span>
                <strong>{labels.selectFile}</strong>
                <small>{labels.selectFileDescription}</small>
              </button>
            </div>
          ) : entries.length > 0 ? (
            <div className="video-browser-grid">
              {entries.map((entry) => (
                <button
                  className={`video-browser-entry is-${entry.kind}`}
                  key={entry.path}
                  title={entry.path}
                  type="button"
                  onClick={() => {
                    if (entry.kind === 'directory') void loadDirectory(entry.path);
                    else void openPath(entry.path);
                  }}
                  onContextMenu={(event) => {
                    if (entry.kind !== 'directory') return;
                    event.preventDefault();
                    const pinned = favoritePaths.has(entry.path);
                    setContextMenu({
                      folder: {
                        name: entry.name,
                        path: entry.path,
                        pinned,
                        lastOpenedAt: new Date().toISOString(),
                      },
                      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 218)),
                      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 58)),
                    });
                  }}
                >
                  {entry.kind === 'directory' ? (
                    <span className="video-browser-entry-icon" aria-hidden="true">▰</span>
                  ) : (
                    <VideoThumbnail
                      className="video-browser-thumbnail"
                      loadThumbnail={loadThumbnail}
                      path={entry.path}
                    />
                  )}
                  <span className="video-browser-entry-copy">
                    <strong>{entry.name}</strong>
                    <small>
                      {entry.kind === 'directory'
                        ? labels.folder
                        : formatFileSize(entry.size)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="video-browser-empty">
              <span aria-hidden="true">◇</span>
              <strong>{searchResults ? labels.noSearchResults : labels.emptyFolder}</strong>
              <p>{searchResults ? labels.noSearchDescription : labels.emptyDescription}</p>
            </div>
          )}
        </div>

        <footer className="video-browser-footer">
          <span>{backendLabel}</span>
          {backendWarning ? <span className="is-warning">{backendWarning}</span> : null}
          <span>{labels.supportedFiles}</span>
        </footer>
      </div>
    </section>
    {contextMenu
      ? createPortal(
          <div
            className={`kawai-theme video-browser-context-menu ${
              theme === 'dark' ? 'kawai-theme-dark' : 'kawai-theme-light'
            }`}
            role="menu"
            style={{ left: contextMenu.x, top: contextMenu.y
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => void setFavorite(contextMenu.folder, !contextMenu.folder.pinned)}
            >
              {contextMenu.folder.pinned
                ? labels.removeKawaikaraFavorite
                : labels.addKawaikaraFavorite}
            </button>
          </div>,
          document.body,
        )
      : null}
    </>
  );
}

/** Performs the location section operation. */
function LocationSection({
  title,
  locations,
  emptyLabel,
  onOpen,
}: {
  /** The title value. */
  readonly title: string;
  /** The locations value. */
  readonly locations: readonly VideoLibraryLocation[];
  /** The empty label value. */
  readonly emptyLabel: string;
  /** Callback used to handle on open. */
  readonly onOpen: (path: string) => void;
}
) {
  return (
    <section className="video-browser-location-section">
      <h2>{title}</h2>
      {locations.length > 0 ? (
        <div className="video-browser-location-grid">
          {locations.map((location) => (
            <button
              key={`${location.kind}:${location.path}`}
              title={location.path}
              type="button"
              onClick={() => onOpen(location.path)}
            >
              <span aria-hidden="true">{location.kind === 'drive' ? '▣' : '▰'}</span>
              <strong>{location.name}</strong>
              <small>{location.path}</small>
            </button>
          ))}
        </div>
      ) : (
        <p className="video-browser-location-empty">{emptyLabel}</p>
      )}
    </section>
  );
}

/** Formats the file size. */
function formatFileSize(value: number | undefined): string {
  if (!Number.isFinite(value) || !value) return 'Video';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

/** Returns the error message. */
function getErrorMessage(reason: unknown, fallback: string): string {
  const message = reason instanceof Error ? reason.message.trim() : String(reason ?? '').trim();
  return message || fallback;
}
