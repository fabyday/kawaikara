/** Serializable page-world host. No site names, routes, or content classification belong here. */
export function installVideoEffect(
  id: string,
  resolveVideo: () => HTMLVideoElement | null,
  create: (video: HTMLVideoElement, canvas: HTMLCanvasElement, signal: AbortSignal) => Promise<{
    /** Renders the operation. */
    render(): Promise<void>;
    /** Releases the operation. */
    dispose(): void | Promise<void>;
  }>,
): void {
  /** Page-local diagnostics contain dimensions/timing only, never source URLs or frames. */
  type EffectStatus = {
    state: 'waiting' | 'initializing' | 'ready' | 'applied' | 'suspended' | 'fallback';
    reason: string;
    input: string;
    output: string;
    renderedFrames: number;
    presentedFrames: number;
    processingMs: number;
    averageProcessingMs: number;
  };
  const scope = window as unknown as {
    __kawaikaraEffects?: Map<string, () => void>;
    __kawaikaraEffectStatus?: Map<string, EffectStatus>;
  };
  const sessions = scope.__kawaikaraEffects ??= new Map();
  // dom-ready and did-finish-load may both inject into the same document.
  if (sessions.has(id)) return;
  const statuses = scope.__kawaikaraEffectStatus ??= new Map();
  const status: EffectStatus = { state: 'waiting', reason: 'waiting-for-video', input: '', output: '',
    renderedFrames: 0, presentedFrames: 0, processingMs: 0, averageProcessingMs: 0 };
  statuses.set(id, status);
  const timings: number[] = [];
  let retired = false;
  let generation = 0;
  let current: HTMLVideoElement | null = null;
  let source = '';
  let dimensions = '';
  let canvas: HTMLCanvasElement | undefined;
  let engine: Awaited<ReturnType<typeof create>> | undefined;
  let initialization: ReturnType<typeof create> | undefined;
  let controller: AbortController | undefined;
  let callback = 0;
  let raf = 0;
  let busy = false;
  let inFlight: Promise<void> | undefined;
  let cleanup = Promise.resolve();
  let slowFrames = 0;
  let failed = false;
  let warmed = false;
  let seekEpoch = 0;
  let seekListener: (() => void) | undefined;
  let encryptedListener: (() => void) | undefined;
  let interval: ReturnType<typeof setInterval>;
  const diagnostics = new Set<string>();
  const owners = window as unknown as {
    __kawaikaraEffectOwners?: WeakMap<HTMLVideoElement, string>;
    __kawaikaraEffectCleanup?: WeakMap<HTMLVideoElement, Promise<void>>;
  };
  const ownership = owners.__kawaikaraEffectOwners ??= new WeakMap();
  const retiring = owners.__kawaikaraEffectCleanup ??= new WeakMap();

  /** Avoid log floods; never record URLs, cookies, or video frames. */
  const report = (reason: string, error?: unknown): void => {
    if (diagnostics.has(reason)) return;
    diagnostics.add(reason);
    console.info('[video-effects]', id, reason, JSON.stringify(status), error instanceof Error ? `${error.name}: ${error.message.replace(/https?:\/\/\S+/g, '[url]').slice(0, 400)}` : '');
  };
  /** Release presentation immediately; underlying playback is never modified. */
  const clear = (): void => {
    generation++;
    controller?.abort(); controller = undefined;
    if (current && callback) current.cancelVideoFrameCallback(callback);
    if (raf) cancelAnimationFrame(raf);
    if (current && seekListener) current.removeEventListener('seeking', seekListener);
    if (current && encryptedListener) current.removeEventListener('encrypted', encryptedListener);
    if (current && ownership.get(current) === id) ownership.delete(current);
    canvas?.remove(); canvas = undefined;
    const old = engine; engine = undefined;
    const starting = initialization; initialization = undefined;
    const pending = inFlight; inFlight = undefined;
    if (old || starting) {
      cleanup = Promise.all([cleanup, pending?.catch(() => undefined)])
        .then(async () => (old ?? await starting?.catch(() => undefined))?.dispose()).catch(error => report('cleanup-failed', error));
      if (current) retiring.set(current, cleanup);
    }
    callback = 0; raf = 0; busy = false; slowFrames = 0; warmed = false;
  };
  /** Fail closed to original video until its source or the selected effect changes. */
  const fail = (reason: string, error?: unknown): void => {
    failed = true; clear(); status.state = 'fallback'; status.reason = reason; report(reason, error);
  };
  /** Follow the video layout without covering controls or intercepting pointer input. */
  const position = (): void => {
    if (!canvas || !current) return;
    const box = current.getBoundingClientRect();
    const parent = canvas.parentElement;
    const bounds = parent?.getBoundingClientRect();
    const style = getComputedStyle(current);
    canvas.style.cssText = `position:absolute;pointer-events:none;left:${box.left - (bounds?.left ?? 0) - (parent?.clientLeft ?? 0) + (parent?.scrollLeft ?? 0)}px;top:${box.top - (bounds?.top ?? 0) - (parent?.clientTop ?? 0) + (parent?.scrollTop ?? 0)}px;width:${box.width}px;height:${box.height}px;object-fit:${style.objectFit};object-position:${style.objectPosition};z-index:${style.zIndex};opacity:${style.opacity};border-radius:${style.borderRadius};`;
    canvas.hidden = document.hidden || current.seeking || box.width <= 0 || box.height <= 0 || style.opacity === '0' || style.visibility === 'hidden' || style.display === 'none';
  };
  /** One asynchronous GPU submission at a time; never accumulate a frame queue. */
  const frame = async (token: number, video: HTMLVideoElement): Promise<void> => {
    if (retired || token !== generation || !engine || busy) return;
    if (video.mediaKeys) { fail('protected-content'); return; }
    try {
      if (resolveVideo() !== video || !video.isConnected) { clear(); current = null; return; }
    } catch (error) { fail('target-unavailable', error); return; }
    if (document.hidden || video.seeking || video.readyState < 2) {
      if (canvas) canvas.hidden = true;
      status.state = 'suspended';
      status.reason = document.hidden ? 'page-hidden' : video.seeking ? 'seeking' : 'waiting-for-frame';
      callback = video.requestVideoFrameCallback(() => { void frame(token, video); }); return;
    }
    busy = true;
    status.reason = 'rendering-frame';
    const frameSeekEpoch = seekEpoch;
    const start = performance.now();
    try {
      inFlight = engine.render();
      await inFlight;
      if (retired || generation !== token) return;
      const elapsed = performance.now() - start;
      status.renderedFrames++;
      status.processingMs = Math.round(elapsed * 100) / 100;
      timings.push(elapsed); if (timings.length > 60) timings.shift();
      status.averageProcessingMs = Math.round(timings.reduce((sum, value) => sum + value, 0) / timings.length * 100) / 100;
      status.output = canvas ? `${canvas.width}x${canvas.height}` : '';
      // Cold shader compilation is initialization, not steady-state playback latency.
      if (warmed) {
        slowFrames = elapsed > 40 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
        if (elapsed > 250 || slowFrames >= 5) { fail('latency-budget-exceeded'); return; }
      }
      warmed = true;
      if (elapsed <= 40 && frameSeekEpoch === seekEpoch) {
        position();
        if (canvas && !canvas.hidden) {
          status.presentedFrames++; status.state = 'applied'; status.reason = 'frame-presented';
          report('applied');
        } else { status.state = 'suspended'; status.reason = 'output-hidden'; }
      } else if (canvas) {
        canvas.hidden = true; status.state = 'suspended';
        status.reason = frameSeekEpoch !== seekEpoch ? 'seeking' : 'frame-too-slow';
      }
    } catch (error) { if (token === generation) fail('processing-failed', error); return; }
    finally { if (token === generation) { busy = false; inFlight = undefined; } }
    callback = video.requestVideoFrameCallback(() => { void frame(token, video); });
  };
  /** Only replace resources when target, source, or decoded dimensions actually change. */
  const inspect = async (): Promise<void> => {
    if (retired) return;
    let video: HTMLVideoElement | null;
    try { video = resolveVideo(); } catch (error) { fail('target-unavailable', error); return; }
    const nextSource = video?.currentSrc ?? '';
    const size = video ? `${video.videoWidth}x${video.videoHeight}` : '';
    if (video === current && source === nextSource && dimensions === size) {
      // MSE players can stop delivering frame callbacks across their initial
      // seek/readiness transition. Resume the existing engine once decoded
      // data is available instead of leaving a hidden, initialized surface.
      if (video && engine && !busy && status.state === 'suspended' &&
          !document.hidden && !video.seeking && video.readyState >= 2) {
        if (callback) video.cancelVideoFrameCallback(callback);
        callback = 0;
        void frame(generation, video);
      }
      return;
    }
    clear(); current = video; source = nextSource; dimensions = size; failed = false; diagnostics.clear();
    status.input = size; status.output = ''; status.renderedFrames = 0; status.presentedFrames = 0;
    status.processingMs = 0; status.averageProcessingMs = 0; timings.length = 0;
    status.state = 'waiting'; status.reason = 'waiting-for-video';
    if (!video || !video.videoWidth || !video.videoHeight) { report('waiting-for-video'); return; }
    if (video.mediaKeys) { fail('protected-content'); return; }
    if (!('gpu' in navigator) || !video.requestVideoFrameCallback) { fail('gpu-unavailable'); return; }
    if (ownership.has(video)) { fail('target-already-owned'); return; }
    if (!video.parentElement || getComputedStyle(video.parentElement).position === 'static') {
      fail('unsupported-output-layout'); return;
    }
    ownership.set(video, id);
    const output = document.createElement('canvas');
    output.dataset.kawaikaraVideoEffect = id;
    output.setAttribute('aria-hidden', 'true'); output.hidden = true;
    video.insertAdjacentElement('afterend', output); canvas = output;
    status.state = 'initializing'; status.reason = 'initializing';
    const token = generation;
    encryptedListener = () => fail('protected-content');
    video.addEventListener('encrypted', encryptedListener);
    seekListener = () => { seekEpoch++; if (canvas) canvas.hidden = true; };
    video.addEventListener('seeking', seekListener);
    try {
      status.reason = 'waiting-for-previous-cleanup';
      await Promise.all([cleanup, retiring.get(video)]);
      if (retired || token !== generation) return;
      status.reason = 'creating-engine';
      controller = new AbortController();
      initialization = create(video, output, controller.signal);
      const created = await initialization;
      // clear() owns the pending factory and its eventual disposal after revocation.
      if (retired || token !== generation) return;
      initialization = undefined;
      engine = created;
      status.state = 'ready'; status.reason = 'initialized';
      report('ready');
      /** Track resize, scroll, fullscreen and PiP layout while a rendered surface exists. */
      const layout = (): void => {
        if (retired || token !== generation) return;
        // Never expose an unrendered canvas during initialization.
        if (!output.hidden) position();
        raf = requestAnimationFrame(layout);
      };
      layout();
      await frame(token, video);
    } catch (error) { if (token === generation) fail('initialization-failed', error); }
  };
  /** Dispose is idempotent and cannot remove a newer registration. */
  const dispose = (): void => {
    if (retired) return;
    retired = true; clearInterval(interval); clear();
    window.removeEventListener('pagehide', dispose);
    if (sessions.get(id) === dispose) sessions.delete(id);
    if (statuses.get(id) === status) statuses.delete(id);
  };
  sessions.set(id, dispose);
  report('registered');
  window.addEventListener('pagehide', dispose, { once: true });
  interval = setInterval(() => { if (!failed) void inspect(); else {
    // A failed source is retried only after an actual target/source change.
    let next: HTMLVideoElement | null = null;
    try { next = resolveVideo(); } catch { return; }
    if (next !== current || next?.currentSrc !== source || (next && `${next.videoWidth}x${next.videoHeight}` !== dimensions)) void inspect();
  } }, 250);
  void inspect();
}
