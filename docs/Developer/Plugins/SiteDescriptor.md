# SiteDescriptor Development Guide

## Minimal descriptor

External integrations should depend only on `@kawaikara/site-api`.

```ts
import {
  AbstractSiteDescriptor,
  site,
  type SiteContext,
} from '@kawaikara/site-api';

@site({
  id: 'example.my-site',
  title: 'My Site',
  description: 'Example streaming site',
  menu: {
    category: 'OTT',
    order: 10,
    icon: 'https://example.com/favicon.ico',
  },
  shortcut: { defaultKey: 'Control+Alt+E' },
  locale: {
    supportedLocales: ['en-US', 'ko-KR'],
    defaultLocale: 'en-US',
  },
  isolation: { drm: true },
  permissions: ['navigation'],
})
export class MySite extends AbstractSiteDescriptor {
  constructor(context: SiteContext) {
    super(context);
  }

  async load(): Promise<void> {
    await this.context.viewer.loadURL('https://example.com/');
  }
}
```

`UrlSiteDescriptor` is a private helper in `builtin-sites`, not part of the public Site API. Third-party descriptors should extend `AbstractSiteDescriptor` directly.

## Metadata reference

```ts
interface SiteMetadata {
  id: string;
  title: string;
  description?: string;
  menu: {
    category: string;
    order?: number;
    icon?: string;
  };
  shortcut?: { defaultKey?: string };
  locale?: {
    supportedLocales?: readonly string[];
    defaultLocale?: string;
  };
  isolation?: {
    defaultBrowserProfile?: string;
    drm?: boolean;
  };
  permissions?: readonly SitePermission[];
}
```

- `id` is a stable global identifier used by preferences and IPC.
- `menu.category` groups the site; lower `order` values appear first until the user supplies a custom order.
- `menu.icon` accepts a URL or data URL. Built-ins with unreliable favicons use bundled data assets.
- `shortcut.defaultKey` is active unless the user overrides or disables it.
- `locale` reports supported values and a fallback used by the global locale resolver.
- `defaultBrowserProfile` must name a profile in the containing plugin.
- `drm` marks a site for shared-profile warnings.
- `permissions` describes capabilities used, but does not currently enforce access.

## Loading and cleanup

Register disposable listeners in the inherited `subscriptions` store.

```ts
async load(): Promise<void> {
  this.subscriptions.add(
    this.context.viewer.onDidFinishLoad(() => this.installPageHook()),
  );

  await this.context.viewer.loadURL('https://example.com/');
  await this.installPageHook();
}

private async installPageHook(): Promise<void> {
  await this.context.viewer.executeJavaScript(`
    if (!window.__examplePluginInstalled) {
      window.__examplePluginInstalled = true;
      // Install the smallest possible hook.
    }
  `);
}
```

`super.unload()` disposes the store. An override must restore any state that is outside the store and then call the base method.

```ts
async unload(): Promise<void> {
  await this.context.externalBrowser.close();
  this.context.viewer.setUserAgent();
  await super.unload();
}
```

`onDomReady()` and `onDidFinishLoad()` may both run around redirects or SPA document replacement. Make the hook safe to call repeatedly.

## SiteContext

### Viewer

```ts
interface SiteViewer {
  loadURL(url: string): Promise<void>;
  loadInternalView(viewId: string): Promise<void>;
  getUserAgent(): string;
  setUserAgent(userAgent?: string): void;
  executeJavaScript<T>(code: string): Promise<T>;
  onDomReady(listener: () => void | Promise<void>): Disposable;
  onDidFinishLoad(listener: () => void | Promise<void>): Disposable;
}
```

`loadInternalView()` currently accepts only `video`. It connects a descriptor to the app's built-in Video renderer; it does not register plugin-owned UI.

### Locale

`context.locale` is optional for Site API v1 compatibility. When supplied, it contains the resolved app, plugin, and site locales. Treat `system` as an instruction to follow the operating system rather than as a BCP 47 language tag.

### Logger and external links

Use `context.logger` for descriptor diagnostics and never log credentials, cookies, tokens, or sensitive callback queries. Use `openExternal()` only for a user-intended operating-system browser action; normal `target=_blank` behavior belongs in `onNewWindow()`.

## Navigation and popup policy

`allowNavigation()` can reject a main-frame navigation before commit. `onNewWindow()` controls `window.open()` and target-blank requests.

