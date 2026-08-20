# Bundle System Overview

## Terminology

- **Bundle**: the only installable unit. It contains at least one Provider.
- **Provider**: a Menu destination that loads a service or an app-owned view.
- **Plugin**: optional behavior attached globally, to selected Providers, or to
  the Provider directory that owns it.

```text
Bundle
├── Provider[]                 one or more
│   └── Provider Plugin[]      zero or more; owner-scoped
└── Bundle Plugin[]            zero or more; global or providerIds-scoped
```

## Implementation status

| Capability | Status |
| --- | --- |
| `@provider` and `@plugin` metadata | Implemented |
| `defineBundle`, `defineProvider`, and `definePlugin` | Implemented |
| One directory and manifest per Provider and Plugin | Implemented |
| Provider-scoped and Bundle-level Plugin activation | Implemented |
| Atomic registration and API/version validation | Implemented |
| `.kawai` installation without rebuilding Kawaikara | Implemented |
| Per-Provider Session isolation and shared profiles | Implemented |
| Locale and shortcut contributions | Implemented |
| Permission display and manifest consistency checks | Implemented |
| Runtime capability sandbox | Planned |
| Publisher signatures, updates, uninstall, and rollback | Planned |
| Plugin-provided Renderer code | Planned |

The application installs its built-in Bundle through the same runtime contract:

```ts
const host = new PluginHost(siteManager);
host.install(builtinBundle);
```

## Registration model

Decorators store immutable class metadata under shared symbols. A class becomes
discoverable only when its directory manifest is loaded and a `BundleDefinition`
explicitly includes it. Registration never depends on import order or a global
reflection scan.

`SiteManager.registerBundle()` stages Providers, Plugins, and browser profiles.
It commits them only after every ID, manifest, permission, and profile reference
passes validation.

## Plugin activation

Plugins are instantiated for the active Provider, never once for the whole app:

1. Bundle-level Plugins with no `providerIds` activate for every Provider.
2. Bundle-level Plugins with `providerIds` activate only for matching IDs.
3. Plugins listed by a Provider manifest activate only for their owner.
4. Matching Plugins activate before `Provider.load()` so they can subscribe to
   events before the initial navigation.
5. On transition, Plugins deactivate in reverse order, then the Provider unloads.

## Browser profiles

Each Provider uses its own persistent Electron Session by default. A Bundle may
declare shared browser profiles, and a Provider may choose one as its default.
Users can override assignments in Preferences or create their own profiles.

Multiple Providers assigned to the same profile share cookies and storage but
retain separate live `WebContents`. DRM Providers warn when the user assigns
shared state.

## Locale and shortcuts

The app locale is resolved against Bundle and Provider locale declarations. The
result is exposed through `context.locale.app`, `.plugin`, and `.site`, and the
Provider locale supplies `Accept-Language` after Provider header hooks run.

Providers declare default accelerators in `shortcut.defaultKey`. Preferences
stores only overrides; an empty override disables the shortcut.

## Permission declarations

| Permission | Declared use |
| --- | --- |
| `navigation` | Load a remote URL |
| `internal-view` | Load an app-owned internal view |
| `script-injection` | Execute code in a remote document |
| `cookies` | Transfer authentication cookies |
| `network-interception` | Transform requests or headers |
| `external-browser` | Start a separate login browser |

The top-level Bundle manifest must include all permissions declared by every
`@provider` in that Bundle. Provider manifests do not repeat permissions.
Permissions are displayed during inspection but do not yet sandbox arbitrary
module initialization.

## Authoring principles

- Depend on `@kawaikara/site-api`, not app Main or Electron internals.
- Keep selectors, OAuth domains, user-agent workarounds, and PiP route guards in
  the Provider that owns them.
- Treat Provider and Plugin instances as single-use.
- Dispose listeners, timers, and injected state during unload/deactivation.
- Make injection idempotent and keep secrets out of logs.
