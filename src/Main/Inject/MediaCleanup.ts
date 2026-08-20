import { serializePageInjection } from './Serialize';

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

export const PAUSE_DOCUMENT_MEDIA_SCRIPT =
  serializePageInjection(pauseDocumentMedia);
