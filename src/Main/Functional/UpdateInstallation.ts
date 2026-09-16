import type { EventEmitter } from 'node:events';

/** Waits for Squirrel's staging/signature verification without scheduling a quit. */
export function waitForNativeUpdate(
  updater: Pick<EventEmitter, 'once' | 'off'>,
  start: () => void,
  timeoutMs = 120_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    /** Removes every temporary listener, including on error and timeout. */
    const cleanup = () => {
      clearTimeout(timer);
      updater.off('update-downloaded', onReady);
      updater.off('error', onError);
    };
    /** Completes the native preparation exactly once. */
    const finish = (reason?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (reason === undefined) resolve();
      else reject(reason);
    };
    /** Accepts the staged update; electron-updater also observes this event. */
    const onReady = () => finish();
    /** Preserves native errors and their machine-readable codes. */
    const onError = (reason: unknown) => finish(reason);
    const timer = setTimeout(() => finish(new Error('Native update preparation timed out.')), timeoutMs);
    updater.once('update-downloaded', onReady);
    updater.once('error', onError);
    try {
      start();
    } catch (reason) {
      finish(reason);
    }
  });
}

/** Defines reversible work performed immediately before handing off to the installer. */
export interface UpdateInstallLifecycle {
  /** Saves pending data and releases native resources without disposing the application. */
  prepare(): Promise<void>;
  /** Restores interactive resources if preparation or installer startup fails. */
  recover(): Promise<void>;
}
