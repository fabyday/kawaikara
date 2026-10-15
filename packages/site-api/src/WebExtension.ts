/** Loopback discovery ports; catalogs and credentials are never included in discovery. */
export const WEB_EXTENSION_DISCOVERY_PORTS = [43821, 43822, 43823, 43824, 43825, 43826, 43827, 43828, 43829, 43830] as const;

/** Provider-local action identity; executable handlers remain in Kawaikara. */
export type WebExtensionAction = string;

/** Plain-text browser label; manifest titles may reference %locale.message.key%. */
export interface WebExtensionLabel {
    /** Fallback text, or a locale reference resolved by Kawaikara before publication. */
    readonly title: string;
    /** Optional inline translations; built-in Providers keep these in locale.json. */
    readonly translations?: Readonly<Record<string, string>>;
}

/** Metadata describing an action implemented by the desktop. */
export interface WebExtensionActionDefinition extends WebExtensionLabel {
    /** Desktop routing only; the browser adapter does not interpret these handlers. */
    readonly handler: 'open' | 'download' | 'share-link' | 'provider';
    /** Authorizes a text clipboard effect returned by this action. */
    readonly clipboard?: boolean;
}

/** Provider-declared boolean setting rendered by the adapter. */
export interface WebExtensionSetting extends WebExtensionLabel {
    /** Provider-local stable key. */
    readonly id: string;
    /** Initial value when the Provider is enabled. */
    readonly defaultValue: boolean;
}

/** Provider-owned menu presentation. */
export interface WebExtensionItem extends WebExtensionLabel {
    /** Stable identity within one menu. */
    readonly id: string;
    /** Provider-local action sent back to Kawaikara. */
    readonly action: string;
    /** Optional boolean setting controlling visibility. */
    readonly when?: string;
}

/** Browser-native menu declaration in display order. */
export interface WebExtensionContextItem extends WebExtensionItem {
    /** Link entries are separate because they use the target URL. */
    readonly contexts: readonly ('page' | 'video' | 'link' | 'selection' | 'image' | 'audio')[];
}

/** Declarative DOM descriptor interpreted by the generic browser adapter. */
export interface WebExtensionMenu {
    /** Stable recipe identity within the Provider. */
    readonly id: string;
    /** Trusted page event that requests insertion. */
    readonly event: 'contextmenu' | 'click';
    /** Whether the trigger region must contain a video. */
    readonly requireVideo?: boolean;
    /** Ordered, explicitly declared menu entries. */
    readonly items: readonly WebExtensionItem[];
    /** Insertion at the beginning or end of the target. */
    readonly placement?: 'prepend' | 'append';
    /** Closest matching region around the event target. */
    readonly trigger: string;
    /** Container receiving newly constructed nodes. */
    readonly target: string;
    /** Optional current-menu ancestor, at most two levels up. The adapter validates size, contents and ownership before temporarily hiding it. */
    readonly close?: string;
    /** Browser-packaged rendering primitives, never remotely executable HTML. */
    readonly layout: 'menu-item' | 'button-list';
    /** Class names attached only to new nodes. */
    readonly itemClass: string;
    /** Optional plain-text icon supplied by the Provider. */
    readonly iconText?: string;
    /** Optional icon styling. */
    readonly iconClass?: string;
    /** Optional label styling. */
    readonly labelClass?: string;
    /** Optional content styling. */
    readonly contentClass?: string;
    /** Optional button styling. */
    readonly buttonClass?: string;
}

/** App-published contract; no catalog or site behavior is bundled in the extension. */
export interface WebExtensionDescriptor {
    /** Protocol version for the connected-only adapter. */
    readonly version: 2;
    /** Provider-local action identities, with no fixed command count. */
    readonly actions: readonly string[];
    /** Action metadata and desktop routing. */
    readonly actionDefinitions: Readonly<Record<string, WebExtensionActionDefinition>>;
    /** Provider-defined settings rendered dynamically by the adapter. */
    readonly settings?: readonly WebExtensionSetting[];
    /** Browser context menu entries. */
    readonly contextMenus?: readonly WebExtensionContextItem[];
    /** Optional toolbar action identity. */
    readonly toolbarAction?: string;
    /** Any number of independently declared DOM insertion recipes. */
    readonly domActions?: readonly WebExtensionMenu[];
}

/** Serialized Provider descriptor available without activating its viewer. */
export interface WebExtensionProvider extends WebExtensionDescriptor {
    /** Globally registered Provider identity. */
    readonly id: string;
    /** Provider title. */
    readonly title: string;
    /** HTTP(S) host scope including subdomains. */
    readonly domains: readonly string[];
    /** Display-only Provider image. */
    readonly icon?: string;
}

/** Desktop-only request delivered to a third-party Provider handler. */
export interface WebExtensionInvocation {
    /** Validated Provider-local action identity. */
    readonly action: string;
    /** Browser-derived URL validated against the Provider domains. */
    readonly url: string;
    /** Values selected in this Provider's browser settings. */
    readonly settings: Readonly<Record<string, boolean>>;
}

