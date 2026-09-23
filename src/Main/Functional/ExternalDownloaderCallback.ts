import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/** Maximum accepted callback payload size. */
const CALLBACK_BODY_LIMIT = 64 * 1024;
/** Time allowed for an external app to acknowledge a launched request. */
const CALLBACK_ACK_TIMEOUT_MS = 30_000;
/** Time a completed request remains available for duplicate terminal delivery. */
const TERMINAL_RETENTION_MS = 60_000;
/** Maximum lifetime of an accepted request that never reaches a terminal event. */
const REQUEST_RETENTION_MS = 24 * 60 * 60 * 1_000;

/** Lifecycle event names accepted from a companion application. */
type CompanionEventName =
  | 'request.received'
  | 'source.accepted'
  | 'source.rejected'
  | 'download.queued'
  | 'download.progress'
  | 'download.completed'
  | 'download.failed';

/** Minimal scoped logger surface required by the callback receiver. */
interface CallbackLogger {
  /** Records a failed operation. */
  error(...values: unknown[]): void;
  /** Records normal lifecycle information. */
  info(...values: unknown[]): void;
  /** Records rejected or delayed callback behavior. */
  warn(...values: unknown[]): void;
}

/** Authentication and acknowledgment state for one launched request. */
interface PendingCallbackRequest {
  /** Whether at least one valid event has arrived. */
  acknowledged: boolean;
  /** Timer used to report a missing initial response. */
  acknowledgmentTimer: NodeJS.Timeout;
  /** Request-scoped bearer token. */
  token: string;
  /** Timer preventing abandoned requests from accumulating indefinitely. */
  retentionTimer: NodeJS.Timeout;
}

/** Values passed to the external application in its deep link. */
export interface ExternalDownloaderCallbackDescriptor {
  /** Loopback endpoint receiving lifecycle events. */
  readonly callbackUrl: string;
  /** Opaque request identity. */
  readonly requestId: string;
  /** Request-scoped bearer token. */
  readonly token: string;
}

/** Validated event received from a companion application. */
interface CompanionEvent {
  /** Optional machine-readable result code. */
  readonly code?: string;
  /** Lifecycle event name. */
  readonly event: CompanionEventName;
  /** Optional bounded human-readable status. */
  readonly message?: string;
  /** Optional normalized completion ratio. */
  readonly progress?: number;
  /** Optional downloader queue item identity. */
  readonly queueItemId?: string;
  /** Owning Kawaikara request identity. */
  readonly requestId: string;
  /** Optional downloader stage. */
  readonly stage?: string;
  /** External application event timestamp. */
  readonly timestamp: string;
}

/** Owns the loopback-only, request-authenticated callback endpoint for companion apps. */
export class ExternalDownloaderCallbackServer {
  /** Pending requests keyed by their opaque identities. */
  private readonly pending = new Map<string, PendingCallbackRequest>();
  /** Lazily-created loopback HTTP server. */
  private server?: Server;
  /** Shared lazy-start operation and resolved listening port. */
  private startPromise?: Promise<number>;

  /** Creates a callback server bound to one scoped application logger. */
  constructor(
    /** Scoped logger receiving callback lifecycle entries. */
    private readonly logger: CallbackLogger,
  ) {}

  /** Creates an authenticated request descriptor after the server is listening. */
  async createRequest(): Promise<ExternalDownloaderCallbackDescriptor> {
    const port = await this.ensureStarted();
    const requestId = randomUUID();
    const token = randomBytes(32).toString('base64url');
    const acknowledgmentTimer = setTimeout(() => {
      const request = this.pending.get(requestId);
      if (!request || request.acknowledged) return;
      this.logger.warn('External downloader did not acknowledge the request in time.', {
        requestId,
      });
    }, CALLBACK_ACK_TIMEOUT_MS);
    acknowledgmentTimer.unref();
    const retentionTimer = setTimeout(() => this.cancel(requestId), REQUEST_RETENTION_MS);
    retentionTimer.unref();
    this.pending.set(requestId, {
      acknowledged: false,
      acknowledgmentTimer,
      retentionTimer,
      token,
    });
    return {
      /** The callback URL value. */
      callbackUrl: `http://127.0.0.1:${String(port)}/v1/events/${requestId}`,
      /** The request ID value. */
      requestId,
      /** The token value. */
      token,
    };
  }

  /** Stops tracking one pending request. */
  cancel(requestId: string): void {
    const request = this.pending.get(requestId);
    if (!request) return;
    clearTimeout(request.acknowledgmentTimer);
    clearTimeout(request.retentionTimer);
    this.pending.delete(requestId);
  }

