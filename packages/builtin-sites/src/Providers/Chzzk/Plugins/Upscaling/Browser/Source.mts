/** The same Bundle graph accepts a DOM video or the App's worker-owned current frame. */
export type EffectVideo = HTMLVideoElement | { videoWidth: number; videoHeight: number; frame?: VideoFrame };
export type EffectCanvas = HTMLCanvasElement | OffscreenCanvas;
/** A frame is owned by the App transport and must not be retained beyond render(). */
export function currentFrame(video: EffectVideo): HTMLVideoElement | VideoFrame {
  if (typeof HTMLVideoElement !== 'undefined' && video instanceof HTMLVideoElement) return video;
  const frame = (video as { frame?: VideoFrame }).frame;
  if (!frame) throw new Error('No decoded video frame');
  return frame;
}
