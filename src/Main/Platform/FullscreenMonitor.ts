import type { BrowserWindow } from 'electron';

/** Receives a platform event that can change external fullscreen ownership. */
export type ExternalFullscreenChanged = () => void;

/** Monitors platform fullscreen state without exposing platform details to callers. */
export interface ExternalFullscreenMonitor {
    /** Whether this platform requires explicit external fullscreen monitoring. */
    readonly supported: boolean;
    /** Starts monitoring and returns the current state. */
    start(
        applicationWindow: BrowserWindow,
        onChanged: ExternalFullscreenChanged,
    ): boolean;
    /** Re-evaluates and returns the current state. */
    refresh(applicationWindow: BrowserWindow): boolean;
    /** Returns the platform-observed topmost state when it is available. */
    isAlwaysOnTopApplied(applicationWindow: BrowserWindow): boolean | undefined;
    /** Returns a yield anchor unless a retained explicit viewer activation still takes precedence. */
    getYieldTarget(applicationWindow: BrowserWindow): string | undefined;
    /** Stops monitoring and releases native resources. */
    stop(): void;
}

/** No-op implementation for platforms whose native window policy handles fullscreen. */
export class UnsupportedExternalFullscreenMonitor
    implements ExternalFullscreenMonitor
{
    /** Whether this platform requires explicit external fullscreen monitoring. */
    readonly supported = false;

    /** Starts monitoring and returns the current state. */
    start(
        _applicationWindow: BrowserWindow,
        _onChanged: ExternalFullscreenChanged,
    ): boolean {
        return false;
    }

    /** Re-evaluates and returns the current state. */
    refresh(_applicationWindow: BrowserWindow): boolean {
        return false;
    }

    /** Returns no platform state when explicit monitoring is unsupported. */
    isAlwaysOnTopApplied(
        _applicationWindow: BrowserWindow,
    ): boolean | undefined {
        return undefined;
    }

    /** Native platform window policy needs no explicit restacking anchor. */
    getYieldTarget(_applicationWindow: BrowserWindow): string | undefined {
        return undefined;
    }

    /** Stops monitoring and releases native resources. */
    stop(): void {}
}
