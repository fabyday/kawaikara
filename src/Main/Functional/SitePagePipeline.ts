import type { WebContents } from 'electron';
import type {
  Disposable,
  SiteLogger,
  SitePagePhase,
  SitePagePipeline,
} from '@kawaikara/site-api';

/** Build the page-world execution pipeline owned by one active Site view. */
export function createSitePagePipeline(
  webContents: WebContents,
  logger: SiteLogger,
): SitePagePipeline {
  const injections = new Map<string, Parameters<SitePagePipeline['register']>[0]>();
  const disposables: Disposable[] = [];
  /** Returns the web contents. */
  const getWebContents = (): WebContents => {
    if (webContents.isDestroyed()) {
      throw new Error('The site WebContents is no longer active.');
    }
    return webContents;
  };
  /** Executes the operation. */
  const execute = async <T>(id: string, source: string): Promise<T> => {
    try {
      return await getWebContents().executeJavaScript(source) as T;
    } catch (error) {
      logger.warn(`Site page operation failed: ${id}`, error);
      throw error;
    }
  };
  /** Executes the in all frames. */
  const executeInAllFrames = async <T>(
    id: string,
    source: string,
  ): Promise<readonly T[]> => {
    const frames = getWebContents().mainFrame.framesInSubtree.filter(
      (frame) => !frame.isDestroyed(),
    );
    // Execute sequentially. Electron temporarily attaches load listeners while
    // a frame is navigating, so unbounded Promise.all can trip EventEmitter's
    // listener warning on iframe-heavy providers.
    const values: T[] = [];
    let failures = 0;
    for (const frame of frames) {
      try {
        values.push(await frame.executeJavaScript(source) as T);
      } catch {
        failures += 1;
      }
    }
    if (failures) {
      logger.debug(`Site page operation was unavailable in some frames: ${id}`, {
        failed: failures,
        total: frames.length,
      });
    }
    return values;
  };
  /** Runs the operation. */
  const run = async (id: string): Promise<void> => {
    const injection = injections.get(id);
    if (!injection) throw new Error(`Unknown site page injection: ${id}`);
    try {
      const source = typeof injection.source === 'function'
        ? await injection.source()
        : injection.source;
      if (injection.frames === 'all') await executeInAllFrames(id, source);
      else await execute(id, source);
    } catch (error) {
      logger.warn(`Site page injection failed: ${id}`, error);
    }
  };
  /** Handles the operation. */
  const on = (
    phase: Parameters<SitePagePipeline['on']>[0],
    listener: Parameters<SitePagePipeline['on']>[1],
  ): Disposable => {
    /** Performs the wrapped operation. */
    const wrapped = (): void => {
      void Promise.resolve(listener()).catch((error: unknown) => {
        logger.warn(`Site page ${phase} handler failed.`, error);
      });
    };
    if (phase === 'dom-ready') webContents.on('dom-ready', wrapped);
    else if (phase === 'did-finish-load') {
      webContents.on('did-finish-load', wrapped);
    } else {
      webContents.on('did-frame-finish-load', wrapped);
    }
    const disposable: Disposable = {
      dispose: () => {
        if (webContents.isDestroyed()) return;
        if (phase === 'dom-ready') webContents.off('dom-ready', wrapped);
        else if (phase === 'did-finish-load') {
          webContents.off('did-finish-load', wrapped);
        } else {
          webContents.off('did-frame-finish-load', wrapped);
        }
      },
    };
    disposables.push(disposable);
    return disposable;
  };

  return {
    /** The register value. */
    register: (injection) => {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(injection.id)) {
        throw new Error(`Invalid site page injection id: ${injection.id}`);
      }
      if (injections.has(injection.id)) {
        throw new Error(`Duplicate site page injection id: ${injection.id}`);
      }
      const phases: SitePagePhase[] = [...new Set<SitePagePhase>(
        injection.phases ?? ['dom-ready', 'did-finish-load'],
      )];
      if (
        phases.length === 0 ||
        phases.some((phase) =>
          !['dom-ready', 'did-finish-load', 'frame-ready'].includes(phase),
        ) ||
        (injection.frames !== undefined &&
          injection.frames !== 'main' && injection.frames !== 'all')
      ) {
        throw new Error(`Invalid site page injection lifecycle: ${injection.id}`);
      }
      injections.set(injection.id, injection);
      const hooks = phases.map((phase) => on(phase, () => run(injection.id)));
      if (injection.runImmediately) void run(injection.id);
      return {
        dispose: () => {
          injections.delete(injection.id);
          hooks.forEach((hook) => hook.dispose());
        },
      };
    },
    /** The refresh value. */
    refresh: run,
    /** The execute value. */
    execute,
    /** The execute in all frames value. */
    executeInAllFrames,
    /** The on value. */
    on,
    /** The send key press value. */
    sendKeyPress: (key) => {
      const contents = getWebContents();
      contents.sendInputEvent({ type: 'keyDown', keyCode: key
      });
      contents.sendInputEvent({ type: 'keyUp', keyCode: key
      });
    },
    /** The dispose value. */
    dispose: () => {
      injections.clear();
      disposables.splice(0).forEach((disposable) => disposable.dispose());
    },
  };
}
