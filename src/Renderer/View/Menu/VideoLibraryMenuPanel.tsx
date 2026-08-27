import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import type {
  VideoLibraryFolder,
  VideoLibraryMessages,
  VideoLibrarySnapshot,
} from '../../../Common/IPC';
import { VideoThumbnail } from '../../Component/VideoThumbnail';

/** Describes the video library menu panel props contract. */
interface VideoLibraryMenuPanelProps {
  /** The labels value. */
  readonly labels: VideoLibraryMessages;
  /** The refresh key value. */
  readonly refreshKey: number;
  /** Callback used to handle on error. */
  readonly onError: (message: string) => void;
}

/** Describes the folder context menu contract. */
interface FolderContextMenu {
  /** The folder value. */
  readonly folder: VideoLibraryFolder;
  /** The x value. */
  readonly x: number;
  /** The y value. */
  readonly y: number;
}

/** Performs the video library menu panel operation. */
export function VideoLibraryMenuPanel({
  labels,
  refreshKey,
  onError,
}: VideoLibraryMenuPanelProps) {
  const [snapshot, setSnapshot] = useState<VideoLibrarySnapshot>();
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<FolderContextMenu>();
  const [openingPath, setOpeningPath] = useState<string>();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let active = true;
    setLoading(true);
    void window.kawaikara.videoLibrary
      .getSnapshot()
      .then((next) => {
        if (active) setSnapshot(next);
      })
      .catch((reason: unknown) => {
        if (active) onError(getErrorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onError, refreshKey]);

  useEffect(() => {
    if (!contextMenu) return;
    /** Closes the operation. */
    const close = () => setContextMenu(undefined);
    /** Handles the key down. */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [contextMenu]);

  /** Opens the item. */
  const openItem = async (path: string) => {
    if (openingPath) return;
    setContextMenu(undefined);
    setOpeningPath(path);
    if (!reduceMotion) {
      await new Promise((resolve) => window.setTimeout(resolve, 170));
    }
    void window.kawaikara.videoLibrary.openItem(path).catch((reason: unknown) => {
      setOpeningPath(undefined);
      onError(getErrorMessage(reason));
    });
  };

  /** Updates the folder. */
  const updateFolder = async (
    folder: VideoLibraryFolder,
    action: 'pin' | 'remove',
  ) => {
    setContextMenu(undefined);
    try {
      const next = action === 'pin'
        ? await window.kawaikara.videoLibrary.setFolderPinned(
            folder.path,
            !folder.pinned,
          )
        : await window.kawaikara.videoLibrary.removeFolder(folder.path);
      setSnapshot(next);
    } catch (reason) {
      onError(getErrorMessage(reason));
    }
  };

  const folders = [...(snapshot?.recentFolders ?? [])].sort(
    (left, right) => Number(right.pinned) - Number(left.pinned),
  );

  return (
    <>
      <motion.aside
        animate={{ opacity: openingPath ? 0 : 1, x: openingPath ? 18 : 0
        }}
        className="video-library-menu-panel"
        aria-label={labels.title}
        transition={{ duration: reduceMotion ? 0 : 0.17, ease: 'easeOut'
        }}
      >
      <header className="video-library-menu-header">
        <div>
          <span>{labels.eyebrow}</span>
          <h2>{labels.title}</h2>
          <p>{labels.description}</p>
        </div>
        {loading ? <div className="video-library-menu-loading" /> : null}
      </header>

      <div className="video-library-menu-content">
        <section>
          <div className="video-library-section-heading">
            <h3>{labels.folders}</h3>
            <span>{folders.length}</span>
          </div>
          {folders.length > 0 ? (
            <div className="video-library-folder-grid">
              {folders.map((folder) => (
                <button
                  className="video-library-folder-card"
                  key={folder.path}
                  title={folder.path}
                  type="button"
                  disabled={openingPath !== undefined}
                  onClick={() => void openItem(folder.path)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.currentTarget.blur();
                    setContextMenu({
                      folder,
                      x: Math.max(
                        8,
                        Math.min(event.clientX, window.innerWidth - 188),
                      ),
                      y: Math.max(
                        8,
                        Math.min(event.clientY, window.innerHeight - 101),
                      ),
                    });
                  }}
                >
                  <span className="video-library-card-icon" aria-hidden="true">▰</span>
                  <span className="video-library-card-copy">
                    <strong>{folder.name}</strong>
                    <small>{folder.path}</small>
                  </span>
                  {folder.pinned ? (
                    <span className="video-library-pin" title={labels.pinned}>◆</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title={labels.noFolders} description={labels.noFoldersHelp} />
          )}
        </section>

        <section>
          <div className="video-library-section-heading">
            <h3>{labels.videos}</h3>
            <span>{snapshot?.recentVideos.length ?? 0}</span>
          </div>
          {snapshot?.recentVideos.length ? (
            <div className="video-library-video-list">
              {snapshot.recentVideos.map((video) => (
                <button
                  key={video.path}
                  title={video.path}
                  type="button"
                  disabled={openingPath !== undefined}
                  onClick={() => void openItem(video.path)}
                >
                  <VideoThumbnail
                    className="video-library-menu-thumbnail"
                    loadThumbnail={window.kawaikara.videoLibrary.getThumbnail}
                    path={video.path}
                  />
                  <span className="video-library-card-copy">
                    <strong>{video.name}</strong>
                    <small>{video.directory}</small>
                  </span>
                  <time>{formatStoredDate(video.lastOpenedAt)}</time>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title={labels.noVideos} description={labels.noVideosHelp} />
          )}
        </section>
      </div>
      </motion.aside>

      {contextMenu
        ? createPortal(
            <div
              className="kawai-theme-dark video-folder-context-menu"
              role="menu"
              style={{ left: contextMenu.x, top: contextMenu.y
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                role="menuitem"
                type="button"
                onClick={() => void updateFolder(contextMenu.folder, 'pin')}
              >
                {contextMenu.folder.pinned ? labels.unpin : labels.pin}
              </button>
              <button
                className="is-danger"
                role="menuitem"
                type="button"
                onClick={() => void updateFolder(contextMenu.folder, 'remove')}
              >
                {labels.remove}
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Performs the empty state operation. */
function EmptyState({
  title,
  description,
}: {
  /** The title value. */
  readonly title: string;
  /** The description value. */
  readonly description: string;
}
) {
  return (
    <div className="video-library-menu-empty">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

/** Formats the stored date. */
function formatStoredDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** Returns the error message. */
function getErrorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason ?? '');
}
