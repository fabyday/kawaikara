import { ipcRenderer, webUtils } from 'electron';
import { IPC_CHANNELS } from '../Common/IPC';

export function installVideoDropTarget(): void {
  window.addEventListener(
    'dragover',
    (event) => {
      if (!hasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    },
    true,
  );

  window.addEventListener(
    'drop',
    (event) => {
      if (!hasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const paths = Array.from(event.dataTransfer?.files ?? [])
        .map((file) => webUtils.getPathForFile(file))
        .filter(Boolean);
      if (paths.length > 0) {
        void ipcRenderer.invoke(IPC_CHANNELS.video.openDroppedFiles, paths);
      }
    },
    true,
  );
}

function hasFiles(dataTransfer: DataTransfer | null): boolean {
  return Boolean(
    dataTransfer &&
      (Array.from(dataTransfer.types).includes('Files') ||
        dataTransfer.files.length > 0),
  );
}
