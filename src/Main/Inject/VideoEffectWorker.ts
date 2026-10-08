/** Serializable dedicated-worker entry. Bundle code stays compressed until inside this worker. */
export function runVideoEffectWorker(load: (url: string) => Promise<{ default: (
  video: { videoWidth: number; videoHeight: number; frame?: VideoFrame }, canvas: OffscreenCanvas,
  options: Readonly<Record<string, unknown>>,
) => Promise<{ render(): Promise<void>; dispose(): void | Promise<void> }> }>): void {
  const scope = globalThis as unknown as {
    onmessage: (event: MessageEvent) => void;
    postMessage(message: unknown): void;
  };
  let engine: Awaited<ReturnType<Awaited<ReturnType<typeof load>>['default']>> | undefined;
  let input: { videoWidth: number; videoHeight: number; frame?: VideoFrame };
  let busy = false;
  scope.onmessage = async ({ data }) => {
    if (busy) { data.frame?.close(); scope.postMessage({ id: data.id, error: 'Concurrent effect request' }); return; }
    busy = true;
    try {
      if (data.type === 'init') {
        const bytes = Uint8Array.from(atob(data.gzipBase64), char => char.charCodeAt(0));
        const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
        const chunks: Uint8Array[] = []; let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read(); if (done) break;
            size += value.byteLength;
            if (size > 64 * 1024 * 1024) throw new Error('Effect factory exceeds size limit');
            chunks.push(value);
          }
        } finally { await reader.cancel(); }
        const moduleUrl = URL.createObjectURL(new Blob(['export default (', ...chunks, ');'], { type: 'text/javascript' }));
        try {
          const factory = (await load(moduleUrl)).default;
          input = { videoWidth: data.width, videoHeight: data.height };
          engine = await factory(input, data.canvas, Object.freeze(data.options));
        } finally { URL.revokeObjectURL(moduleUrl); }
      } else if (data.type === 'frame') {
        if (!engine) throw new Error('Effect worker is not initialized');
        input.frame = data.frame;
        try { await engine.render(); } finally { input.frame = undefined; }
      } else if (data.type === 'dispose') {
        await engine?.dispose(); engine = undefined;
      } else throw new Error('Unknown effect worker request');
      scope.postMessage({ id: data.id });
    } catch (error) {
      scope.postMessage({ id: data.id, error: error instanceof Error ? error.message.slice(0, 400) : 'Effect worker failed' });
    } finally { data.frame?.close(); busy = false; }
  };
}

/** Page-side transport: one transferable decoded frame at a time, never a frame backlog or audio IPC. */
export async function createVideoEffectWorker(
  video: HTMLVideoElement, canvas: HTMLCanvasElement, signal: AbortSignal,
  workerSource: string, gzipBase64: string, scale: number, options: Readonly<Record<string, unknown>>,
): Promise<{ render(): Promise<void>; dispose(): Promise<void> }> {
  if (signal.aborted) throw new Error('Effect initialization cancelled');
  if (typeof Worker === 'undefined' || typeof VideoFrame === 'undefined' ||
      typeof canvas.transferControlToOffscreen !== 'function') throw new Error('Worker video effects unavailable');
  const width = video.videoWidth, height = video.videoHeight;
  if (!width || !height || width * scale > 4096 || height * scale > 4096) throw new Error('Output size exceeds budget');
  canvas.width = width * scale; canvas.height = height * scale;
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  let worker: Worker;
  try { worker = new Worker(url, { type: 'module', name: 'kawaikara-video-effect' }); }
  finally { URL.revokeObjectURL(url); }
  let stopped = false, sequence = 0;
  let disposal: Promise<void> | undefined;
  let pending: { id: number; resolve(): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> } | undefined;
  /** Abort interrupts even synchronous model compilation running inside the worker. */
  const stop = (error = new Error('Effect worker stopped')): void => {
    if (stopped) return;
    stopped = true; worker.terminate(); signal.removeEventListener('abort', abort);
    if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = undefined; }
  };
  const abort = (): void => {
    if (pending) stop(new Error('Effect operation cancelled'));
    else void dispose().catch(() => undefined);
  };
  signal.addEventListener('abort', abort, { once: true });
  worker.onerror = event => { event.preventDefault(); stop(new Error('Effect worker unavailable or blocked by page policy')); };
  worker.onmessageerror = () => stop(new Error('Effect worker message failed'));
  worker.onmessage = ({ data }) => {
    if (!pending || pending.id !== data.id) return;
    const request = pending; pending = undefined; clearTimeout(request.timer);
    if (data.error) request.reject(new Error(String(data.error))); else request.resolve();
  };
  const request = (data: Record<string, unknown>, transfer: Transferable[], timeout: number): Promise<void> => {
    if (stopped || pending) return Promise.reject(new Error(stopped ? 'Effect worker stopped' : 'Effect frame already in flight'));
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending = { id, resolve, reject, timer: setTimeout(() => stop(new Error('Effect worker timed out')), timeout) };
      try { worker.postMessage({ ...data, id }, transfer); }
      catch (error) { stop(error instanceof Error ? error : new Error('Effect transfer failed')); }
    });
  };
  /** Idle engines release their GPU resources explicitly; busy cancellation terminates immediately. */
  function dispose(): Promise<void> {
    if (stopped) return Promise.resolve();
    return disposal ??= (async () => {
      try { await request({ type: 'dispose' }, [], 1000); } finally { stop(); }
    })();
  }
  try {
    const output = canvas.transferControlToOffscreen();
    await request({ type: 'init', gzipBase64, width, height, canvas: output, options }, [output], 30000);
    return {
      async render() {
        if (stopped || pending) throw new Error('Effect worker not ready');
        const frame = new VideoFrame(video);
        try { await request({ type: 'frame', frame }, [frame], 15000); }
        finally { frame.close(); }
      },
      dispose,
    };
  } catch (error) { stop(); throw error; }
}
