import { createPortal } from 'react-dom';
import { RightArrowIcon } from '../../Component/RightArrowIcon';
import {
  VideoHomeIcon,
  VideoSearchIcon,
  VideoUpIcon,
} from './VideoIcons';
import { VideoThumbnail } from '../../Component/VideoThumbnail';
import { formatFileSize } from './Browser/BrowserFormatting';
import { LocationSection } from './Browser/LocationSection';
import { VideoBrowserProps } from './Browser/Types';
import { useVideoBrowser } from './Hooks/useVideoBrowser';

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

  const videoBrowser = useVideoBrowser({
    labels,
    initialDirectory,
    onOpenVideo,
  });
  const {
    listing,
    address,
    setAddress,
    query,
    setQuery,
    searchResults,
    setSearchResults,
    loading,
    error,
    contextMenu,
    setContextMenu,
    loadThumbnail,
    loadDirectory,
    openPath,
    submitAddress,
    submitSearch,
    showHome,
    setFavorite,
    entries,
    drives,
    favorites,
    kawaikaraFavorites,
    favoritePaths,
  } = videoBrowser;

  return (
    <>
      <section className="video-browser" aria-label={labels.library}>
        <div className="video-browser-surface">
          <VideoBrowserHeader
            labels={labels}
            canClose={canClose}
            onClose={onClose}
            onOpenHls={onOpenHls}
            listing={listing}
          />

          <VideoBrowserToolbar
            labels={labels}
            listing={listing}
            address={address}
            setAddress={setAddress}
            query={query}
            setQuery={setQuery}
            setSearchResults={setSearchResults}
            loadDirectory={loadDirectory}
            submitAddress={submitAddress}
            submitSearch={submitSearch}
            showHome={showHome}
          />

          <div className="video-browser-content">
            {loading ? <div className="video-browser-loading" /> : null}
            {error ? <p className="video-browser-error" role="alert">{error}</p> : null}

            {!listing ? (
              <VideoBrowserHome
                labels={labels}
                onOpenVideo={onOpenVideo}
                onSelectFile={onSelectFile}
                loadDirectory={loadDirectory}
                drives={drives}
                favorites={favorites}
                kawaikaraFavorites={kawaikaraFavorites}
              />
            ) : entries.length > 0 ? (
              <div className="video-browser-grid">
                {entries.map((entry) => (
                  <VideoDirectoryItem
                    key={entry.path}
                    labels={labels}
                    setContextMenu={setContextMenu}
                    loadThumbnail={loadThumbnail}
                    loadDirectory={loadDirectory}
                    openPath={openPath}
                    favoritePaths={favoritePaths}
                    entry={entry}
                  />
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
            className={`kawai-theme video-browser-context-menu ${theme === 'dark' ? 'kawai-theme-dark' : 'kawai-theme-light'
              }`}
            role="menu"
            style={{
              left: contextMenu.x, top: contextMenu.y
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

/** Current directory identity and video-source actions. */
function VideoBrowserHeader({
  labels,
  canClose,
  onClose,
  onOpenHls,
  listing,
}: Pick<VideoBrowserProps, 'labels' | 'canClose' | 'onClose' | 'onOpenHls'> & Pick<ReturnType<typeof useVideoBrowser>, 'listing'>) {
  return (
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
  );
}

/** Navigates directly to a directory or a local video path. */
function DirectoryAddressForm({
  labels,
  address,
  setAddress,
  submitAddress,
}: Pick<VideoBrowserProps, 'labels'> & Pick<ReturnType<typeof useVideoBrowser>, 'address' | 'setAddress' | 'submitAddress'>) {
  return (
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
  );
}

/** Searches the current directory and clears stale results with the query. */
function DirectorySearchForm({
  labels,
  query,
  setQuery,
  setSearchResults,
  submitSearch,
}: Pick<VideoBrowserProps, 'labels'> & Pick<ReturnType<typeof useVideoBrowser>, 'query' | 'setQuery' | 'setSearchResults' | 'submitSearch'>) {
  return (
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
  );
}

/** Composes directory navigation, path entry, and search controls. */
function VideoBrowserToolbar({
  labels,
  listing,
  address,
  setAddress,
  query,
  setQuery,
  setSearchResults,
  loadDirectory,
  submitAddress,
  submitSearch,
  showHome,
}: Pick<VideoBrowserProps, 'labels'> & Pick<ReturnType<typeof useVideoBrowser>, 'listing' | 'address' | 'setAddress' | 'query' | 'setQuery' | 'setSearchResults' | 'loadDirectory' | 'submitAddress' | 'submitSearch' | 'showHome'>) {
  return (
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
      <DirectoryAddressForm
        labels={labels}
        address={address}
        setAddress={setAddress}
        submitAddress={submitAddress}
      />
      {listing ? (
        <DirectorySearchForm
          labels={labels}
          query={query}
          setQuery={setQuery}
          setSearchResults={setSearchResults}
          submitSearch={submitSearch}
        />
      ) : null}
    </div>
  );
}

/** Drive and favorite locations plus the native file picker. */
function VideoBrowserHome({
  labels,
  onOpenVideo,
  onSelectFile,
  loadDirectory,
  drives,
  favorites,
  kawaikaraFavorites,
}: Pick<VideoBrowserProps, 'labels' | 'onOpenVideo' | 'onSelectFile'> & Pick<ReturnType<typeof useVideoBrowser>, 'loadDirectory' | 'drives' | 'favorites' | 'kawaikaraFavorites'>) {
  return (
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
  );
}

/** One folder or video thumbnail with its open and favorite actions. */
function VideoDirectoryItem({
  labels,
  setContextMenu,
  loadThumbnail,
  loadDirectory,
  openPath,
  favoritePaths,
  entry,
}: Pick<VideoBrowserProps, 'labels'> & Pick<ReturnType<typeof useVideoBrowser>, 'setContextMenu' | 'loadThumbnail' | 'loadDirectory' | 'openPath' | 'favoritePaths'> & {
  /** entry supplied by the owning composition. */
  readonly entry: ReturnType<typeof useVideoBrowser>['entries'][number];
}) {
  return (
    <button
      className={`video-browser-entry is-${entry.kind}`}

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
  );
}
