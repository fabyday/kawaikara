import type { WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import type {
    SiteLogger,
    SitePagePipeline,
    VideoEffectsAPI,
} from '@kawaikara/site-api';
import { installVideoEffect } from '../../Inject/VideoEffect';
import {
    createVideoEffectWorker,
    runVideoEffectWorker,
} from '../../Inject/VideoEffectWorker';
/** Engine/model payloads stay compressed until their Plugin is enabled. */
const decode = promisify(gunzip);

/** Snapshot bounded scalar data before asynchronous decoding; reject non-JSON values. */
function serializeOptions(options: unknown): string {
    if (options === undefined) return '{}';
    if (
        !options ||
        typeof options !== 'object' ||
        Array.isArray(options) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(options))
    ) {
        throw new Error('Invalid video-effect options.');
    }
    const entries = Object.entries(options);
    if (
        entries.length > 32 ||
        entries.some(
            ([key, value]) =>
                !/^[\w.-]{1,64}$/.test(key) ||
                !(
                    typeof value === 'string' ||
                    typeof value === 'boolean' ||
                    (typeof value === 'number' && Number.isFinite(value))
                ),
        )
    ) {
        throw new Error('Invalid video-effect options.');
    }
    const serialized = JSON.stringify(Object.fromEntries(entries));
    if (serialized.length > 8192)
        throw new Error('Video-effect options exceed the size limit.');
    return serialized;
}

/** App-owned execution boundary; descriptors and content policy remain Bundle-owned. */
export function createVideoEffectsHost(
    contents: WebContents,
    page: SitePagePipeline,
    logger: SiteLogger,
): VideoEffectsAPI {
    return {
        /** Lazily decode and inject one independently revocable effect. */
        register: (descriptor) => {
            const payload =
                typeof descriptor.factory === 'string'
                    ? descriptor.factory
                    : descriptor.factory?.gzipBase64;
            if (
                !/^[\w.:-]{1,256}$/.test(descriptor.id) ||
                typeof payload !== 'string' ||
                !payload ||
                payload.length > 64 * 1024 * 1024 ||
                typeof descriptor.resolveVideo !== 'string' ||
                !descriptor.resolveVideo ||
                descriptor.resolveVideo.length > 64 * 1024
            ) {
                throw new Error('Invalid video-effect descriptor.');
            }
            const options = serializeOptions(descriptor.options);
            const packaged =
                typeof descriptor.factory === 'object'
                    ? descriptor.factory
                    : undefined;
            if (
                packaged?.execution !== undefined &&
                !['page', 'worker'].includes(packaged.execution)
            )
                throw new Error('Invalid effect execution mode.');
            const scale = packaged?.scale ?? 2;
            if (!Number.isFinite(scale) || scale < 1 || scale > 4)
                throw new Error('Invalid effect output scale.');
            const id = `${descriptor.id}:${randomUUID()}`;
            let disposed = false;
            let factory: Promise<string> | undefined;
            const registration = page.register({
                id,
                runImmediately: true,
                source: async () => {
                    if (disposed) return '';
                    if (packaged?.execution === 'worker') {
                        // Keep dynamic import in generated JS: CommonJS transpilation must not rewrite it to require().
                        const bootstrap = `(${runVideoEffectWorker.toString()})(url => import(url));`;
                        return (
                            `(${installVideoEffect.toString()})(${JSON.stringify(id)},(${descriptor.resolveVideo}),` +
                            `(video,canvas,signal)=>(${createVideoEffectWorker.toString()})(video,canvas,signal,${JSON.stringify(bootstrap)},` +
                            `${JSON.stringify(payload)},${scale},Object.freeze(JSON.parse(${JSON.stringify(options)}))));`
                        );
                    }
                    factory ??=
                        typeof descriptor.factory === 'string'
                            ? Promise.resolve(descriptor.factory)
                            : decode(
                                  Buffer.from(
                                      descriptor.factory.gzipBase64,
                                      'base64',
                                  ),
                                  { maxOutputLength: 64 * 1024 * 1024 },
                              )
                                  .then((result) => result.toString('utf8'))
                                  .catch((error) => {
                                      logger.debug(
                                          'Video effect unavailable: packaged factory decoding failed.',
                                          error,
                                      );
                                      return '';
                                  });
                    const source = await factory;
                    return disposed || !source
                        ? ''
                        : `(${installVideoEffect.toString()})(${JSON.stringify(id)},(${descriptor.resolveVideo}),(video,canvas)=>(${source})(video,canvas,Object.freeze(JSON.parse(${JSON.stringify(options)}))));`;
                },
            });
            return {
                dispose: () => {
                    if (disposed) return;
                    disposed = true;
                    registration.dispose();
                    factory = undefined;
                    if (!contents.isDestroyed())
                        void contents
                            .executeJavaScript(
                                `window.__kawaikaraEffects?.get(${JSON.stringify(id)})?.();`,
                            )
                            .catch(() =>
                                logger.debug(
                                    'Video effect cleanup skipped: document retired.',
                                ),
                            );
                },
            };
        },
    };
}
