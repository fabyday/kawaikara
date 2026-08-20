import {
  defineMpvVideoElement,
  MpvVideoElement,
} from '../../node_modules/electron-mpv-video/dist/renderer/index.js';

if (new URLSearchParams(location.search).get('softwareLimit') === '1') {
  const originalUpdateRenderSize = MpvVideoElement.prototype.updateRenderSize;
  MpvVideoElement.prototype.updateRenderSize = function updateRenderSize() {
    if (this.mode !== 'canvas2d') {
      originalUpdateRenderSize.call(this);
      return;
    }
    const rect = this.getBoundingClientRect();
    const scale = Math.min(1, 1280 / rect.width, 720 / rect.height);
    const width = Math.max(160, Math.floor((rect.width * scale) / 2) * 2);
    const height = Math.max(90, Math.floor((rect.height * scale) / 2) * 2);
    this.canvasRenderer?.resize(width, height);
    void this.player?.setRenderSize(width, height);
  };
}

defineMpvVideoElement();

const player = document.querySelector('#player');
const status = document.querySelector('#status');

window.runCaptureProbe = async (mode, source) => {
  status.textContent = `Opening ${mode}…`;
  await player.setRenderMode(mode);
  await player.open(source);
  await player.setVolume(0);
  await player.play();

  const playbackDeadline = Date.now() + 15_000;
  while (Date.now() < playbackDeadline && player.currentTime < 0.2) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  let deliveredFrames = 0;
  const disposeFrameCounter = player.player?.onFrame(() => {
    deliveredFrames += 1;
  });
  const sampleStartedAt = performance.now();
  const sampleStartedTime = player.currentTime;

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (
      performance.now() - sampleStartedAt >= 3_000 &&
      player.currentTime > sampleStartedTime + 0.2 &&
      player.videoWidth > 0
    ) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const sampledMilliseconds = performance.now() - sampleStartedAt;
  const mediaSeconds = player.currentTime - sampleStartedTime;
  disposeFrameCounter?.();

  status.textContent = `${mode} · ${player.rendererName} · ${player.videoWidth}×${player.videoHeight}`;
  return {
    requestedMode: mode,
    actualMode: player.mode,
    rendererName: player.rendererName,
    currentTime: player.currentTime,
    videoWidth: player.videoWidth,
    videoHeight: player.videoHeight,
    deliveredFrames,
    deliveredFramesPerSecond: deliveredFrames / (sampledMilliseconds / 1_000),
    mediaToWallClockRatio: mediaSeconds / (sampledMilliseconds / 1_000),
    softwareSurface: {
      width: player.shadowRoot?.querySelector('canvas')?.width ?? 0,
      height: player.shadowRoot?.querySelector('canvas')?.height ?? 0,
    },
  };
};
