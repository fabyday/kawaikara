import { serializePageInjection } from './Serialize';

/**
 * Remote-document media cleanup used by
 * WindowManager.prepareCurrentDocumentForNavigation() in
 * Main/Manager/WindowManager.ts before a Provider view is replaced. The
 * exported serialized constant is executed by that method; no Provider calls
 * this entry point directly.
 */
function pauseDocumentMedia(): number {
  const mediaElements = document.querySelectorAll<HTMLMediaElement>(
    'audio, video',
  );
  mediaElements.forEach((media) => {
    media.autoplay = false;
    media.pause();
  });
  return mediaElements.length;
}

/** Defines the shared pause document media script constant. */
export const PAUSE_DOCUMENT_MEDIA_SCRIPT =
  serializePageInjection(pauseDocumentMedia);
