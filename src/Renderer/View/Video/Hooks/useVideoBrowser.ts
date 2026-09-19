import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type {
  VideoDirectoryEntry,
  VideoDirectoryListing,
  VideoLibraryFolder,
  VideoLibrarySnapshot
} from '../../../../Common/IPC';
import { VideoDirectoryHistory } from '../../../../Common/VideoDirectoryHistory';
import { loadVideoThumbnail } from '../../../Domain/VideoThumbnailLoader';
import { getErrorMessage } from '../Browser/BrowserFormatting';
import { BrowserFolderContextMenu, VideoBrowserProps } from '../Browser/Types';

/** Inputs used by useVideoBrowser. */
type VideoBrowserOptions = Pick<VideoBrowserProps,
  | 'labels'
  | 'initialDirectory'
  | 'onOpenVideo'
>;

/** Coordinates video browser behavior for this View. */
export function useVideoBrowser({
  labels,
  initialDirectory,
  onOpenVideo,
}: VideoBrowserOptions) {
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

  return {
    /** The listing value. */
    listing,
    /** The address value. */
    address,
    /** The setAddress value. */
    setAddress,
    /** The query value. */
    query,
    /** The setQuery value. */
    setQuery,
    /** The searchResults value. */
    searchResults,
    /** The setSearchResults value. */
    setSearchResults,
    /** The loading value. */
    loading,
    /** The error value. */
    error,
    /** The contextMenu value. */
    contextMenu,
    /** The setContextMenu value. */
    setContextMenu,
    /** The loadThumbnail value. */
    loadThumbnail,
    /** The loadDirectory value. */
    loadDirectory,
    /** The openPath value. */
    openPath,
    /** The submitAddress value. */
    submitAddress,
    /** The submitSearch value. */
    submitSearch,
    /** The showHome value. */
    showHome,
    /** The setFavorite value. */
    setFavorite,
    /** The entries value. */
    entries,
    /** The drives value. */
    drives,
    /** The favorites value. */
    favorites,
    /** The kawaikaraFavorites value. */
    kawaikaraFavorites,
    /** The favoritePaths value. */
    favoritePaths,
  };
}
