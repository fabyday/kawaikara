import type {
  VideoLibraryLocation
} from '../../../../Common/IPC';

/** Performs the location section operation. */
export function LocationSection({
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
