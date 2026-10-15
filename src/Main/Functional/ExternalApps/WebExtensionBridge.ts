import {
    connectionPage,
    connectionPageCss,
    connectionPageScript,
    type ConnectionPageLabels,
} from './ConnectionPage';
import {
    createServer,
    type IncomingMessage,
    type ServerResponse,
    type Server,
} from 'node:http';
import {
    randomBytes,
    createHash,
    createHmac,
    timingSafeEqual,
} from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
    WEB_EXTENSION_DISCOVERY_PORTS,
    resolveWebExtensionProvider,
    validateWebExtensionProviders,
    webExtensionPermissionKey,
    webExtensionSettings,
    type WebExtensionResult,
    type WebExtensionProvider,
    type WebExtensionAction,
} from '@kawaikara/site-api';

/** One desktop-approved origin and operation scope. */
interface Grant {
    /** Provider identity. */
    id: string;
    /** Scope fingerprint; additions invalidate previous consent. */
    key: string;
    /** Explicitly enabled operations. */
    actions: WebExtensionAction[];
    /** Provider-declared browser preference values. */
    settings: Record<string, boolean>;
}

/** Independent authorization for one browser installation/profile. */
interface BrowserClient {
    id: string;
    client: string;
    instance?: string;
    token: string;
    grants: Grant[];
    revoked?: boolean;
    extension?: { version: string; development: boolean; browser: string; connectionMode?: "development" | "production"; name?: string; icon?: string; browserVersion?: string; os?: string; osVersion?: string; cpu?: string; };
}
interface BridgeState {
    port: number;
    useDevelopment?: boolean;
    clients: BrowserClient[];
}

/** Desktop dependencies, kept separate from the transport for tests and reuse. */
export interface WebExtensionBridgeOptions {
    /** Credential file inside the current desktop profile. */
    statePath: string;
    development?: boolean;
    pageLabels?(): ConnectionPageLabels;
    pageImage?(): Promise<Buffer>;
    /** Null when this runtime cannot be launched by the OS (unpackaged macOS/Linux). */
    launchUrl?: string | null;
    /** Authenticated instance details; never exposed by public discovery. */
    desktop?: {
        name: string;
        version: string;
        channel: string;
        runtime: string;
        appPath: string;
        profileId: string;
    };
    /** Focuses the authenticated running app without an OS protocol round trip. */
    focus?(): void;
    /** Reads all currently installed Provider declarations. */
    providers(): WebExtensionProvider[];
    /** Performs the desktop operation after current authorization is checked. */
    execute(
        providerId: string,
        action: WebExtensionAction,
        url: string,
        settings: Readonly<Record<string, boolean>>,
    ): Promise<WebExtensionResult | void>;
    /** Confirms pairing or a scoped permission request in trusted desktop UI. */
    confirm(detail: string): Promise<boolean>;
}

/** Authenticated loopback adapter; no Electron or OS-specific APIs are needed. */
export class WebExtensionBridge {
    /** Current persistent authorization. */
    private state: BridgeState = { port: 0, clients: [] };
    /** Active listener. */
    private server?: Server;
    /** Stable discovery listener for code-free connection to running desktop profiles. */
    private discoveryServer?: Server;
    /** Limits unauthenticated native consent prompts. */
    private nextConnectAt = 0;
    /** One-use app-initiated authorization, never published by discovery. */
    private handoff?: { token: string; expires: number; development: boolean };
    /** Short-lived, single-use setup credential. */
    private setup?: {
        /** The token value. */
        token: string;
        /** The expires value. */
        expires: number;
    };
    /** Serializes consent dialogs and prevents duplicate operation submission. */
    private busy = false;
    /** Changes whenever setup or authorization is explicitly replaced. */
    private generation = 0;
    /** Serializes credential writes without discarding newer revocations. */
    private writes: Promise<void> = Promise.resolve();
    /** Bounded deduplication set for side-effecting requests in this process. */
    private readonly requests = new Set<string>();
    /** Builds an inert bridge; start is explicit. */
    constructor(
        /** The options value. */
        private readonly options: WebExtensionBridgeOptions,
    ) {}

