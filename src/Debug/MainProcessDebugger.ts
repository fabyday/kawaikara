import inspector from 'node:inspector';
import type {
  DevelopmentDebuggerInfo,
  PreferenceState,
} from '../Common/IPC';

/** Defines the shared inspector address constant. */
const INSPECTOR_ADDRESS = '127.0.0.1';

/**
 * Owns the optional Node Inspector endpoint used for trusted Bundle debugging.
 * Hot reload remains independent: disabling this endpoint does not stop builds.ho up

 */
export class MainProcessDebugger {
  /** The owned value. */
  private owned = false;
  /** Whether the enabled option is enabled. */
  private enabled = false;
  /** The port value. */
  private port = 9230;
  /** The error value. */
  private error?: string;

  /** Performs the configure operation. */
  configure(preferences: PreferenceState): DevelopmentDebuggerInfo {
    const shouldEnable =
      preferences.developmentMode && preferences.developmentInspectorEnabled;
    const nextPort = preferences.developmentInspectorPort;

    if (!shouldEnable) {
      this.disable();
      this.port = nextPort;
      return this.getState();
    }

    const activeUrl = inspector.url();
    if (activeUrl && (!this.owned || nextPort === this.port)) {
      this.enabled = true;
      this.port = readInspectorPort(activeUrl) ?? nextPort;
      this.error = undefined;
      return this.getState();
    }

    if (this.owned) this.disable();
    this.enabled = true;
    this.port = nextPort;
    this.error = undefined;
    try {
      inspector.open(this.port, INSPECTOR_ADDRESS, false);
      this.owned = true;
    } catch (error) {
      this.owned = false;
      this.error = toErrorMessage(error);
    }
    return this.getState();
  }

  /** Returns the state. */
  getState(): DevelopmentDebuggerInfo {
    const url = inspector.url();
    return {
      /** Whether the enabled option is enabled. */
      enabled: this.enabled,
      /** Whether the active option is enabled. */
      active: Boolean(url),
      /** The address value. */
      address: INSPECTOR_ADDRESS,
      /** The port value. */
      port: readInspectorPort(url) ?? this.port,
      /** The URL value. */
      url,
      /** The error value. */
      error: this.error,
    };
  }

  /** Creates the vs code configuration. */
  createVsCodeConfiguration(): string {
    const state = this.getState();
    return `${JSON.stringify({
      version: '0.2.0',
      configurations: [{
        name: 'Attach to Kawaikara Bundle',
        type: 'node',
        request: 'attach',
        address: state.address,
        port: state.port,
        restart: true,
        sourceMaps: true,
        skipFiles: ['<node_internals>/**'],
      }],
    }, null, 2)}\n`;
  }

  /** Releases the operation. */
  dispose(): void {
    this.disable();
  }

  /** Performs the disable operation. */
  private disable(): void {
    if (this.owned && inspector.url()) inspector.close();
    this.owned = false;
    this.enabled = false;
    this.error = undefined;
  }
}

/** Reads the inspector port. */
function readInspectorPort(url: string | undefined): number | undefined {
  if (!url) return undefined;
  try {
    return Number(new URL(url).port) || undefined;
  } catch {
    return undefined;
  }
}

/** Performs the to error message operation. */
function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
