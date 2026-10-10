import { defineCapability } from './PluginAPI';
import type { Disposable } from './Disposable';

/** Provider-owned content discovery, not an App content classification policy. */
export const VIDEO_CONTENT = defineCapability<{
    /** Page-world function expression returning { video, kind, key }; null when unavailable. */
    resolver(): string;
}>('kawaikara.video-content', 1);

/** Trusted Bundle descriptor executed beside the source video, never across frame IPC. */
export interface VideoEffectDescriptor {
    /** Namespaced effect identity. */
    readonly id: string;
    /** Page-world function expression returning an eligible HTMLVideoElement or null. Plugin owns policy. */
    readonly resolveVideo: string;
    /** Async (video, canvas, options) factory returning { render(): Promise<void>, dispose(): void | Promise<void> }. */
    readonly factory:
        | string
        | {
              /** Packaged gzip/base64 factory; App decodes lazily off Main's event loop (64 MiB maximum). */
              readonly gzipBase64: string;
              /** Opt-in off-main-thread factory. Receives { videoWidth, videoHeight, frame?: VideoFrame } and OffscreenCanvas. */
              readonly execution?: 'page' | 'worker';
              /** Worker output dimensions relative to input (1–4, default 2). */
              readonly scale?: number;
          };
    /** Small, flat settings snapshot passed to the factory; App does not interpret effect-specific keys. */
    readonly options?: Readonly<Record<string, string | number | boolean>>;
}

/** App checks technical support and owns quiet fallback and lifecycle, not content kinds. */
export interface VideoEffectsAPI {
    /** Registration is revocable. Unsupported/failed execution keeps original playback and logs a diagnostic. */
    register(descriptor: VideoEffectDescriptor): Disposable;
}

/** @deprecated Use VideoEffectDescriptor. */
export type VideoEffectContribution = VideoEffectDescriptor;
