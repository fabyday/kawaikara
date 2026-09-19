import { Button, Input } from '@kawaikara/kawai-ui';
import {
  type FormEvent
} from 'react';
import type {
  VideoMessages
} from '../../../Common/IPC';
import {
  VideoCloseIcon
} from '../../Component/VideoIcons';
import { type useVideoChrome } from './Hooks/useVideoChrome';
import { type useVideoState } from './Hooks/useVideoState';
import { blurVideoControl } from './Presentation';

/** Inputs for the HlsSourcePanel section. */
type HlsSourcePanelProps = Pick<ReturnType<typeof useVideoChrome>,
  | 'closeHlsPanel'
> & Pick<ReturnType<typeof useVideoState>,
  | 'hlsUrl'
  | 'setHlsUrl'
> & {
  /** The labels value for this section. */
  readonly labels: VideoMessages;
  /** The localization value for this section. */
  readonly localization: NonNullable<ReturnType<typeof useVideoState>['localization']>;
  /** The openHlsStream value for this section. */
  readonly openHlsStream: (event?: FormEvent) => void;
};

/** Renders the HlsSourcePanel section of this View. */
export function HlsSourcePanel({
  closeHlsPanel,
  labels,
  localization,
  openHlsStream,
  hlsUrl,
  setHlsUrl,
}: HlsSourcePanelProps) {
  return (
    <div
      className="video-hls-overlay"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        closeHlsPanel();
      }}
    >
      <section className="video-hls-panel" aria-label={labels.hlsUrl}>
        <div className="video-hls-panel-heading">
          <div>
            <span>{labels.hls}</span>
            <h2>{labels.playHls}</h2>
          </div>
          <button
            aria-label={localization.videoBrowser.close}
            className="video-icon-button"
            tabIndex={-1}
            type="button"
            onFocus={blurVideoControl}
            onPointerUp={(event) => event.currentTarget.blur()}
            onClick={closeHlsPanel}
          >
            <VideoCloseIcon />
          </button>
        </div>
        <form className="video-hls-form" onSubmit={openHlsStream}>
          <Input
            label={labels.hlsUrl}
            placeholder={labels.hlsPlaceholder}
            value={hlsUrl}
            onChange={(event) => setHlsUrl(event.target.value)}
          />
          <Button disabled={!hlsUrl.trim()} type="submit">
            {labels.playHls}
          </Button>
        </form>
      </section>
    </div>
  );
}
