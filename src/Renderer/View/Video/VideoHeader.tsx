import type {
  VideoMessages
} from '../../../Common/IPC';
import { type useVideoChrome } from './Hooks/useVideoChrome';
import { type useVideoState } from './Hooks/useVideoState';
import { blurVideoControl, getMetadataLabel } from './Presentation';

/** Inputs for the VideoHeader section. */
type VideoHeaderProps = Pick<ReturnType<typeof useVideoChrome>,
  | 'revealVideoChrome'
> & Pick<ReturnType<typeof useVideoState>,
  | 'playerState'
  | 'backend'
  | 'setRequestedDirectory'
  | 'lastBrowseDirectory'
  | 'setSourcePanelOpen'
  | 'setHlsPanelOpen'
> & {
  /** The source value for this section. */
  readonly source: NonNullable<ReturnType<typeof useVideoState>['source']>;
  /** The hasTimeline value for this section. */
  readonly hasTimeline: boolean;
  /** The labels value for this section. */
  readonly labels: VideoMessages;
};

/** Renders the VideoHeader section of this View. */
export function VideoHeader({
  revealVideoChrome,
  source,
  playerState,
  hasTimeline,
  labels,
  backend,
  setRequestedDirectory,
  lastBrowseDirectory,
  setSourcePanelOpen,
  setHlsPanelOpen,
}: VideoHeaderProps) {
  return (
    <header
      className="video-header-overlay"
      onPointerEnter={revealVideoChrome}
      onPointerMove={revealVideoChrome}
    >
      <div className="video-header-copy">
        <h1 className="video-title">{source.label}</h1>
        <p className="video-metadata">
          {getMetadataLabel(playerState, hasTimeline, labels.live)} ·{' '}
          {backend === 'libmpv' ? 'libmpv' : labels.chromiumFallback}
        </p>
      </div>
      <div className="video-header-actions">
        <button
          className="video-source-toggle"
          type="button"
          tabIndex={-1}
          onFocus={blurVideoControl}
          onPointerUp={(event) => event.currentTarget.blur()}
          onClick={() => {
            setRequestedDirectory(lastBrowseDirectory);
            setSourcePanelOpen(true);
          }}
        >
          {labels.openFolder}
        </button>
        <button
          className="video-source-toggle"
          type="button"
          tabIndex={-1}
          onFocus={blurVideoControl}
          onPointerUp={(event) => event.currentTarget.blur()}
          onClick={() => setHlsPanelOpen((open) => !open)}
        >
          {labels.hls}
        </button>
      </div>
    </header>
  );
}
