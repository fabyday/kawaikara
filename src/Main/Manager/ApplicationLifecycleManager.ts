import { app } from 'electron';
import {
  parseExternalOpenArguments,
  parseExternalOpenUrl,
  type ExternalOpenRequest,
} from '../Functional/ExternalOpen';
import type { LoggingManager } from './LoggingManager';
import type { UpdateManager } from './UpdateManager';

/** Owns Electron process events and requests that can arrive before ready. */
export class ApplicationLifecycleManager {
  /** The pending external open requests value. */
  private readonly pendingExternalOpenRequests =
    parseExternalOpenArguments(process.argv);
  /** The external open chain value. */
  private externalOpenChain = Promise.resolve();
  /** Callback used to handle external open handler. */
  private externalOpenHandler?: (request: ExternalOpenRequest) => Promise<void>;
  /** The runtime value. */
  private runtime?: {
    /** Callback used to handle dispose. */
    readonly dispose: () => Promise<void>;
    /** The updates value. */
    readonly updates: UpdateManager;
  };
  /** The shutdown started value. */
  private shutdownStarted = false;

  /** Creates an instance of ApplicationLifecycleManager. */
  constructor(
    /** The logging value. */
    private readonly logging: LoggingManager,
    /** The application log value. */
    private readonly applicationLog: ReturnType<LoggingManager['createLogger']>,
  ) {}

  /** Starts the operation. */
  start(): boolean {
    if (!app.requestSingleInstanceLock()) {
      app.quit();
      return false;
    }

    app.on('second-instance', (_event, argv) => {
      for (const request of parseExternalOpenArguments(argv)) {
        this.dispatchExternalOpenRequest(request);
      }
    });
    app.on('open-url', (event, url) => {
      event.preventDefault();
      const request = parseExternalOpenUrl(url);
      if (request) this.dispatchExternalOpenRequest(request);
    });
    app.on('before-quit', (event) => this.handleBeforeQuit(event));
    app.on('window-all-closed', () => {
      if (!this.shutdownStarted) app.quit();
    });
    return true;
  }

  /** Attaches the runtime. */
  attachRuntime(runtime: {
    /** Callback used to handle dispose. */
    readonly dispose: () => Promise<void>;
    /** The updates value. */
    readonly updates: UpdateManager;
  }
  ): void {
    this.runtime = runtime;
  }

  /** Performs the take startup request operation. */
  takeStartupRequest(): ExternalOpenRequest | undefined {
    return this.pendingExternalOpenRequests.shift();
  }

  /** Performs the activate external open handler operation. */
  activateExternalOpenHandler(
    handler: (request: ExternalOpenRequest) => Promise<void>,
  ): void {
    this.externalOpenHandler = handler;
    for (const request of this.pendingExternalOpenRequests.splice(0)) {
      this.dispatchExternalOpenRequest(request);
    }
  }

  /** Performs the dispatch external open request operation. */
  private dispatchExternalOpenRequest(request: ExternalOpenRequest): void {
    const handler = this.externalOpenHandler;
    if (!handler) {
      this.pendingExternalOpenRequests.push(request);
      return;
    }
    this.externalOpenChain = this.externalOpenChain
      .then(() => handler(request))
      .catch((error: unknown) => {
        this.applicationLog.error(
          `Failed to open ${request.targetUrl} in Kawaikara.`,
          error,
        );
      });
  }

  /** Handles the before quit. */
  private handleBeforeQuit(event: Electron.Event): void {
    if (this.runtime?.updates.isInstalling() || this.shutdownStarted) return;

    this.shutdownStarted = true;
    event.preventDefault();
    const runtime = this.runtime;
    this.runtime = undefined;
    void Promise.resolve(runtime?.dispose())
      .catch((error: unknown) => {
        this.applicationLog.error('Kawaikara shutdown failed.', error);
      })
      .finally(() => {
        this.logging.finish();
        // The first quit request was cancelled so asynchronous teardown could
        // finish. Re-entering app.quit() from that cancelled macOS lifecycle
        // can leave Electron alive with only GPU/network helper processes and
        // no windows. Cleanup is complete here, so terminate the application
        // lifecycle directly instead of starting a second quit negotiation.
        app.exit(0);
      });
  }
}
