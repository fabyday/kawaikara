import * as ort from 'ort-bundled';
import model from 'realesrgan-model';
import wasm from 'ort-wasm';
import { currentFrame, type EffectVideo, type EffectCanvas } from './Source.mts';
/** Genuine pinned Real-ESRGAN general-x4v3, bounded experimental GPU-only inference. */
export async function create(video: EffectVideo, canvas: EffectCanvas) {
  const width = video.videoWidth, height = video.videoHeight;
  if (width * height > 640 * 360) throw new Error('Real-ESRGAN exceeds experimental 360p processing budget');
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter || adapter.info.isFallbackAdapter) throw new Error('Hardware GPU unavailable');
  const device = await adapter.requestDevice();
  ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false; ort.env.wasm.wasmBinary = wasm;
  ort.env.wasm.initTimeout = 15000;
  ort.env.webgpu.device = device;
  let session: ort.InferenceSession | undefined;
  try {
    session = await ort.InferenceSession.create(model, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' });
    const source = new OffscreenCanvas(width, height);
    const ctx = source.getContext('2d', { willReadFrequently: true })!;
    canvas.width = width * 4; canvas.height = height * 4;
    const output = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    let lost = false;
    device.lost.then(() => { lost = true; });
    device.addEventListener('uncapturederror', event => { event.preventDefault(); lost = true; });
    return {
      async render() {
        if (lost) throw new Error('GPU device lost');
        ctx.drawImage(currentFrame(video), 0, 0); const pixels = ctx.getImageData(0, 0, width, height).data;
        const area = width * height, rgb = new Float32Array(area * 3);
        for (let i = 0; i < area; i++) for (let c = 0; c < 3; c++) rgb[c * area + i] = pixels[i * 4 + c] / 255;
        const input = new ort.Tensor('float32', rgb, [1, 3, height, width]);
        let result: Record<string, ort.Tensor> | undefined;
        try {
          result = await session!.run({ [session!.inputNames[0]]: input });
          const values = await result[session!.outputNames[0]].getData() as Float32Array;
          const size = canvas.width * canvas.height, image = new ImageData(canvas.width, canvas.height);
          for (let i = 0; i < size; i++) {
            for (let c = 0; c < 3; c++) image.data[i*4+c] = Math.round(Math.max(0, Math.min(1, values[c*size+i])) * 255);
            image.data[i*4+3] = 255;
          }
          if (lost) throw new Error('GPU processing failed');
          output.putImageData(image, 0, 0);
        } finally { input.dispose(); Object.values(result ?? {}).forEach(tensor => tensor.dispose()); }
      },
      async dispose() { try { await session!.release(); } finally { device.destroy(); } },
    };
  } catch (error) { if (session) await session.release(); device.destroy(); throw error; }
}