```ts
allowNavigation(value: string): boolean {
  const url = new URL(value);
  return url.protocol === 'https:' &&
    (url.hostname === 'example.com' || url.hostname.endsWith('.example.com'));
}

onNewWindow(value: string): NewWindowPolicy {
  const url = new URL(value);
  if (url.protocol === 'https:' && url.hostname === 'accounts.example.com') {
    return 'popup';
  }
  if (url.protocol === 'https:' && url.hostname === 'docs.example.com') {
    return 'external';
  }
  return 'viewer';
}
```

Use `popup` only when the provider needs opener or postMessage semantics. Prefer parsed hostnames over regular expressions when the policy is more than a small fixed allowlist.

## Page-to-Main actions

Injected code cannot call IPC. Create an action URL and intercept the relevant page control.

```ts
private async installLoginHook(): Promise<void> {
  const actionUrl = this.context.actions.createUrl('login');

  await this.context.viewer.executeJavaScript(`
    (() => {
      if (window.__exampleLoginHook) return;
      window.__exampleLoginHook = true;
      const actionUrl = ${JSON.stringify(actionUrl)};

      document.addEventListener('click', (event) => {
        const target = event.target;
        const control = target instanceof Element
          ? target.closest('[data-login-button]')
          : null;
        if (!control) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.location.assign(actionUrl);
      }, true);
    })();
  `);
}

async onAction(action: string): Promise<boolean> {
  if (action !== 'login') return false;
  await this.startLogin();
  return true;
}
```

The template literal serializes the runtime value with `JSON.stringify(actionUrl)`. Never interpolate raw user or DOM input into injected source.

## External browser login

Use this capability when a service refuses embedded authentication.

```ts
const result = await this.context.externalBrowser.login({
  startUrl: 'https://example.com/login',
  completionUrlPattern: '/(?:home|profile)(?:[/?#]|$)',
  returnUrl: 'https://example.com/',
  siteTitle: 'Example',
  locale: this.context.locale?.app,
});
```

The manager watches the external browser URL, copies cookies to the active Session after completion, closes the temporary browser, and restores `returnUrl`.

- The completion expression must not match a public pre-login page.
- Guard against repeated clicks creating concurrent login flows.
- Close the browser in `unload()`.
- Test cancellation, MFA, provider popups, and actual account playback manually.

## User-Agent and request headers

Sites can inspect both `navigator.userAgent` and network headers. Change the viewer user agent and the applicable request header together.

```ts
private browserUserAgent?: string;

async load(): Promise<void> {
  this.browserUserAgent = this.context.viewer
    .getUserAgent()
    .replace(/\s(?:Electron|kawaikara)\/[^\s]+/gi, '');
  this.context.viewer.setUserAgent(this.browserUserAgent);
  await this.context.viewer.loadURL('https://example.com/');
}

onBeforeSendHeaders(details: SiteRequestDetails) {
  const url = new URL(details.url);
  if (url.hostname !== 'example.com' || !this.browserUserAgent) return undefined;
  return { ...details.requestHeaders, 'User-Agent': this.browserUserAgent };
}

async unload(): Promise<void> {
  this.context.viewer.setUserAgent();
  await super.unload();
}
```

Header keys are case-insensitive, so replace an existing key case-insensitively rather than blindly adding a duplicate.

## PiP eligibility

The unified PiP manager can find any visible `<video>`, including previews on a home page. A descriptor should override `allowPictureInPicture()` when only specific routes represent intentional playback.

```ts
allowPictureInPicture(value: string): boolean {
  const url = new URL(value);
  return url.hostname === 'example.com' && /^\/watch\/[^/]+$/.test(url.pathname);
}
```

YouTube allows `/watch?v=...`, `/shorts/...`, and `/live/...`; CHZZK allows detail routes under `/live`, `/video`, and `/clips`. This prevents menu previews from being mistaken for the current program.

## Internal Video descriptor

```ts
@site({
  id: 'example.video',
  title: 'Video',
  menu: { category: 'Video' },
  permissions: ['internal-view'],
})
export class VideoSite extends AbstractSiteDescriptor {
  constructor(context: SiteContext) {
    super(context);
  }

  async load(): Promise<void> {
    await this.context.viewer.loadInternalView('video');
  }
}
```

This reuses Kawaikara's Video view. Plugin-provided renderer bundles are not supported.

## Test checklist

- Does the menu show the correct category, order, icon, and shortcut?
- Do initial navigation and all expected redirects finish successfully?
- Is injection idempotent across DOM-ready, did-finish-load, and SPA transitions?
- Do login, cancellation, MFA, and popup close paths work?
- Are user-agent changes, listeners, popups, and external browsers gone after a site change?
- Are target-blank requests handled by the intended policy?
- Does PiP start only on real playback routes and restore the page afterward?
- Does an isolated profile remain unaffected after visiting other services?
- Are secrets absent from logs?
