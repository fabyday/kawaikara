/** Defines the shared thumbnail width constant. */
const THUMBNAIL_WIDTH = 320;
/** Defines the shared thumbnail height constant. */
const THUMBNAIL_HEIGHT = 180;
/** Defines the shared thumbnail timeout constant. */
const THUMBNAIL_TIMEOUT_MS = 12_000;
/** Defines the shared thumbnail cache limit constant. */
const THUMBNAIL_CACHE_LIMIT = 128;
/** Limits concurrent software decoders to avoid renderer listener pressure. */
const THUMBNAIL_LANES: Promise<void>[] = [Promise.resolve(), Promise.resolve()];
/** Stores in-flight and completed renderer thumbnail requests. */
const thumbnailCache = new Map<string, Promise<string | undefined>>();
/** The next thumbnail lane value. */
let nextThumbnailLane = 0;

/** Describes a software-rendered thumbnail frame. */
interface ThumbnailFrame {
  /** The frame width value. */
  readonly width: number;
  /** The frame height value. */
  readonly height: number;
  /** The RGBA pixel buffer value. */
  readonly rgba: ArrayBuffer;
}

/** Loads a native thumbnail and falls back to libmpv on Windows. */
export async function loadVideoThumbnail(
  path: string,
  loadNativeThumbnail: (path: string) => Promise<string | undefined>,
): Promise<string | undefined> {
  const nativeThumbnail = await loadNativeThumbnail(path);
  if (nativeThumbnail || window._electronMpvVideo.platform !== 'win32') {
    return nativeThumbnail;
  }

  const cached = thumbnailCache.get(path);
  if (cached) return cached;
  const request = scheduleThumbnail(() => generateMpvThumbnail(path));
  thumbnailCache.set(path, request);
  if (thumbnailCache.size > THUMBNAIL_CACHE_LIMIT) {
    const oldestPath = thumbnailCache.keys().next().value as string | undefined;
    if (oldestPath && oldestPath !== path) thumbnailCache.delete(oldestPath);
  }
  return request;
}

/** Schedules work across a small fixed set of decoder lanes. */
function scheduleThumbnail(
  action: () => Promise<string | undefined>,
): Promise<string | undefined> {
  const lane = nextThumbnailLane % THUMBNAIL_LANES.length;
  nextThumbnailLane += 1;
  const request = THUMBNAIL_LANES[lane].then(action);
  THUMBNAIL_LANES[lane] = request.then(() => undefined, () => undefined);
  return request;
}

/** Generates one preview frame through the public electron-mpv-video API. */
async function generateMpvThumbnail(path: string): Promise<string | undefined> {
  const player = await window._electronMpvVideo.create({
    renderMode: 'canvas2d',
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
  });
  /** Releases the temporary player event subscription. */
  let disposeEvents: () => void = () => undefined;
  /** Releases the temporary player frame subscription. */
  let disposeFrames: () => void = () => undefined;
  try {
    await player.setVolume(0);
    let duration = 0;
    const loaded = new Promise<void>((resolve, reject) => {
      disposeEvents = player.onEvent((event) => {
        if (event.error) {
          reject(new Error(event.error));
          return;
        }
        if (
          event.type === 'property-change' &&
          event.name === 'duration' &&
          typeof event.data === 'number'
        ) {
          duration = event.data;
        }
        if (event.type === 'file-loaded') resolve();
      });
    });
    await player.open(path);
    await withTimeout(loaded, THUMBNAIL_TIMEOUT_MS);
    const previewTime = duration > 0
      ? Math.min(8, Math.max(0.5, duration * 0.08))
      : 2;
    await player.seek(previewTime);
    await wait(100);

    const frameRequest = new Promise<ThumbnailFrame>((resolve) => {
      disposeFrames = player.onFrame((frame) => resolve(frame));
    });
    await player.setRenderSize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
    const frame = await withTimeout(frameRequest, THUMBNAIL_TIMEOUT_MS);
    return frameToDataUrl(frame);
  } catch (error) {
    console.debug('[video] Thumbnail preview could not be generated.', error);
    return undefined;
  } finally {
    disposeFrames();
    disposeEvents();
    await player.destroy().catch(() => undefined);
  }
}

/** Converts an RGBA frame into a compact browser image. */
function frameToDataUrl(frame: ThumbnailFrame): string | undefined {
  if (
    frame.width <= 0 ||
    frame.height <= 0 ||
    frame.rgba.byteLength !== frame.width * frame.height * 4
  ) {
    return undefined;
  }
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return undefined;
  context.putImageData(
    new ImageData(new Uint8ClampedArray(frame.rgba), frame.width, frame.height),
    0,
    0,
  );
  return canvas.toDataURL('image/jpeg', 0.82);
}

/** Resolves a promise within a bounded interval. */
async function withTimeout<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_resolve, reject) => {
        timer = window.setTimeout(
          () => reject(new Error('Video thumbnail generation timed out.')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

/** Waits for the requested renderer interval. */
function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
