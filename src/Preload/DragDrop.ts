import { ipcRenderer, webUtils } from 'electron';
import { IPC_CHANNELS, type RendererMessages } from '../Common/IPC';
import { createVideoDropOverlay } from './VideoDropOverlay';
import type { FileDropResult } from '../Common/DragDrop';

/** Captures OS file drops; Provider selection and execution belong to Main. */
export function installDragDropTarget(): void {
  // A document with child frames must not submit the same OS drop twice.
  if (window !== window.top) return;
  const overlay = createVideoDropOverlay();
  let depth = 0;
  let opening = false;
  let dragging = false;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  /** Hides drag feedback without cancelling an accepted open request. */
  const reset = () => {
    depth = 0;
    dragging = false;
    if (feedbackTimer !== undefined) clearTimeout(feedbackTimer);
    if (!opening) overlay.show('hidden');
  };
  /** Loads messages once per gesture, never once per dragover frame. */
  const begin = () => {
    if (opening || dragging) return;
    dragging = true;
    if (feedbackTimer !== undefined) clearTimeout(feedbackTimer);
    overlay.show('dragging');
    void ipcRenderer.invoke(IPC_CHANNELS.application.messages)
      .then((messages: RendererMessages) => overlay.setMessages(messages.video))
      .catch((reason: unknown) => console.warn('[video] Drop labels unavailable.', reason));
  };

  window.addEventListener('dragenter', (event) => {
    if (!hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    depth += 1;
    begin();
  }, true);
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) reset();
  }, true);
  window.addEventListener('dragend', reset, true);
  window.addEventListener('pagehide', reset);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') reset();
  }, true);
  window.addEventListener(
    'dragover',
    (event) => {
      if (!hasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      begin();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = opening ? 'none' : 'copy';
      }
    },
    true,
  );

  window.addEventListener(
    'drop',
    async (event) => {
      if (!hasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      reset();
      if (opening) return;
      opening = true;
      overlay.show('opening');
      try {
        // Only transfer paths: reading/encoding a movie here stalls the renderer.
        const paths = Array.from(event.dataTransfer?.files ?? [])
          .map((file) => webUtils.getPathForFile(file))
          .filter(Boolean);
        const result: FileDropResult = await ipcRenderer.invoke(
          IPC_CHANNELS.dragDrop.openFiles, paths,
        );
        const accepted = result.status === 'opened';
        overlay.show(accepted ? 'hidden' : result.status === 'selection-required' ? 'ambiguous' : 'failed');
        if (!accepted) feedbackTimer = setTimeout(() => overlay.show('hidden'), 4000);
      } catch (reason) {
        console.error('[video] Dropped video could not be opened.', reason);
        overlay.show('failed');
        feedbackTimer = setTimeout(() => overlay.show('hidden'), 4000);
      } finally {
        opening = false;
      }
    },
    true,
  );
}

/** Determines whether the files condition applies. */
function hasFiles(dataTransfer: DataTransfer | null): boolean {
  return Boolean(
    dataTransfer &&
      (Array.from(dataTransfer.types).includes('Files') ||
        dataTransfer.files.length > 0),
  );
}