    /** Restores pairing and binds only the IPv4 loopback interface. */
    async start(): Promise<void> {
        try {
            const saved = JSON.parse(
                await readFile(this.options.statePath, 'utf8'),
            );
            if (
                Number.isInteger(saved.port) &&
                saved.port >= 1024 &&
                saved.port <= 65535
            ) {
                const clients = Array.isArray(saved.clients)
                    ? saved.clients
                    : typeof saved.client === 'string' &&
                        /^[a-f0-9]{64}$/.test(saved.token)
                      ? [
                            {
                                id: randomBytes(16).toString('hex'),
                                client: saved.client,
                                token: saved.token,
                                grants: saved.grants,
                                extension: saved.extension,
                            },
                        ]
                      : [];
                this.state = {
                    port: saved.port,
                    useDevelopment:
                        typeof saved.useDevelopment === 'boolean'
                            ? saved.useDevelopment
                            : undefined,
                    clients: clients.filter(
                        (c: BrowserClient) =>
                            c &&
                            typeof c.id === 'string' &&
                            typeof c.client === 'string' &&
                            /^[a-f0-9]{64}$/.test(c.token) &&
                            Array.isArray(c.grants),
                    ),
                };
            }
        } catch {
            /* First run requires pairing. */
        }
        for (const client of this.state.clients)
            client.grants = this.snapshot(client).grants;
        /** Performs the bind operation. */
        const bind = (port: number): Promise<Server> =>
            new Promise((resolve, reject) => {
                const server = createServer((request, response) => {
                    void this.handle(request, response);
                });
                server.requestTimeout = 10_000;
                server.headersTimeout = 10_000;
                server.on('error', reject);
                server.listen(port, '127.0.0.1', () => resolve(server));
            });
        this.server = await bind(this.state.port).catch(() => bind(0));
        const address = this.server.address();
        if (!address || typeof address === 'string')
            throw new Error('Bridge has no loopback port.');
        this.state.port = address.port;
        await this.persist();
        for (const port of WEB_EXTENSION_DISCOVERY_PORTS) {
            if (port === this.state.port) break;
            try {
                this.discoveryServer = await bind(port);
                break;
            } catch {
                /* Another profile or local service owns this discovery slot. */
            }
        }
    }

    /** Creates an expiring setup code without changing existing browser authorizations. */
    async createConnectionCode(): Promise<string> {
        this.handoff = undefined;
        this.generation++;
        this.setup = {
            token: randomBytes(32).toString('hex'),
            expires: Date.now() + 600_000,
        };
        await this.persist();
        return JSON.stringify({
            /** The version value. */
            version: 1,
            /** The URL value. */
            url: `http://127.0.0.1:${this.state.port}`,
            /** The token value. */
            token: this.setup.token,
        });
    }

    /** Opens a two-minute connection window without revoking an existing pairing. */
    createConnectionUrl(development = this.connectionStatus().useDevelopment): string {
        if (!this.server) throw new Error('Bridge is unavailable.');
        this.handoff = {
            token: randomBytes(32).toString('hex'),
            expires: Date.now() + 120_000,
            development,
        };
        return `http://127.0.0.1:${this.state.port}/extension-connect#${this.handoff.token}:${this.handoff.development ? 'development' : 'production'}`;
    }

    /** Public connection metadata never includes credentials. */
    connectionStatus() {
        const connections = this.state.clients
            .filter((c) => !c.revoked)
            .map((c) => ({
                id: c.id,
                client: c.client,
                extension: c.extension,
            }));
        return {
            connected: connections.length > 0,
            useDevelopment:
                this.state.useDevelopment ?? this.options.development ?? false,
            client: connections[0]?.client ?? '',
            extension: connections[0]?.extension,
            connections,
        };
    }
    /** Persist the automatic extension selection independently of pairing. */
    async setDevelopment(value: boolean): Promise<void> {
        this.generation++;
        this.state.useDevelopment = value;
        this.handoff = undefined;
        await this.persist();
    }

    /** Immediately invalidates both active and pending connections. */
    async revoke(id?: string): Promise<void> {
        this.setup = undefined;
        this.handoff = undefined;
        this.generation++;
        for (const client of this.state.clients)
            if (!id || client.id === id) {
                client.revoked = true;
                client.grants = [];
            }
        await this.persist();
    }

