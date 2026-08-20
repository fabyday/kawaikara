import {
  MpvVideoElement,
  type MpvPlayerSession,
  type RenderMode,
} from 'electron-mpv-video/renderer';

const SOFTWARE_RENDER_MAX_WIDTH = 1_280;
const SOFTWARE_RENDER_MAX_HEIGHT = 720;
const PATCH_MARKER = Symbol.for('kawaikara.mpv-software-render-size');

interface CanvasRendererHandle {
  resize(width: number, height: number): void;
}

interface InternalMpvVideoElement extends HTMLElement {
  readonly mode: RenderMode;
  canvasRenderer: CanvasRendererHandle | null;
  player: MpvPlayerSession | null;
}

interface MpvVideoPrototype {
  [PATCH_MARKER]?: boolean;
  updateRenderSize(this: InternalMpvVideoElement): void;
}

/**
 * Canvas2D transports a complete RGBA frame through the main process for every
 * libmpv update. Rendering at Retina devicePixelRatio therefore moves an
 * unnecessary 1920x1080 buffer even when the CSS player is much smaller. Keep
 * the GPU renderer untouched, but cap the capture-compatible software surface
 * at CSS resolution and 720p.
 */
export function installMpvSoftwareRenderSizeLimit(): void {
  const prototype = MpvVideoElement.prototype as unknown as MpvVideoPrototype;
  if (prototype[PATCH_MARKER]) return;

  const updateGpuRenderSize = prototype.updateRenderSize;
  prototype.updateRenderSize = function updateRenderSize(): void {
    if (this.mode !== 'canvas2d') {
      updateGpuRenderSize.call(this);
      return;
    }

    const rect = this.getBoundingClientRect();
    const size = fitSoftwareRenderSize(rect.width, rect.height);
    this.canvasRenderer?.resize(size.width, size.height);
    void this.player?.setRenderSize(size.width, size.height).catch((error) => {
      this.dispatchEvent(new CustomEvent('mpv-error', { detail: error }));
    });
  };
  prototype[PATCH_MARKER] = true;
}

export function fitSoftwareRenderSize(
  cssWidth: number,
  cssHeight: number,
): { readonly width: number; readonly height: number } {
  const width = Math.max(160, cssWidth);
  const height = Math.max(90, cssHeight);
  const scale = Math.min(
    1,
    SOFTWARE_RENDER_MAX_WIDTH / width,
    SOFTWARE_RENDER_MAX_HEIGHT / height,
  );
  return {
    width: toEvenPixel(width * scale, 160),
    height: toEvenPixel(height * scale, 90),
  };
}

function toEvenPixel(value: number, minimum: number): number {
  const finite = Number.isFinite(value) ? value : minimum;
  return Math.max(minimum, Math.floor(finite / 2) * 2);
}
