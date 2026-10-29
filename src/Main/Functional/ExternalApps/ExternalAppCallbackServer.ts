import type { ExternalAppHost } from './ExternalAppAdapter';
import type { ExternalAppCallbackDescriptor } from '../../../Common/ExternalApps';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
    createServer,
    type IncomingMessage,
    type ServerResponse,
} from 'node:http';

/** Maximum accepted callback payload size. */
const CALLBACK_BODY_LIMIT = 64 * 1024;
/** Time allowed for an external app to acknowledge a launched request. */
const CALLBACK_ACK_TIMEOUT_MS = 30_000;
/** Time a completed request remains available for duplicate terminal delivery. */
const TERMINAL_RETENTION_MS = 60_000;
/** Maximum lifetime of an accepted request that never reaches a terminal event. */
const REQUEST_RETENTION_MS = 24 * 60 * 60 * 1_000;

/** Minimal scoped logger surface required by the callback receiver. */
export interface ExternalAppCallbackLogger {
    /** Records a failed operation. */
    error(...values: unknown[]): void;
    /** Records normal lifecycle information. */
    info(...values: unknown[]): void;
    /** Records rejected or delayed callback behavior. */
    warn(...values: unknown[]): void;
}

/** Authentication and acknowledgment state for one launched request. */
interface PendingCallbackRequest {
    /** Invocation-scoped host resources; omitted when the app needs no protected resources. */
    host?: ExternalAppHost;
    /** Adapter-owned validation and lifecycle semantics for this request. */
    onEvent?: ExternalAppCallbackEventHandler;
    /** Whether at least one valid event has arrived. */
    acknowledged: boolean;
    /** Whether terminal delivery has already started the fixed grace period. */
    terminal?: boolean;
    /** Timer used to report a missing initial response. */
    acknowledgmentTimer: NodeJS.Timeout;
    /** Request-scoped bearer token. */
    token: string;
    /** Timer preventing abandoned requests from accumulating indefinitely. */
    retentionTimer: NodeJS.Timeout;
}

/** Adapter-owned event processing; true retires the request after duplicate-delivery grace.
 * The payload is decoded but untrusted. Implementations must validate their own
 * event schema and match the host-issued request ID; throwing rejects the callback.
 */
export type ExternalAppCallbackEventHandler = (
    value: unknown,
    requestId: string,
) => boolean;

/** Invocation-scoped resources and app-specific callback behavior. */
export interface ExternalAppCallbackOptions {
    /** Permission-checked resources; omit for an app that needs no host access. */
    readonly host?: ExternalAppHost;
    /** Optional event receiver; event delivery is rejected when omitted. */
    readonly onEvent?: ExternalAppCallbackEventHandler;
}

/** Owns a loopback-only, authenticated transport without interpreting app actions. */
export class ExternalAppCallbackServer {
    /** Pending requests keyed by their opaque identities. */
    private readonly pending = new Map<string, PendingCallbackRequest>();
    /** Shared lazy-start operation and resolved listening port. */
    private startPromise?: Promise<number>;

    /** Creates a callback server bound to one scoped application logger. */
    constructor(
        /** Scoped logger receiving callback lifecycle entries. */
        private readonly logger: ExternalAppCallbackLogger,
    ) {}

    /** Creates an authenticated request descriptor after the server is listening.
     * @param options - Invocation resources and the adapter's event validator/handler.
     * @returns Request ID, loopback callback URL and bearer token for the external app.
     * @throws Listener startup errors; no request is retained until startup succeeds.
     */
    async createRequest(
        options: ExternalAppCallbackOptions = {},
    ): Promise<ExternalAppCallbackDescriptor> {
        const port = await this.ensureStarted();
        const requestId = randomUUID();
        const token = randomBytes(32).toString('base64url');
        const acknowledgmentTimer = setTimeout(() => {
            const request = this.pending.get(requestId);
            if (!request || request.acknowledged) return;
            this.logger.warn(
                'External application did not acknowledge the request in time.',
                {
                    requestId,
                },
            );
        }, CALLBACK_ACK_TIMEOUT_MS);
        acknowledgmentTimer.unref();
        const retentionTimer = setTimeout(
            () => this.cancel(requestId),
            REQUEST_RETENTION_MS,
        );
        retentionTimer.unref();
        this.pending.set(requestId, {
            host: options.host,
            onEvent: options.onEvent,
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
                    reject(
                        new Error(
                            'External application callback address is unavailable.',
                        ),
                    );
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
            if (
                request.method !== 'POST' ||
                !isLoopbackAddress(request.socket.remoteAddress)
            ) {
                respond(response, 404);
                return;
            }
            const requestId = new URL(
                request.url ?? '/',
                'http://127.0.0.1',
            ).pathname.match(
                /^\/v1\/events\/([A-Za-z0-9-]{8,100})(?:\/host)?$/,
            )?.[1];
            const pending = requestId ? this.pending.get(requestId) : undefined;
            if (
                !requestId ||
                !pending ||
                !hasValidAuthorization(request, pending.token)
            ) {
                respond(response, 401);
                return;
            }
            if (
                new URL(
                    request.url ?? '/',
                    'http://127.0.0.1',
                ).pathname.endsWith('/host')
            ) {
                if (!pending.host) {
                    respond(response, 403);
                    return;
                }
                const call = JSON.parse(await readBody(request));
                if (!call || typeof call.permission !== 'string') {
                    respond(response, 400);
                    return;
                }
                try {
                    const result =
                        call.method === 'resource.url'
                            ? pending.host.getUrl(call.permission)
                            : call.method === 'cookies.read'
                              ? await pending.host.getCookies(call.permission)
                              : undefined;
                    if (result === undefined) {
                        respond(response, 400);
                        return;
                    }
                    // Resource values travel only over this authenticated loopback response.
                    response.writeHead(200, {
                        'content-type': 'application/json',
                        'cache-control': 'no-store',
                    });
                    response.end(JSON.stringify(result));
                } catch {
                    respond(response, 403);
                }
                return;
            }
            if (!pending.onEvent) {
                respond(response, 400);
                return;
            }
            const terminal = pending.onEvent(
                JSON.parse(await readBody(request)),
                requestId,
            );
            pending.acknowledged = true;
            clearTimeout(pending.acknowledgmentTimer);
            respond(response, 204);
            if (terminal && !pending.terminal) {
                pending.terminal = true;
                clearTimeout(pending.retentionTimer);
                pending.retentionTimer = setTimeout(
                    () => this.cancel(requestId),
                    TERMINAL_RETENTION_MS,
                );
                pending.retentionTimer.unref();
            }
        } catch (error) {
            this.logger.warn(
                'Rejected an invalid external application callback.',
                {
                    message:
                        error instanceof Error ? error.message : String(error),
                },
            );
            respond(response, 400);
        }
    }
}

/** Compares a supplied bearer token without a data-dependent early exit. */
function hasValidAuthorization(
    request: IncomingMessage,
    token: string,
): boolean {
    const provided =
        request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const expectedBuffer = Buffer.from(token);
    const providedBuffer = Buffer.from(provided);
    return (
        expectedBuffer.length === providedBuffer.length &&
        timingSafeEqual(expectedBuffer, providedBuffer)
    );
}

/** Returns whether the peer is a supported loopback representation. */
function isLoopbackAddress(value?: string): boolean {
    return (
        value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1'
    );
}

/** Reads one bounded UTF-8 request body. */
async function readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const value of request) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        size += chunk.length;
        if (size > CALLBACK_BODY_LIMIT)
            throw new Error('Callback body exceeds 64 KiB.');
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
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