    /** Closes connections before application shutdown. */
    async dispose(): Promise<void> {
        this.handoff = undefined;
        this.generation++;
        this.setup = undefined;
        this.discoveryServer?.closeAllConnections();
        await new Promise<void>((resolve) =>
            this.discoveryServer
                ? this.discoveryServer.close(() => resolve())
                : resolve(),
        );
        this.discoveryServer = undefined;
        this.server?.closeAllConnections();
        await new Promise<void>((resolve) =>
            this.server ? this.server.close(() => resolve()) : resolve(),
        );
        this.server = undefined;
        await this.writes;
    }

    /** Prunes grants immediately on Provider removal or a permission-scope change. */
    async invalidateCatalog(): Promise<void> {
        for (const client of this.state.clients)
            client.grants = this.snapshot(client).grants;
        await this.persist();
    }

    /** Produces a content-addressed snapshot; unchanged polling transfers no catalog body. */
    private snapshot(session?: BrowserClient) {
        const providers = this.options.providers();
        validateWebExtensionProviders(providers);
        const grants = (session?.revoked ? [] : (session?.grants ?? [])).filter(
            (grant) =>
                providers.some(
                    (provider) =>
                        provider.id === grant.id &&
                        webExtensionPermissionKey(provider) === grant.key,
                ),
        );
        const payload = {
            version: 2,
            providers,
            grants,
            desktop: this.options.desktop,
            launchUrl:
                this.options.launchUrl === undefined
                    ? 'kawaikara://bridge/wake'
                    : this.options.launchUrl,
        };
        const revision = createHash('sha256')
            .update(JSON.stringify(payload))
            .digest('hex');
        return {
            ...payload,
            /** The revision value. */
            revision,
        };
    }

