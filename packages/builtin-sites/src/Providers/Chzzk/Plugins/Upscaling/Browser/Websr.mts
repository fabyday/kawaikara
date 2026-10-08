import WebSR from '@websr/websr';
import weights from 'websr-weights';
import { currentFrame, type EffectVideo, type EffectCanvas } from './Source.mts';
/** Small WebSR network with real-life weights, not an alias for the Anime4K preset. */
export async function create(video: EffectVideo, canvas: EffectCanvas) {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter || adapter.info.isFallbackAdapter) throw new Error('Hardware GPU unavailable');
  const device = await adapter.requestDevice();
  try {
    if (video.videoWidth * 2 > 4096 || video.videoHeight * 2 > 4096) throw new Error('Output size exceeds budget');
    // Upstream runtime supports VideoFrame and getContext('webgpu'); its canvas annotation is DOM-only.
    const renderer = new WebSR({ canvas: canvas as HTMLCanvasElement, weights, gpu: device, network_name: 'anime4k/cnn-2x-s' });
    let lost = false;
    device.lost.then(() => { lost = true; });
    device.addEventListener('uncapturederror', event => { event.preventDefault(); lost = true; });
    return {
      async render() {
        if (lost) throw new Error('GPU device lost');
        await renderer.render(currentFrame(video)); await device.queue.onSubmittedWorkDone();
        if (lost) throw new Error('GPU processing failed');
      },
      async dispose() { try { await renderer.destroy(); } finally { device.destroy(); } },
    };
  } catch (error) { device.destroy(); throw error; }
}
