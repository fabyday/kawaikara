import {
    clients,
    isRevoked,
    revokeBinding,
    writeRecord,
} from './LocalConnectionRecords';
import type { ExternalAppIconCache } from './ExternalAppIconCache';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { externalAppConnectionDirectory } from './ConnectionDirectories';
import path from 'node:path';

/** Private per-user discovery directory. Production apps never publish here. */
export const DEVELOPMENT_DISCOVERY_DIRECTORY = externalAppConnectionDirectory(true);

/** Durable binding to one approved development environment, never sent to Renderer. */
interface Binding {
    /** The client ID value. */
    clientId: string;
    /** The key value. */
    key: string;
}
/** Authenticated development transport callbacks supplied by application composition. */
export interface DevelopmentConnectionAuthority {
    /** Registers the operation. */
    register(appId: string): Promise<boolean>;
    /** Performs the registered operation. */
    registered(appId: string): Promise<boolean>;
    /** Performs the revoke operation. */
    revoke(appId: string): Promise<void>;
}
/** Writes credentials with private permissions and atomic replacement. */
async function save(file: string, value: unknown): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporary, JSON.stringify(value), {
            mode: 0o600,
            flag: 'wx',
        });
        await rename(temporary, file);
    } finally {
        await rm(temporary, { force: true });
    }
}
/** Constant-time comparison after checking lengths; credentials never enter diagnostics. */
function matches(a: unknown, b: string): boolean {
    return (
        typeof a === 'string' &&
        Buffer.byteLength(a) === Buffer.byteLength(b) &&
        timingSafeEqual(Buffer.from(a), Buffer.from(b))
    );
}
/** Reads a bounded native-only JSON request; browser-originated requests are rejected. */
async function body(
    request: IncomingMessage,
): Promise<Record<string, unknown>> {
    if (
        request.method !== 'POST' ||
        request.headers.origin ||
        request.headers['content-type'] !== 'application/json'
    )
        throw new Error('Invalid request.');
    let data = '';
    for await (const chunk of request) {
        data += chunk.toString();
        if (Buffer.byteLength(data) > 65536)
            throw new Error('Request too large.');
    }
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid payload.');
    return value as Record<string, unknown>;
}

/**
 * Native development-only rendezvous and authenticated handoff transport.
 * One product is bound to one development environment until explicitly revoked.
 * Registration, resource permissions and executable action implementations remain with the host.
 */
export class DevelopmentConnection {
    /** The server value. */
    private server?: Server;
    /** The authority value. */
    private authority?: DevelopmentConnectionAuthority;
    /** The state value. */
    private state: {
        /** The host ID value. */
        hostId: string;
        /** The bindings value. */
        bindings: Record<string, Binding>;
        /** Whether the automatic option is enabled. */
        automatic?: boolean;
    } = {
        /** The host ID value. */
        hostId: randomUUID(),
        /** The bindings value. */
        bindings: {},
    };
    /** The bootstrap value. */
    private readonly bootstrap = randomBytes(32).toString('hex');
    /** The live value. */
    private readonly live = new Map<string, number>();
    /** The pending value. */
    private readonly pending = new Map<
        string,
        {
            /** The app ID value. */
            appId: string;
            /** The deep link value. */
            deepLink: string;
            /** Whether the active option is enabled. */
            active: () => boolean;
            /** Callback used to handle resolve. */
            resolve: (accepted: boolean) => void;
        }
    >();
    /** The connecting value. */
    private connecting = false;
    /** The generations value. */
    private readonly generations = new Map<string, number>();
    /** The writes value. */
    private writes: Promise<void> = Promise.resolve();
    /** The closed value. */
    private closed = false;
    /** The timer value. */
    private timer?: NodeJS.Timeout;
    /** The reconciling value. */
    private reconciling?: Promise<void>;