    /** Validates transport origin, authentication, payload size and current authorization. */
    private async handle(
        request: IncomingMessage,
        response: ServerResponse,
    ): Promise<void> {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Content-Type', 'application/json');
        /** Performs the reply operation. */
        const reply = (status: number, body: unknown) => {
            response.statusCode = status;
            response.end(JSON.stringify(body));
        };
        if (
            request.method === 'GET' &&
            [
                '/extension-connect',
                '/extension-connect-status.js',
                '/extension-connect.css',
                '/extension-connect.png',
            ].includes(request.url || '') &&
            request.headers.host === `127.0.0.1:${this.state.port}` &&
            request.socket.localPort === this.state.port
        ) {
            response.setHeader('X-Content-Type-Options', 'nosniff');
            response.setHeader('Referrer-Policy', 'no-referrer');
            if (request.url === '/extension-connect.png') {
                try {
                    const image = await this.options.pageImage?.();
                    if (!image) throw new Error('No image');
                    response.setHeader('Content-Type', 'image/png');
                    response.end(image);
                } catch {
                    response.statusCode = 404;
                    response.end();
                }
            } else if (request.url === '/extension-connect.css') {
                response.setHeader('Content-Type', 'text/css; charset=utf-8');
                response.end(connectionPageCss);
            } else if (request.url === '/extension-connect-status.js') {
                response.setHeader(
                    'Content-Type',
                    'application/javascript; charset=utf-8',
                );
                response.end(connectionPageScript);
            } else {
                response.setHeader('Content-Type', 'text/html; charset=utf-8');
                response.setHeader(
                    'Content-Security-Policy',
                    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
                );
                response.end(connectionPage(this.options.pageLabels?.()));
            }
            return;
        }
        const client = request.headers['x-kawaikara-client'];
        const origin = request.headers.origin;
        const validClient =
            typeof client === 'string' &&
            /^(chrome-extension:\/\/[a-p]{32}|moz-extension:\/\/[a-zA-Z0-9-]{1,80})$/.test(
                client,
            );
        // No web-page CORS grants, wildcard origins, DNS hostnames, cookies or query tokens.
        if (
            request.headers.host !== `127.0.0.1:${request.socket.localPort}` ||
            !validClient ||
            (origin && origin !== client)
        ) {
            reply(403, { error: 'forbidden' });
            return;
        }
        const instanceValue = request.headers['x-kawaikara-instance'];
        const instance =
            typeof instanceValue === 'string' &&
            /^[a-f0-9-]{36}$/.test(instanceValue)
                ? instanceValue
                : undefined;
        const discovery = new URL(request.url || '/', 'http://127.0.0.1');
        if (discovery.pathname === '/v1/discover' && request.method === 'GET') {
            const url = `http://127.0.0.1:${this.state.port}`;
            const nonce = discovery.searchParams.get('nonce') || '';
            // Revoked clients may verify a moved listener so they can receive signed revocation.
            const known =
                this.state.clients.find(
                    (c) =>
                        c.client === client &&
                        c.instance === instance,
                ) ??
                this.state.clients.find(
                    (c) => c.client === client && !c.instance,
                );
            const proof =
                /^[a-f0-9]{64}$/.test(nonce) && known
                    ? createHmac('sha256', known.token)
                          .update(`${nonce}\n${url}\n${client}`)
                          .digest('hex')
                    : undefined;
            reply(200, {
                protocol: 'kawaikara-web-extension',
                adapterVersion: 2,
                development: this.options.development ?? false,
                url,
                ...(proof ? { proof } : {}),
            });
            return;
        }
        const automatic =
            request.url === '/v1/connect' && request.method === 'POST';
        const token =
            request.headers.authorization?.replace(/^Bearer /, '') ?? '';
        /** Performs the matches operation. */
        const matches = (secret: string) =>
            /^[a-f0-9]{64}$/.test(secret) &&
            /^[a-f0-9]{64}$/.test(token) &&
            timingSafeEqual(Buffer.from(secret), Buffer.from(token));
        const authenticated = this.state.clients.find(
            (c) => c.client === client && matches(c.token),
        );
        const session: BrowserClient = authenticated ??
            this.state.clients.find(
                (c) => c.client === client && c.instance === instance,
            ) ?? {
                id: randomBytes(16).toString('hex'),
                client,
                instance,
                token: '',
                grants: [],
            };
        if (authenticated?.revoked) {
            const nonce = request.headers['x-kawaikara-nonce'];
            const proof =
                typeof nonce === 'string' && /^[a-f0-9-]{36}$/.test(nonce)
                    ? createHmac('sha256', authenticated.token)
                          .update(`revoked\n${nonce}\n${client}`)
                          .digest('hex')
                    : undefined;
            reply(401, { error: 'revoked', proof });
            return;
        }
        const pairing = request.url === '/v1/pair' && request.method === 'POST';
        if (
            !automatic &&
            (pairing
                ? !this.setup ||
                  this.setup.expires < Date.now() ||
                  !matches(this.setup.token)
                : !authenticated || authenticated.revoked)
        ) {
            reply(401, { error: 'unpaired' });
            return;
        }
        const generation = this.generation;
        const authenticatedToken = session.token;
        try {
            if (request.url === '/v1/catalog' && request.method === 'GET') {
                const snapshot = this.snapshot(session);
                response.setHeader('ETag', `"${snapshot.revision}"`);
                if (
                    request.headers['if-none-match'] ===
                    `"${snapshot.revision}"`
                ) {
                    response.statusCode = 304;
                    response.end();
                } else reply(200, snapshot);
                return;
            }
            if (
                request.method !== 'POST' ||
                request.headers['content-type'] !== 'application/json'
            ) {
                reply(400, { error: 'invalid-request' });
                return;
            }
            if (this.busy) {
                reply(409, { error: 'busy' });
                return;
            }
            this.busy = true;
            try {
                let body = '';
                for await (const chunk of request) {
                    body += chunk.toString();
                    if (
                        Buffer.byteLength(body) >
                        (request.url === '/v1/configure' ? 524_288 : 16_384)
                    ) {
                        reply(413, { error: 'too-large' });
                        request.destroy();
                        return;
                    }
                }
                const data = JSON.parse(body || '{}');
                if (
                    generation !== this.generation ||
                    (!pairing && authenticatedToken !== session.token)
                ) {
                    reply(401, { error: 'revoked' });
                    return;
                }
                if (automatic) {
                    if (data.adapterVersion !== 2) {
                        reply(400, { error: 'unsupported-adapter-version' });
                        return;
                    }
                    const ticket = this.handoff;
                    const appInitiated =
                        typeof data.handoff === 'string' &&
                        /^[a-f0-9]{64}$/.test(data.handoff) &&
                        ticket &&
                        ticket.expires >= Date.now() &&
                        timingSafeEqual(
                            Buffer.from(ticket.token),
                            Buffer.from(data.handoff),
                        );
                    if (data.handoff !== undefined && !appInitiated) {
                        reply(403, { error: 'handoff-expired-or-invalid' });
                        return;
                    }
                    if (
                        appInitiated &&
                        ticket.development !==
                            (data.extension?.development === true)
                    ) {
                        reply(409, { error: 'extension-channel-mismatch' });
                        return;
                    }
                    if (appInitiated) this.handoff = undefined;
                    if (!appInitiated && Date.now() < this.nextConnectAt) {
                        reply(429, { error: 'connection-rate-limited' });
                        return;
                    }
                    this.nextConnectAt = Date.now() + 10_000;
                    if (
                        (!appInitiated &&
                            !(await this.options.confirm(
                                `Connect browser extension ${client}? Site access is approved separately.`,
                            ))) ||
                        generation !== this.generation ||
                        response.destroyed
                    ) {
                        reply(403, { error: 'denied' });
                        return;
                    }
                    if (session.revoked) session.grants = [];
                    this.setup = undefined;
                    this.handoff = undefined;
                    this.generation++;
                    session.client = client;
                    session.extension = {
                        connectionMode: data.extension?.development === true ? "development" : "production",
                        ...Object.fromEntries(['name', 'browserVersion', 'os', 'osVersion', 'cpu'].flatMap(key =>
                            typeof data.extension?.[key] === 'string' ? [[key, data.extension[key].slice(0, 160)]] : [])),
                        ...(typeof data.extension?.icon === 'string' && data.extension.icon.length <= 13000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.extension.icon) ? { icon: data.extension.icon } : {}),
                        version:
                            typeof data.extension?.version === 'string'
                                ? data.extension.version.slice(0, 64)
                                : 'unknown',
                        development:
                            typeof data.extension?.buildDevelopment ===
                            'boolean'
                                ? data.extension.buildDevelopment
                                : data.extension?.development === true,
                        browser: client.startsWith('moz-extension:')
                            ? 'Firefox'
                            : 'Chrome',
                    };
                    session.token = randomBytes(32).toString('hex');
                    session.instance = instance;
                    session.revoked = false;
                    this.state.clients = [
                        ...this.state.clients.filter(
                            (c) => c.id !== session.id,
                        ),
                        session,
                    ];
                    await this.persist();
                    reply(200, {
                        token: session.token,
                        adapterVersion: 2,
                        launchUrl:
                            this.options.launchUrl === undefined
                                ? 'kawaikara://bridge/wake'
                                : this.options.launchUrl,
                    });
                    return;
                }
                if (pairing) {
                    if (data.adapterVersion !== 2) {
                        reply(400, { error: 'unsupported-adapter-version' });
                        return;
                    }
                    const pending = this.setup;
                    this.setup = undefined;
                    if (
                        !(await this.options.confirm(
                            `Connect browser extension ${client}? Site access is approved separately.`,
                        )) ||
                        generation !== this.generation ||
                        !pending ||
                        pending.expires < Date.now()
                    ) {
                        reply(403, { error: 'denied' });
                        return;
                    }
                    session.client = client;
                    session.extension = {
                        connectionMode: data.extension?.development === true ? "development" : "production",
                        ...Object.fromEntries(['name', 'browserVersion', 'os', 'osVersion', 'cpu'].flatMap(key =>
                            typeof data.extension?.[key] === 'string' ? [[key, data.extension[key].slice(0, 160)]] : [])),
                        ...(typeof data.extension?.icon === 'string' && data.extension.icon.length <= 13000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.extension.icon) ? { icon: data.extension.icon } : {}),
                        version:
                            typeof data.extension?.version === 'string'
                                ? data.extension.version.slice(0, 64)
                                : 'unknown',
                        development:
                            typeof data.extension?.buildDevelopment ===
                            'boolean'
                                ? data.extension.buildDevelopment
                                : data.extension?.development === true,
                        browser: client.startsWith('moz-extension:')
                            ? 'Firefox'
                            : 'Chrome',
                    };
                    session.token = randomBytes(32).toString('hex');
                    session.instance = instance;
                    session.revoked = false;
                    this.state.clients = [
                        ...this.state.clients.filter(
                            (c) => c.id !== session.id,
                        ),
                        session,
                    ];
                    await this.persist();
                    reply(200, {
                        token: session.token,
                        adapterVersion: 2,
                        launchUrl:
                            this.options.launchUrl === undefined
                                ? 'kawaikara://bridge/wake'
                                : this.options.launchUrl,
                    });
                    return;
                }
                if (request.url === '/v1/wake') {
                    this.options.focus?.();
                    reply(200, { ok: true });
                    return;
                }
                if (request.url === '/v1/disconnect') {
                    await this.revoke(session.id);
                    reply(200, { ok: true });
                    return;
                }
                const authorization = session.token;
                const snapshot = this.snapshot(session);
                if (request.url === '/v1/configure') {
                    if (data.revision !== snapshot.revision) {
                        reply(409, { error: 'catalog-changed' });
                        return;
                    }
                    if (
                        !Array.isArray(data.changes) ||
                        !data.changes.length ||
                        data.changes.length > snapshot.providers.length
                    ) {
                        reply(400, { error: 'invalid-changes' });
                        return;
                    }
                    const ids = new Set<string>();
                    const next = new Map(
                        snapshot.grants.map((grant) => [grant.id, grant]),
                    );
                    const summary: string[] = [];
                    for (const change of data.changes) {
                        if (
                            !change ||
                            typeof change.providerId !== 'string' ||
                            typeof change.enabled !== 'boolean' ||
                            ids.has(change.providerId)
                        ) {
                            reply(400, { error: 'invalid-changes' });
                            return;
                        }
                        ids.add(change.providerId);
                        const entry = snapshot.providers.find(
                            (provider) => provider.id === change.providerId,
                        );
                        if (!entry) {
                            reply(404, { error: 'provider-removed' });
                            return;
                        }
                        if (change.enabled) {
                            const settings = webExtensionSettings(
                                entry,
                                change.settings ?? {},
                            );
                            next.set(entry.id, {
                                id: entry.id,
                                key: webExtensionPermissionKey(entry),
                                actions: [...entry.actions],
                                settings,
                            });
                            summary.push(
                                `${entry.title} (${entry.id}) — ${snapshot.grants.some((grant) => grant.id === entry.id) ? 'Update' : 'Enable'}\nSites: ${entry.domains.join(', ')}\nActions: ${Object.values(
                                    entry.actionDefinitions,
                                )
                                    .map((action) => action.title)
                                    .join(
                                        ', ',
                                    )}\nDOM access: ${Boolean(entry.domActions?.length)}\nSettings: ${
                                    Object.entries(settings)
                                        .map(
                                            ([key, value]) =>
                                                `${key}: ${value}`,
                                        )
                                        .join(', ') || 'None'
                                }`,
                            );
                        } else {
                            next.delete(entry.id);
                            summary.push(
                                `${entry.title} (${entry.id}) — Disable`,
                            );
                        }
                    }
                    if (
                        !(await this.options.confirm(
                            `${data.changes.length} Provider changes\n\n${summary.join('\n\n')}`,
                        ))
                    ) {
                        reply(403, { error: 'denied' });
                        return;
                    }
                    if (
                        generation !== this.generation ||
                        authorization !== session.token ||
                        session.revoked ||
                        response.destroyed ||
                        this.snapshot(session).revision !== snapshot.revision
                    ) {
                        reply(409, { error: 'authorization-changed' });
                        return;
                    }
                    const previous = session.grants;
                    session.grants = [...next.values()];
                    try {
                        await this.persist();
                    } catch (error) {
                        session.grants = previous;
                        throw error;
                    }
                    reply(200, { ok: true });
                    return;
                }
                const provider = snapshot.providers.find(
                    (entry) => entry.id === data.providerId,
                );
                if (!provider) {
                    reply(404, { error: 'provider-removed' });
                    return;
                }
                if (request.url === '/v1/revoke') {
                    session.grants = session.grants.filter(
                        (grant) => grant.id !== provider.id,
                    );
                    await this.persist();
                    reply(200, { ok: true });
                    return;
                }
                if (data.revision !== snapshot.revision) {
                    reply(409, { error: 'catalog-changed' });
                    return;
                }
                if (request.url === '/v1/settings') {
                    const grant = session.grants.find(
                        (entry) =>
                            entry.id === provider.id &&
                            entry.key === webExtensionPermissionKey(provider),
                    );
                    if (!grant) {
                        reply(403, { error: 'provider-disabled' });
                        return;
                    }
                    grant.settings = webExtensionSettings(
                        provider,
                        data.settings,
                    );
                    await this.persist();
                    reply(200, { ok: true });
                    return;
                }
                if (request.url === '/v1/grant') {
                    if (
                        !Array.isArray(data.actions) ||
                        data.actions.length !== provider.actions.length ||
                        new Set(data.actions).size !== data.actions.length ||
                        data.actions.some(
                            (action: WebExtensionAction) =>
                                !provider.actions.includes(action),
                        )
                    ) {
                        reply(400, { error: 'invalid-actions' });
                        return;
                    }
                    const settings = webExtensionSettings(
                        provider,
                        data.settings ?? {},
                    );
                    const key = webExtensionPermissionKey(provider);
                    if (
                        !(await this.options.confirm(
                            `${provider.title} (${provider.id})\nSites (including subdomains): ${provider.domains.join(', ')}\nActions: ${data.actions.join(', ')}\nDOM access: ${Boolean(provider.domActions?.length)}`,
                        ))
                    ) {
                        reply(403, { error: 'denied' });
                        return;
                    }
                    const current = this.snapshot(session).providers.find(
                        (entry) => entry.id === provider.id,
                    );
                    if (
                        authorization !== session.token ||
                        session.revoked ||
                        !current ||
                        key !== webExtensionPermissionKey(current)
                    ) {
                        reply(409, { error: 'authorization-changed' });
                        return;
                    }
                    session.grants = [
                        ...session.grants.filter(
                            (grant) => grant.id !== provider.id,
                        ),
                        {
                            id: provider.id,
                            key,
                            settings,
                            actions: [
                                ...new Set<WebExtensionAction>(data.actions),
                            ],
                        },
                    ];
                    await this.persist();
                    reply(200, { ok: true });
                    return;
                }
                if (request.url === '/v1/invoke') {
                    const grant = snapshot.grants.find(
                        (entry) => entry.id === provider.id,
                    );
                    if (
                        !grant?.actions.includes(data.action) ||
                        typeof data.url !== 'string' ||
                        resolveWebExtensionProvider([provider], data.url)
                            ?.id !== provider.id ||
                        typeof data.requestId !== 'string' ||
                        !/^[a-zA-Z0-9-]{16,80}$/.test(data.requestId)
                    ) {
                        reply(403, { error: 'permission-denied' });
                        return;
                    }
                    if (this.requests.has(data.requestId)) {
                        reply(409, { error: 'duplicate-request' });
                        return;
                    }
                    if (this.requests.size >= 4096) {
                        reply(429, { error: 'session-request-limit' });
                        return;
                    }
                    this.requests.add(data.requestId);
                    const target = new URL(data.url);
                    target.protocol = 'https:';
                    const result = await this.options.execute(
                        provider.id,
                        data.action,
                        target.href,
                        webExtensionSettings(provider, grant.settings ?? {}),
                    );
                    if (result !== undefined && (result === null || typeof result !== 'object' || Array.isArray(result) || Object.keys(result).some(key => key !== 'clipboard'))) {
                        reply(400, { error: 'invalid-browser-effect' });
                        return;
                    }
                    if (
                        result?.clipboard !== undefined &&
                        (!provider.actionDefinitions[data.action]?.clipboard ||
                            typeof result.clipboard !== 'string' ||
                            result.clipboard.length > 16384)
                    ) {
                        reply(400, { error: 'invalid-browser-effect' });
                        return;
                    }
                    reply(200, {
                        ok: true,
                        ...(result?.clipboard === undefined
                            ? {}
                            : { clipboard: result.clipboard }),
                    });
                    return;
                }
                reply(404, { error: 'unknown-operation' });
            } finally {
                this.busy = false;
            }
        } catch {
            if (!response.writableEnded)
                reply(400, { error: 'request-failed' });
        }
    }

    /** Atomically stores credentials with owner-only POSIX permissions. */
    private persist(): Promise<void> {
        const state = JSON.stringify(this.state);
        this.writes = this.writes
            .catch(() => undefined)
            .then(async () => {
                await mkdir(path.dirname(this.options.statePath), {
                    recursive: true,
                });
                const temporary = `${this.options.statePath}.tmp`;
                await writeFile(temporary, state, { mode: 0o600 });
                await rename(temporary, this.options.statePath);
            });
        return this.writes;
    }
}