  /** Lazily starts the callback listener and returns its ephemeral port. */
  private ensureStarted(): Promise<number> {
    if (this.startPromise) return this.startPromise;
    this.startPromise = new Promise<number>((resolve, reject) => {
      const server = createServer((request, response) => {
        void this.handleRequest(request, response);
      });
      this.server = server;
      /** Rejects the lazy start operation. */
      const handleError = (error: Error) => {
        server.off('listening', handleListening);
        this.startPromise = undefined;
        reject(error);
      };
      /** Resolves the assigned loopback port. */
      const handleListening = () => {
        server.off('error', handleError);
        const address = server.address();
        if (!address || typeof address === 'string') {
          reject(new Error('External downloader callback address is unavailable.'));
          return;
        }
        server.unref();
        resolve(address.port);
      };
      server.once('error', handleError);
      server.once('listening', handleListening);
      server.listen(0, '127.0.0.1');
    });
    return this.startPromise;
  }

  /** Validates and records one callback request without exposing app state. */
  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    try {
      if (request.method !== 'POST' || !isLoopbackAddress(request.socket.remoteAddress)) {
        respond(response, 404);
        return;
      }
      const requestId = new URL(request.url ?? '/', 'http://127.0.0.1')
        .pathname.match(/^\/v1\/events\/([A-Za-z0-9-]{8,100})$/)?.[1];
      const pending = requestId ? this.pending.get(requestId) : undefined;
      if (!requestId || !pending || !hasValidAuthorization(request, pending.token)) {
        respond(response, 401);
        return;
      }
      const event = parseCompanionEvent(await readBody(request), requestId);
      pending.acknowledged = true;
      clearTimeout(pending.acknowledgmentTimer);
      this.logEvent(event);
      respond(response, 204);
      if (event.event === 'source.rejected' ||
          event.event === 'download.completed' ||
          event.event === 'download.failed') {
        const timer = setTimeout(() => this.cancel(requestId), TERMINAL_RETENTION_MS);
        timer.unref();
      }
    } catch (error) {
      this.logger.warn('Rejected an invalid external downloader callback.', {
        message: error instanceof Error ? error.message : String(error),
      });
      respond(response, 400);
    }
  }

  /** Maps a companion lifecycle event to the appropriate Kawaikara log level. */
  private logEvent(event: CompanionEvent): void {
    const details = {
      code: event.code,
      message: event.message,
      progress: event.progress,
      queueItemId: event.queueItemId,
      requestId: event.requestId,
      stage: event.stage,
      timestamp: event.timestamp,
    };
    if (event.event === 'download.failed') {
      this.logger.error('External download failed.', details);
    } else if (event.event === 'source.rejected') {
      this.logger.warn('External downloader rejected the source.', details);
    } else if (event.event === 'download.progress') {
      this.logger.info('External download progress.', details);
    } else if (event.event === 'download.completed') {
      this.logger.info('External download completed.', details);
    } else if (event.event === 'download.queued') {
      this.logger.info('External download queued.', details);
    } else if (event.event === 'source.accepted') {
      this.logger.info('External downloader accepted the source.', details);
    } else {
      this.logger.info('External downloader received the request.', details);
    }
  }
}

/** Compares a supplied bearer token without a data-dependent early exit. */
function hasValidAuthorization(request: IncomingMessage, token: string): boolean {
  const provided = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const expectedBuffer = Buffer.from(token);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer);
}

/** Returns whether the peer is a supported loopback representation. */
function isLoopbackAddress(value?: string): boolean {
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
}

/** Reads one bounded UTF-8 request body. */
async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    size += chunk.length;
    if (size > CALLBACK_BODY_LIMIT) throw new Error('Callback body exceeds 64 KiB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Parses and bounds an authenticated companion event. */
function parseCompanionEvent(value: string, requestId: string): CompanionEvent {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Callback payload must be an object.');
  }
  const candidate = parsed as Record<string, unknown>;
  const events = new Set<CompanionEventName>([
    'request.received',
    'source.accepted',
    'source.rejected',
    'download.queued',
    'download.progress',
    'download.completed',
    'download.failed',
  ]);
  if (candidate.requestId !== requestId ||
      typeof candidate.event !== 'string' ||
      !events.has(candidate.event as CompanionEventName) ||
      typeof candidate.timestamp !== 'string') {
    throw new TypeError('Callback payload identity is invalid.');
  }
  return {
    /** The event value. */
    event: candidate.event as CompanionEventName,
    /** The request ID value. */
    requestId,
    /** The timestamp value. */
    timestamp: candidate.timestamp.slice(0, 80),
    ...(typeof candidate.code === 'string' ? { code: candidate.code.slice(0, 120) } : {}),
    ...(typeof candidate.message === 'string'
      ? { message: candidate.message.slice(0, 2_000) }
      : {}),
    ...(typeof candidate.progress === 'number' && Number.isFinite(candidate.progress)
      ? { progress: Math.max(0, Math.min(1, candidate.progress)) }
      : {}),
    ...(typeof candidate.queueItemId === 'string'
      ? { queueItemId: candidate.queueItemId.slice(0, 160) }
      : {}),
    ...(typeof candidate.stage === 'string'
      ? { stage: candidate.stage.slice(0, 120) }
      : {}),
  };
}

/** Finishes an empty no-store HTTP response. */
function respond(response: ServerResponse, statusCode: number): void {
  if (response.headersSent || response.writableEnded) return;
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-length': '0',
  });
  response.end();
}