    /**
     * @param stateFile Private durable host identity and approved client credentials.
     * @param appIds Trusted adapter identities; remote peers cannot introduce executable adapters.
     * @param directory Discovery override for isolated tests.
     */
    constructor(
        private readonly stateFile: string,
        private readonly appIds: readonly string[],
        private readonly directory = DEVELOPMENT_DISCOVERY_DIRECTORY,
        /** The icon cache value. */
        readonly iconCache?: ExternalAppIconCache,
    ) {}

    /** Loads bindings, starts an IPv4 loopback listener, then publishes this running host. */
    async start(authority: DevelopmentConnectionAuthority): Promise<void> {
        this.authority = authority;
        await this.iconCache?.load();
        try {
            const stored = JSON.parse(await readFile(this.stateFile, 'utf8'));
            if (
                typeof stored.hostId !== 'string' ||
                !/^[a-f0-9-]{36}$/.test(stored.hostId) ||
                !stored.bindings ||
                typeof stored.bindings !== 'object'
            )
                throw new Error('Invalid development state.');
            for (const binding of Object.values(stored.bindings) as Binding[]) {
                if (
                    !binding ||
                    !/^[a-f0-9-]{36}$/.test(binding.clientId) ||
                    !/^[a-f0-9]{64}$/.test(binding.key)
                )
                    throw new Error('Invalid development binding.');
            }
            this.state = stored;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        await this.reconcile();
        await this.persist();
        const server = (this.server = createServer((request, response) => {
            void (async () => {
                const address = server.address();
                if (
                    !address ||
                    typeof address === 'string' ||
                    request.headers.host !== `127.0.0.1:${address.port}` ||
                    !matches(
                        request.headers.authorization,
                        `Bearer ${this.bootstrap}`,
                    )
                )
                    throw new Error('Unauthorized.');
                const result = await this.handle(
                    request.url,
                    await body(request),
                );
                response.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store',
                });
                response.end(JSON.stringify(result));
            })().catch(() => {
                if (!response.headersSent) response.writeHead(403);
                response.end();
            });
        }));
        server.requestTimeout = 150000;
        server.headersTimeout = 5000;
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        const address = server.address();
        if (!address || typeof address === 'string')
            throw new Error('No development endpoint.');
        await save(path.join(this.directory, `${this.state.hostId}.json`), {
            schemaVersion: 1,
            mode: 'development',
            hostId: this.state.hostId,
            pid: process.pid,
            endpoint: `http://127.0.0.1:${address.port}`,
            token: this.bootstrap,
            automatic: this.state.automatic !== false,
        });
        this.timer = setInterval(() => {
            void this.reconcile().catch(() => {});
        }, 1500);
        this.timer.unref();
    }

    /** Applies durable peer revocations even when the peer is no longer running. */
    async reconcile(): Promise<void> {
        if (this.reconciling) return this.reconciling;
        this.reconciling = (async () => {
            for (const [appId, binding] of Object.entries(
                this.state.bindings,
            )) {
                if (
                    await isRevoked(
                        this.directory,
                        this.state.hostId,
                        binding.clientId,
                        binding.key,
                    )
                ) {
                    await this.authority!.revoke(appId);
                    await this.forget(appId);
                }
            }
        })();
        try {
            await this.reconciling;
        } finally {
            this.reconciling = undefined;
        }
    }

    /** Lists running supported apps without exposing rendezvous credentials to Renderer. */
    async candidates(): Promise<{
      /** The app ID value. */
      appId: string;
      /** The client ID value. */
      clientId: string }[]> {
        return (await clients(this.directory))
            .filter(
                (item) =>
                    this.appIds.includes(item.appId) &&
                    !this.state.bindings[item.appId],
            )
            .map(({ appId, clientId }) => ({ appId, clientId }));
    }

    /** Requests a handshake from a selected live client. Consent remains in the normal registration flow. */
    async connect(clientId: string): Promise<void> {
        const candidate = (await clients(this.directory)).find(
            (item) =>
                item.clientId === clientId && this.appIds.includes(item.appId),
        );
        if (!candidate || this.state.bindings[candidate.appId])
            throw new Error('Connection candidate unavailable.');
        await writeRecord(
            path.join(this.directory, 'invitations', `${clientId}.json`),
            {
                hostId: this.state.hostId,
                token: candidate.token,
                createdAt: Date.now(),
            },
        );
    }

    /** Controls discovery invitations; existing approved bindings continue to work. */
    async setAutomatic(enabled: boolean): Promise<void> {
        this.state.automatic = enabled;
        await this.persist();
        const address = this.server?.address();
        if (address && typeof address !== 'string')
            await writeRecord(
                path.join(this.directory, `${this.state.hostId}.json`),
                {
                    schemaVersion: 1,
                    mode: 'development',
                    hostId: this.state.hostId,
                    pid: process.pid,
                    endpoint: `http://127.0.0.1:${address.port}`,
                    token: this.bootstrap,
                    automatic: enabled,
                },
            );
    }
    /** Returns the automatic. */
    get automatic(): boolean {
        return this.state.automatic !== false;
    }

    /** True only while this authenticated peer is actively polling; never searches installed apps. */
    online(appId: string): boolean {
        return !this.closed && Date.now() - (this.live.get(appId) ?? 0) < 6000;
    }

    /** Queues one handoff and waits for receiver acknowledgment, bounded to ten seconds/32 requests. */
    async launch(
        appId: string,
        deepLink: string,
        active: () => boolean = () => true,
    ): Promise<void> {
        if (!this.online(appId) || this.pending.size >= 32)
            throw new Error('Development app must be running.');
        const id = randomUUID();
        const accepted = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                resolve(false);
            }, 10000);
            this.pending.set(id, {
                appId,
                deepLink,
                active,
                resolve: (value) => {
                    clearTimeout(timer);
                    resolve(value);
                },
            });
        });
        if (!accepted)
            throw new Error('Development app did not accept the handoff.');
    }

    /** Drops credentials and all queued work after registration revocation. */
    async forget(appId: string): Promise<void> {
        const binding = this.state.bindings[appId];
        if (binding)
            await revokeBinding(
                this.directory,
                this.state.hostId,
                binding.clientId,
                binding.key,
            );
        this.generations.set(appId, (this.generations.get(appId) ?? 0) + 1);
        delete this.state.bindings[appId];
        this.live.delete(appId);
        for (const [id, item] of this.pending)
            if (item.appId === appId) {
                this.pending.delete(id);
                item.resolve(false);
            }
        await this.persist();
        await this.iconCache?.remove(appId).catch(() => {});
    }

    /** Unpublishes the running host, retains approved bindings and settles pending work. */
    async dispose(): Promise<void> {
        this.closed = true;
        clearInterval(this.timer);
        await rm(path.join(this.directory, `${this.state.hostId}.json`), {
            force: true,
        });
        for (const item of this.pending.values()) item.resolve(false);
        this.pending.clear();
        this.server?.closeAllConnections();
        if (this.server)
            await new Promise<void>((resolve) =>
                this.server!.close(() => resolve()),
            );
    }

    /** Serializes credential snapshots so revoke cannot be overwritten by a concurrent connection. */
    private persist(): Promise<void> {
        const snapshot = structuredClone(this.state);
        const next = this.writes.then(() => save(this.stateFile, snapshot));
        this.writes = next.catch(() => {});
        return next;
    }

    /** Dispatches only the fixed protocol operations; no remote code, shell commands or paths. */
    private async handle(
        route: string | undefined,
        value: Record<string, unknown>,
    ): Promise<unknown> {
        const { appId, clientId, key } = value;
        if (
            this.closed ||
            typeof appId !== 'string' ||
            !this.appIds.includes(appId) ||
            typeof clientId !== 'string' ||
            !/^[a-f0-9-]{36}$/.test(clientId) ||
            typeof key !== 'string' ||
            !/^[a-f0-9]{64}$/.test(key)
        )
            throw new Error('Invalid identity.');
        await this.reconcile();
        if (await isRevoked(this.directory, this.state.hostId, clientId, key))
            return {
              /** The connected value. */
              connected: false };
        const existing = this.state.bindings[appId];
        const authenticated =
            existing?.clientId === clientId && matches(key, existing.key);
        if (route === '/connect') {
            if (this.connecting || (existing && !authenticated))
                throw new Error('Already bound.');
            this.connecting = true;
            const generation = this.generations.get(appId) ?? 0;
            try {
                // Missing credentials must not reuse an orphaned permission record.
                if (!existing) await this.authority!.revoke(appId);
                if (!(await this.authority!.register(appId)))
                    return {
                      /** The connected value. */
                      connected: false };
                if (
                    (this.generations.get(appId) ?? 0) !== generation ||
                    (this.closed && !existing)
                ) {
                    // A delayed consent result must not leave orphaned grants after disconnect.
                    await this.authority!.revoke(appId);
                    return {
                      /** The connected value. */
                      connected: false };
                }
                if (this.closed) return {
                  /** The connected value. */
                  connected: false };
                // Never revive a binding removed while the consent request was in flight.
                if (existing && this.state.bindings[appId] !== existing)
                    return {
                      /** The connected value. */
                      connected: false };
                const binding = { clientId, key };
                this.state.bindings[appId] = binding;
                try {
                    await this.persist();
                } catch (error) {
                    delete this.state.bindings[appId];
                    await this.authority!.revoke(appId);
                    throw error;
                }
                if (this.closed || this.state.bindings[appId] !== binding)
                    return {
                      /** The connected value. */
                      connected: false };
                this.live.set(appId, Date.now());
                return {
                    /** The connected value. */
                    connected: true,
                    /** The icon needed value. */
                    iconNeeded: await this.iconCache
                        ?.needs(appId, value.iconHash)
                        .catch(() => false),
                };
            } finally {
                this.connecting = false;
            }
        }
        if (!authenticated) return {
          /** The connected value. */
          connected: false };
        if (route === '/disconnect') {
            await this.forget(appId);
            await this.authority!.revoke(appId);
            return {
              /** The connected value. */
              connected: false };
        }
        if (
            !(await this.authority!.registered(appId)) ||
            this.state.bindings[appId] !== existing
        )
            return {
              /** The connected value. */
              connected: false };
        this.live.set(appId, Date.now());
        if (route === '/icon' && this.iconCache) {
            if (
                typeof value.iconHash !== 'string' ||
                !/^[a-f0-9]{64}$/.test(value.iconHash) ||
                typeof value.png !== 'string'
            )
                throw new Error('Invalid icon payload.');
            await this.iconCache.update(appId, {
                hash: value.iconHash,
                png: value.png,
            });
            if (this.state.bindings[appId] !== existing) {
                await this.iconCache.remove(appId);
                return {
                  /** The connected value. */
                  connected: false };
            }
            return {
              /** The connected value. */
              connected: true };
        }
        if (route === '/poll') {
            for (const [id, item] of this.pending)
                if (item.appId === appId && !item.active()) {
                    this.pending.delete(id);
                    item.resolve(false);
                }
            return {
                /** The connected value. */
                connected: true,
                /** The icon needed value. */
                iconNeeded: await this.iconCache
                    ?.needs(appId, value.iconHash)
                    .catch(() => false),
                /** The requests value. */
                requests: [...this.pending]
                    .filter(([, item]) => item.appId === appId)
                    .map(([id, item]) => ({ id, deepLink: item.deepLink })),
            };
        }
        if (route === '/ack' && typeof value.id === 'string') {
            const item = this.pending.get(value.id);
            if (item?.appId === appId) {
                this.pending.delete(value.id);
                item.resolve(value.accepted === true);
            }
            return {
              /** The connected value. */
              connected: true };
        }
        throw new Error('Unknown operation.');
    }
}
