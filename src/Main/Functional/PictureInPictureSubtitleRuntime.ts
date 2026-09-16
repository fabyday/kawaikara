import { randomUUID } from 'node:crypto';
import type {
  AbstractProvider,
  PictureInPictureSubtitleController,
  ProviderPictureInPictureSession,
} from '@kawaikara/site-api';
import {
  DEFAULT_PICTURE_IN_PICTURE_SUBTITLE_SCALE,
  validatePictureInPictureSubtitleScale,
} from '../../Common/PictureInPicture';
import { createPictureInPictureSubtitleScript } from '../Inject/PictureInPictureSubtitles';
import { resolvePictureInPictureOverlaySelectors } from './PictureInPictureOverlays';

/** Minimal frame contract, also usable by lifecycle tests without Electron. */
export interface PictureInPictureSubtitleFrame {
  /** Current frame URL. */
  readonly url: string;
  /** Whether navigation has destroyed this frame. */
  isDestroyed(): boolean;
  /** Frame-local execution, never global privileged IPC. */
  executeJavaScript(source: string, userGesture?: boolean): Promise<unknown>;
}

/** Optional Provider factory; undefined retains the legacy default adapter. */
export type PictureInPictureSubtitleFactory = (
  session: ProviderPictureInPictureSession,
) => PictureInPictureSubtitleController | undefined |
  Promise<PictureInPictureSubtitleController | undefined>;

/** Apply the existing script permission boundary and retain old-bundle fallback. */
export function createProviderPictureInPictureSubtitleController(
  provider: AbstractProvider | undefined,
  session: ProviderPictureInPictureSession,
  hasScriptPermission: boolean,
): ReturnType<PictureInPictureSubtitleFactory> {
  if (!provider) return undefined;
  const scopedSession: ProviderPictureInPictureSession = {
    ...session,
    page: hasScriptPermission ? session.page : undefined,
  };
  return typeof provider.createPictureInPictureSubtitleController === 'function'
    ? provider.createPictureInPictureSubtitleController(scopedSession)
    : session.createDomSubtitleController();
}

/** One controller and its frame-scoped cleanup boundary. */
interface ActiveSubtitles {
  /** Provider adapter. */
  readonly controller: PictureInPictureSubtitleController | undefined;
  /** Clean up all convenience adapters even if a custom adapter throws. */
  dispose(): Promise<void>;
}

/** Serialize Provider creation, live settings changes, and restoration on exit. */
export class PictureInPictureSubtitleRuntime {
  /** Current preference, also used by the next session. */
  private scale = DEFAULT_PICTURE_IN_PICTURE_SUBTITLE_SCALE;
  /** Cancellation revision for pending async factories. */
  private revision = 0;
  /** Lifecycle ordering, independent from native PiP window transitions. */
  private pending = Promise.resolve();
  /** Active frame adapter. */
  private active?: ActiveSubtitles;
  /** Provider implementation supplied by SiteManager. */
  private factory?: PictureInPictureSubtitleFactory;

  /** Supply error reporting and legacy selectors without coupling to managers. */
  constructor(
    /** Site-specific legacy overlay declarations. */
    private readonly getLegacySelectors: () => readonly string[],
    /** Controller errors must not break PiP or preference saves. */
    private readonly onError: (error: unknown) => void,
  ) {}

  /** Install the current SiteManager factory. */
  setFactory(factory: PictureInPictureSubtitleFactory | undefined): void {
    this.factory = factory;
  }

  /** Remember and apply an absolute scale without reconstructing the controller. */
  setScale(value: number): Promise<void> {
    this.scale = validatePictureInPictureSubtitleScale(value);
    return this.enqueue(async () => {
      await this.active?.controller?.setScale(this.scale);
    });
  }

  /** Bind a new player frame; exit/navigation cancels late factory completions. */
  bind(frame: PictureInPictureSubtitleFrame, isCurrent: () => boolean): Promise<void> {
    const revision = ++this.revision;
    const factory = this.factory;
    return this.enqueue(async () => {
      await this.releaseActive();
      if (revision !== this.revision || !isCurrent() || frame.isDestroyed()) return;
      let sessionActive = true;
      const convenience = new Set<PictureInPictureSubtitleController>();
      /** Enforce frame lifetime for both custom and convenience controllers. */
      const execute = async <T = unknown>(source: string): Promise<T> => {
        if (!sessionActive || frame.isDestroyed()) throw new Error('PiP subtitle session is no longer active.');
        return await frame.executeJavaScript(source, true) as T;
      };
      const session: ProviderPictureInPictureSession = {
        url: frame.url,
        page: { execute },
        createDomSubtitleController: (options = {}) => {
          const id = randomUUID().replaceAll('-', '');
          let disposed = false;
          const overlaySelectors = resolvePictureInPictureOverlaySelectors([
            ...this.getLegacySelectors(), ...(options.overlaySelectors ?? []),
          ]);
          const controller: PictureInPictureSubtitleController = {
            setScale: async (value) => {
              if (disposed) return;
              await execute(createPictureInPictureSubtitleScript({
                ...options, overlaySelectors, id,
                scale: validatePictureInPictureSubtitleScale(value),
              }));
            },
            dispose: async () => {
              if (disposed) return;
              disposed = true;
              if (!frame.isDestroyed()) {
                await execute(createPictureInPictureSubtitleScript({ id }));
              }
            },
          };
          convenience.add(controller);
          return controller;
        },
      };
      let controller: PictureInPictureSubtitleController | undefined;
      const adapter: ActiveSubtitles = {
        get controller() { return controller; },
        dispose: async () => {
          try {
            await controller?.dispose();
          } catch (error) {
            this.onError(error);
          } finally {
            for (const helper of convenience) {
              try { await helper.dispose(); } catch (error) { this.onError(error); }
            }
            sessionActive = false;
          }
        },
      };
      try {
        // Old bundles can lack the new prototype method entirely.
        controller = factory ? await factory(session) : session.createDomSubtitleController();
        if (revision !== this.revision || !isCurrent() || frame.isDestroyed()) {
          await adapter.dispose();
          return;
        }
        this.active = adapter;
        await controller?.setScale(this.scale);
      } catch (error) {
        if (this.active === adapter) this.active = undefined;
        await adapter.dispose();
        throw error;
      }
    });
  }

  /** Cancel pending factories and restore captions before the viewer returns. */
  dispose(): Promise<void> {
    this.revision += 1;
    return this.enqueue(() => this.releaseActive());
  }

  /** Remove the adapter before invoking Provider cleanup. */
  private async releaseActive(): Promise<void> {
    const active = this.active;
    this.active = undefined;
    await active?.dispose();
  }

  /** Keep a rejected Provider operation from poisoning future lifecycle work. */
  private enqueue(operation: () => Promise<void>): Promise<void> {
    this.pending = this.pending.then(operation).catch((error: unknown) => this.onError(error));
    return this.pending;
  }
}
