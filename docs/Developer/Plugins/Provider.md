# Provider Development Guide

A Provider loads one remote service or one app-owned internal view. It owns the
service URL, navigation rules, login workarounds, request hooks, DOM injection,
PiP eligibility, Menu metadata, default shortcut, and Session defaults.

## Minimal Provider

```ts
import { AbstractProvider, provider } from '@kawaikara/site-api';

@provider()
export default class ExampleProvider extends AbstractProvider {
  async load(): Promise<void> {
    await this.context.viewer.loadURL('https://example.com/');
  }
}
```

Place it in its own directory:

```text
Providers/ExampleVideo/
├── manifest.json
├── Provider.ts
└── Provider.js
```

Identity, permissions, and static contributions live in `manifest.json`. A
Provider manifest uses `contributes` for menu placement, shortcuts, addresses,
settings, locale, isolation, and PiP metadata. The decorator marks the runtime
constructor; the class contains executable behavior. The Provider must be
listed by the containing Bundle manifest.

## Context capabilities

`SiteContext` exposes bounded application services:

- `viewer`: load a URL or internal view, subscribe before navigation, execute
  page code, set a user agent, and open an isolated popup.
- `externalBrowser`: complete login in a temporary external browser and import
  cookies into the current Session.
- `actions`: create opaque action URLs for injected controls.
- `locale`: resolved app, Bundle, and Provider locale values.
- `logger`: Provider-scoped diagnostics.

Remote pages never receive the application IPC bridge.

## Lifecycle

Create all event subscriptions before the initial `loadURL()` call. Add cleanup
handles to `this.subscriptions`; the default `unload()` implementation disposes
them. Treat a Provider instance as single-use.

Kawaikara activates matching Plugins before calling `Provider.load()`. When the
user changes Provider, Plugins deactivate in reverse order and then the Provider
unloads.

`onSettingsChanged(settings)` runs once before `load()` and again after the user
saves Provider settings. Values are stored under
`providerSettings[providerId]`, so two Providers may use the same local key
without sharing state. Missing keys must always resolve to Provider defaults.

Providers declare their own Preferences UI through
`manifest.contributes.settings`. The
app renders each category inside Preferences > Bundles > the containing Bundle,
without adding Provider-specific React code. Supported controls currently are
`boolean` and `item-list`; list values contain stable `{ id, label }` pairs and
are intended for data such as blocked publishers.

```json
{
  "contributes": {
    "settings": {
      "categories": [
        {
          "id": "playback",
          "title": { "en-US": "Playback", "ko-KR": "재생" },
          "settings": [
            {
              "type": "boolean",
              "key": "short-form-video.auto-advance",
              "title": "Play the next video automatically",
              "defaultValue": true
            }
          ]
        }
      ]
    }
  }
}
```

## Short-form video capabilities

Use `manifest.contributes.shortFormVideo` for vertical feeds instead of
implementing app keys in each Provider. The standard interface supports previous, next,
auto-advance, and publisher quick-ban capabilities. Kawaikara binds the shared
Shortcut preferences in normal mode and registers them globally only while its
unified PiP is active. The Provider handles navigation through `onAction()` and
resolves the current publisher through `getShortFormVideoPublisher()`.

Provider-only actions that do not fit this interface can be declared under
`manifest.contributes.shortcut.actions`. They appear automatically on the shared Shortcut
page and are dispatched to `onAction()` only while that Provider is active.

## Navigation and popups

Override `allowNavigation(url)` to reject unexpected main-frame destinations.
Override `onNewWindow(url)` to choose `viewer`, `popup`, `external`, or `deny`.
Use an isolated popup for OAuth flows that require `window.opener`,
`postMessage`, or `response_mode=web_message`.

Use `externalBrowser.login()` only for services that reject embedded Electron
login. Keep completion URL patterns narrow and never log cookies or callback
tokens.

## Injection

Use DOM-ready or load hooks registered before navigation. Injection must be
idempotent because streaming SPAs can navigate without replacing the complete
document. Prefer stable semantic selectors and fail quietly when a remote DOM
changes.

Declare `script-injection` in the Provider manifest and grant it in the
top-level Bundle manifest. The Bundle list is the installation-consent boundary;
the Provider list determines which capabilities that Provider receives.

Keep injected entry points in a Provider-local `Inject/` directory, split by
feature rather than accumulating one Provider-sized string. Write the page-world
function as TypeScript, keep it self-contained, and serialize it at the final
viewer boundary. Imports and module variables are not available after a
function is converted to page code.

## Request hooks

`onBeforeRequest()` can cancel or redirect requests. `onBeforeSendHeaders()` can
return replacement headers. The runtime applies the resolved Provider locale to
`Accept-Language` after the Provider header hook.

Declare `network-interception` when using either hook.

## PiP eligibility

Declare `"pictureInPicture": { "enabled": true }` under the Provider
manifest's `contributes`, then keep route-dependent behavior in code:

```ts
@provider()
export default class ExampleProvider extends AbstractProvider {
  allowPictureInPicture(url: string): boolean {
    return new URL(url).pathname.startsWith('/watch/');
  }
}
```

The manifest contribution controls whether the app exposes the unified PiP action. The route
guard prevents home-page previews and unrelated `<video>` elements from being
selected. DOM selection logic should prefer visible, playing, sufficiently
large video elements and support site-specific player structures.

## Internal views

`viewer.loadInternalView('video')` opens the app-owned Video renderer. Internal
views are not arbitrary Bundle Renderer code. Declare `internal-view` and omit
`navigation` when a Provider does not load remote content.

## PluginView panels

Use `menu.panels` for Provider-owned panels. Plugins can contribute the same
shape through `@plugin({ panels })`. Declare `plugin-view` at the Provider and
Bundle permission boundary. One panel occupies the whole PluginView surface;
multiple panels automatically receive a browser-style selector.

```json
{
  "permissions": ["navigation", "plugin-view"],
  "contributes": {
    "menu": {
      "category": "Examples",
      "panels": [
        {
          "id": "help",
          "title": { "en-US": "Help", "ko-KR": "도움말" },
          "content": { "kind": "html", "html": "<main>...</main>" }
        }
      ]
    }
  }
}
```

Panel ids must be unique only inside the contributing Provider or Plugin.
Titles are display copy and may be duplicated. HTML runs in a sandboxed frame
without application IPC; `internal` ids select only Renderer views shipped by
Kawaikara.

## Browser profiles

A Provider is isolated in its own persistent Session by default. It may declare
`isolation.defaultBrowserProfile` to use a browser profile defined by its
Bundle. Users can override the assignment in Preferences. Mark DRM Providers
with `isolation.drm` so shared-state choices can be warned about.

## Checklist

- Provider source is TypeScript and its manifest points to one compiled JavaScript entry.
- Identity and descriptive text exist only in the Provider manifest.
- Provider manifest permissions declare runtime capabilities and remain a
  subset of the Bundle permission grant.
- Event hooks are registered before initial navigation.
- Injection is idempotent and cleanup is complete.
- Login, URL, popup, and PiP guards are narrow.
- Credentials, cookies, and tokens never enter logs.