/** Supported browser effects returned by a desktop action. */
export interface WebExtensionResult {
    /** Optional text to copy, requiring declared clipboard authority. */
    readonly clipboard?: string;
}

/** Resolves labels through exact locale, base language, then fallback text. */
export function webExtensionItemTitle(item: WebExtensionLabel, locale: string): string {
    const language = locale.toLowerCase();
    const translations = Object.entries(item.translations || {});
    return translations.find(([key]) => key.toLowerCase() === language)?.[1]
        || translations.find(([key]) => key.toLowerCase() === language.split('-')[0])?.[1]
        || translations.find(([key]) => key.toLowerCase().split('-')[0] === language.split('-')[0])?.[1]
        || item.title;
}

/** Accepts only records, excluding null and arrays. */
function record(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Restricts externally supplied field names. */
function fields(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
    if (!record(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error('Unsupported browser fields.');
}

/** Stable identifiers are data, never executable source. */
function identity(value: unknown): value is string {
    return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

/** Validates a plain-text UI label. */
function label(value: unknown): boolean {
    return typeof value === 'string' && Boolean(value.trim()) && value.length <= 200;
}

/** Checks optional localized labels without allowing executable or unknown values. */
function validateTranslations(value: unknown): void {
    if (value !== undefined && (!record(value)
        || Object.entries(value).some(([key, text]) => !/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(key) || !label(text))))
        throw new Error('Invalid browser translations.');
}

/** Rejects executable content and undeclared action or setting references. */
function validateItems(value: unknown, descriptor: WebExtensionDescriptor, context: boolean): void {
    if (!Array.isArray(value)) throw new Error('Invalid browser items.');
    const ids = new Set<string>();
    for (const item of value) {
        fields(item, ['id', 'action', 'title', 'translations', 'when', ...(context ? ['contexts'] : [])]);
        if (!identity(item.id) || ids.has(item.id) || typeof item.action !== 'string'
            || !descriptor.actions.includes(item.action) || !label(item.title)
            || (item.when !== undefined && !descriptor.settings?.some(setting => setting.id === item.when)))
            throw new Error('Invalid browser item.');
        ids.add(item.id);
        validateTranslations(item.translations);
        if (context && (!Array.isArray(item.contexts) || !item.contexts.length
            || new Set(item.contexts).size !== item.contexts.length
            || item.contexts.some(entry => !['page', 'video', 'link', 'selection', 'image', 'audio'].includes(entry))
            || (item.contexts.includes('link') && item.contexts.length !== 1)))
            throw new Error('Invalid browser contexts.');
    }
}

/** Shared validation at both ends of the connected adapter contract. */
export function validateWebExtensionDescriptor(value: unknown): asserts value is WebExtensionDescriptor {
    fields(value, ['version', 'actions', 'actionDefinitions', 'settings', 'contextMenus', 'toolbarAction', 'domActions']);
    if (value.version !== 2 || !Array.isArray(value.actions) || !value.actions.length
        || value.actions.some(action => !identity(action)) || new Set(value.actions).size !== value.actions.length
        || !record(value.actionDefinitions) || Object.keys(value.actionDefinitions).length !== value.actions.length)
        throw new Error('Unsupported browser descriptor.');
    for (const action of value.actions) {
        const definition = value.actionDefinitions[action];
        fields(definition, ['title', 'translations', 'handler', 'clipboard']);
        validateTranslations(definition.translations);
        if (!label(definition.title) || !['open', 'download', 'share-link', 'provider'].includes(definition.handler as string)
            || (definition.clipboard !== undefined && typeof definition.clipboard !== 'boolean')
            || (definition.handler === 'share-link' && definition.clipboard !== true))
            throw new Error('Invalid desktop action definition.');
    }
    if (value.settings !== undefined) {
        if (!Array.isArray(value.settings)) throw new Error('Invalid browser settings.');
        const ids = new Set<string>();
        for (const setting of value.settings) {
            fields(setting, ['id', 'title', 'translations', 'defaultValue']);
            validateTranslations(setting.translations);
            if (!identity(setting.id) || ids.has(setting.id) || !label(setting.title) || typeof setting.defaultValue !== 'boolean')
                throw new Error('Invalid browser setting.');
            ids.add(setting.id);
        }
    }
    const descriptor = value as unknown as WebExtensionDescriptor;
    if (value.contextMenus !== undefined) validateItems(value.contextMenus, descriptor, true);
    if (value.toolbarAction !== undefined && !value.actions.includes(value.toolbarAction)) throw new Error('Invalid toolbar action.');
    if (value.domActions !== undefined) {
        if (!Array.isArray(value.domActions)) throw new Error('Invalid DOM actions.');
        const ids = new Set<string>();
        for (const menu of value.domActions) {
            fields(menu, ['id', 'event', 'requireVideo', 'items', 'placement', 'trigger', 'target', 'close', 'layout', 'itemClass', 'iconText', 'iconClass', 'labelClass', 'contentClass', 'buttonClass']);
            if (!identity(menu.id) || ids.has(menu.id) || !['contextmenu', 'click'].includes(menu.event as string)
                || !['menu-item', 'button-list'].includes(menu.layout as string)
                || (menu.placement !== undefined && !['prepend', 'append'].includes(menu.placement as string))
                || (menu.requireVideo !== undefined && typeof menu.requireVideo !== 'boolean'))
                throw new Error('Invalid DOM recipe.');
            if (menu.iconText !== undefined && (typeof menu.iconText !== 'string' || menu.iconText.length > 32)) throw new Error('Invalid DOM icon text.');
            ids.add(menu.id);
            validateItems(menu.items, descriptor, false);
            for (const key of ['trigger', 'target', ...(menu.close === undefined ? [] : ['close'])]) {
                if (typeof menu[key] !== 'string' || !menu[key].trim() || menu[key].length > 512) throw new Error('Invalid DOM selector.');
            }
            for (const key of ['itemClass', 'iconClass', 'labelClass', 'contentClass', 'buttonClass']) {
                if ((key === 'itemClass' || menu[key] !== undefined)
                    && (typeof menu[key] !== 'string' || menu[key].length > 200 || !/^[a-zA-Z0-9_ -]*$/.test(menu[key])))
                    throw new Error('Invalid DOM class.');
            }
        }
    }
}

/** Validates a catalog without imposing a Provider count limit. */
export function validateWebExtensionProviders(value: unknown): asserts value is WebExtensionProvider[] {
    if (!Array.isArray(value)) throw new Error('Invalid browser catalog.');
    const ids = new Set<string>();
    for (const entry of value) {
        if (!record(entry)) throw new Error('Invalid browser Provider.');
        const { id, title, domains, icon, ...descriptor } = entry;
        if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(id) || ids.has(id)
            || !label(title) || !Array.isArray(domains) || !domains.length || domains.length > 40
            || domains.some(host => typeof host !== 'string' || host.length > 253
                || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)))
            throw new Error('Invalid browser Provider.');
        if (icon !== undefined && (typeof icon !== 'string' || icon.length > 262144
            || !/^(?:https:\/\/[^\s]+|data:image\/(?:png|jpeg|webp|gif|svg\+xml|x-icon|vnd.microsoft.icon)[;,])/i.test(icon)))
            throw new Error('Invalid Provider icon.');
        ids.add(id);
        validateWebExtensionDescriptor(descriptor);
    }
}

/** Validates browser-selected values and applies Provider defaults. */
export function webExtensionSettings(provider: WebExtensionDescriptor, value: unknown): Record<string, boolean> {
    if (!record(value) || Object.keys(value).some(key => !provider.settings?.some(setting => setting.id === key))
        || Object.values(value).some(entry => typeof entry !== 'boolean')) throw new Error('Invalid Provider settings.');
    return Object.fromEntries((provider.settings || []).map(setting => [setting.id, value[setting.id] ?? setting.defaultValue])) as Record<string, boolean>;
}

/** Matches the most specific declared domain; ties use stable Provider identity. */
export function resolveWebExtensionProvider(
    providers: readonly WebExtensionProvider[],
    value: string,
): WebExtensionProvider | undefined {
    try {
        if (value.length > 8192) return undefined;
        const url = new URL(value);
        if (
            !['https:', 'http:'].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.port
        )
            return undefined;
        return providers
            .map((provider) => ({
                provider,
                score: Math.max(
                    0,
                    ...provider.domains.map((domain) =>
                        url.hostname === domain ||
                        url.hostname.endsWith(`.${domain}`)
                            ? domain.length
                            : 0,
                    ),
                ),
            }))
            .filter(({ score }) => score > 0)
            .sort(
                (a, b) =>
                    b.score - a.score ||
                    a.provider.id.localeCompare(b.provider.id),
            )[0]?.provider;
    } catch {
        return undefined;
    }
}

/** Presentation edits preserve consent; changed host, action or DOM authority does not. */
export function webExtensionPermissionKey(provider: WebExtensionProvider): string {
    return JSON.stringify([
        provider.version, provider.id, [...provider.domains].sort(),
        [...provider.actions].sort().map(id => [id, provider.actionDefinitions[id].handler, Boolean(provider.actionDefinitions[id].clipboard)]),
        Boolean(provider.domActions?.length),
        (provider.settings || []).map(setting => setting.id).sort(),
    ]);
}

/** Browser responses have no general command or code execution channel. */
export function validateWebExtensionBrowserResult(value: unknown, clipboardAllowed: boolean): asserts value is { ok: true; clipboard?: string } {
    fields(value, ['ok', 'clipboard']);
    if (value.ok !== true || (value.clipboard !== undefined && (!clipboardAllowed || typeof value.clipboard !== 'string' || value.clipboard.length > 16384)))
        throw new Error('Invalid browser action result.');
}
