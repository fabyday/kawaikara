import { serializePageInjection } from './Serialize';

/** Describes the page video candidate contract. */
export interface PageVideoCandidate {
  /** The score value. */
  readonly score: number;
  /** The status value. */
  readonly status: 'no-video' | 'not-ready' | 'ready';
  /** The video height value. */
  readonly videoHeight?: number;
  /** The video width value. */
  readonly videoWidth?: number;
}

/**
 * Runs in the inspected page world, including open shadow roots.
 * createFindPictureInPictureVideoScript() is consumed only by
 * UnifiedPictureInPictureManager.inspectVideoFrames() in
 * Main/Manager/UnifiedPictureInPictureManager.ts. The Manager executes it in
 * every inspectable WebFrameMain and compares the typed score result.
 */
function findPictureInPictureVideo(): PageVideoCandidate {
  const videos: HTMLVideoElement[] = [];
  /** Performs the visit operation. */
  const visit = (root: Document | ShadowRoot): void => {
    root.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
      videos.push(video);
    });
    root.querySelectorAll<HTMLElement>('*').forEach((element) => {
      if (element.shadowRoot) visit(element.shadowRoot);
    });
  };
  /** Performs the score operation. */
  const score = (video: HTMLVideoElement): number => {
    const rect = video.getBoundingClientRect();
    const visibleWidth = Math.max(
      0,
      Math.min(rect.right, innerWidth) - Math.max(rect.left, 0),
    );
    const visibleHeight = Math.max(
      0,
      Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
    );
    return (
      (!video.paused && !video.ended ? 1e15 : 0) +
      (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? 1e12 : 0) +
      visibleWidth * visibleHeight
    );
  };

  visit(document);
  if (videos.length === 0) return {
    /** The status value. */
    status: 'no-video',
    /** The score value. */
    score: 0,
  };

  videos.sort((left, right) => score(right) - score(left));
  const video = videos[0];
  if (!video) return {
    /** The status value. */
    status: 'no-video',
    /** The score value. */
    score: 0,
  };
  return {
    /** The status value. */
    status:
      video.readyState === HTMLMediaElement.HAVE_NOTHING || !video.videoWidth
        ? 'not-ready'
        : 'ready',
    /** The score value. */
    score: score(video),
    /** The video height value. */
    videoHeight: video.videoHeight,
    /** The video width value. */
    videoWidth: video.videoWidth,
  };
}

/** Creates the find picture in picture video script. */
export function createFindPictureInPictureVideoScript(): string {
  return serializePageInjection(findPictureInPictureVideo);
}
