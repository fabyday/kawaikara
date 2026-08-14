# Plugin System Overview

## Terminology

A **SiteDescriptor** loads one remote site or one app-owned internal view and defines its site-specific behavior.

A **Site plugin** is a versioned unit containing one or more descriptors plus plugin-level metadata and optional browser profiles.

```text
Site plugin
├── metadata and API version
├── optional browserProfiles[]
└── sites[]
    ├── SiteDescriptor A
    └── SiteDescriptor B
```

## Implementation status

| Capability | Status |
| --- | --- |
| `@site` metadata decorator | Implemented |
| Explicit plugin definitions through `definePlugin()` | Implemented |
| Plugin and site ID validation | Implemented |
| Site API version validation | Implemented |
| Multiple descriptors in one plugin | Implemented |
| Descriptor default shortcuts and user overrides | Implemented |
| Plugin browser-profile declarations | Implemented |
| Site-specific Session isolation and user profile assignment | Implemented |
| Global app locale resolved against plugin/site supported locales | Implemented |
| Plugins compiled into the application build | Implemented |
| External directory discovery and manifest loading | Planned |
| Third-party installation without rebuilding Kawaikara | Planned |
| Permission consent and runtime enforcement | Planned |
| Plugin sandbox or separate process | Planned |
| Plugin-provided Renderer UI bundles | Planned |

The current application explicitly imports and installs its bundled plugin:

```ts
const plugins = new PluginHost(sites);
plugins.install(builtinSitesPlugin);
```

`PluginHost` is therefore an implemented runtime registry, but not yet a filesystem loader or package manager.

## Registration model

The decorator attaches immutable metadata to a class. The plugin export explicitly lists the classes it owns.

```ts
import {
  AbstractSiteDescriptor,
  definePlugin,
  site,
  type SiteContext,
} from '@kawaikara/site-api';

@site({
  id: 'example.video-service',
  title: 'Example Video',
  menu: { category: 'OTT', order: 10 },
  shortcut: { defaultKey: 'Control+Alt+E' },
  isolation: { defaultBrowserProfile: 'account', drm: true },
  permissions: ['navigation'],
})
export class ExampleSite extends AbstractSiteDescriptor {
  constructor(context: SiteContext) {
    super(context);
  }

  async load(): Promise<void> {
    await this.context.viewer.loadURL('https://example.com/');
  }
}

export const examplePlugin = definePlugin({
  id: 'example.video-services',
  name: 'Example Video Services',
  version: '1.0.0',
  apiVersion: 1,
  locale: {
    supportedLocales: ['en-US', 'ko-KR'],
    defaultLocale: 'en-US',
  },
  browserProfiles: [
    {
      id: 'account',
      name: 'Example account',
      description: 'Shares sign-in among this plugin\'s assigned sites.',
      persistent: true,
    },
  ],
  sites: [ExampleSite],
});
```

The decorator does not write to a process-wide reflection registry. Metadata is attached to the constructor under a shared symbol, and `SiteManager` reads it only while installing the explicit plugin definition.

## Installation validation

Installation checks that:

1. `plugin.apiVersion` equals the app's `KAWAIKARA_SITE_API_VERSION`.
2. The plugin ID has not already been installed.
3. Every exported site constructor carries `@site` metadata.
4. Site IDs do not conflict with an installed site or another site in the same plugin.
5. Plugin profile IDs are valid and unique.
6. A descriptor's `defaultBrowserProfile` refers to a profile declared by the same plugin.

Site registrations are staged before being committed. A validation failure does not leave half of a plugin registered.

## Browser profiles

Each site uses its own persistent Electron Session unless it is assigned to a shared profile.

A plugin-local profile is converted to the runtime ID:

```text
plugin:<plugin-id>:<profile-id>
```

User-created profiles use:

```text
user:<profile-id>
```

The preference UI lets the user choose site-specific isolation, any plugin-provided profile, or a user-created profile. Current UI-created user profiles are persistent. A plugin may contribute a non-persistent profile that exists only for the current run.

Multiple sites assigned to the same profile share cookies and storage, but they do not share one live `WebContents`. DRM-marked sites produce a warning when assigned to shared state.

## Locale model

The app has one authoritative locale preference: `system`, `ko-KR`, `en-US`, or `ja-JP`. Legacy per-plugin and per-site override records remain in the preference type only for file compatibility and are cleared when settings are saved.

At load time, `SiteManager` resolves that app locale against each plugin and descriptor's supported locales:

1. Exact locale match.
2. Language-only match.
3. Declared default locale, unless it is `inherit`.
4. The app locale as the final fallback.

The result is exposed as `context.locale.app`, `.plugin`, and `.site`. A concrete site locale also supplies the session request's `Accept-Language` value after the descriptor header hook runs.

## Shortcut model

A site declares its default Electron accelerator in `shortcut.defaultKey`. The preference UI lists all site shortcuts and stores only user overrides. The runtime loads the selected descriptor when the shortcut is matched.

App-owned shortcut defaults remain in `src/Common/AppShortcuts.ts`; site-owned defaults stay beside their descriptor metadata. Empty overrides disable a shortcut. Conflict detection and overwrite confirmation are handled in Preferences.

## ID rules

Plugin and site IDs should use a stable publisher namespace:

```text
plugin: acme.korean-ott
site:   acme.example-play
```

The built-in plugin uses `kawaikara.*`. Third parties should not use that namespace. IDs are stored in preferences and profile assignments, so changing a published ID requires migration logic.

Plugin profile IDs are local to the plugin and may contain letters, numbers, `.`, `_`, and `-`, with a maximum length enforced at registration.

## API version

The current `KAWAIKARA_SITE_API_VERSION` is `1`.

Increase it for a removed or renamed method, a changed lifecycle guarantee, a newly required metadata field, or another semantic break. A backward-compatible optional capability may remain in the same API version only when older plugins can safely detect or ignore it.

## Permission declarations

| Permission | Declared use |
| --- | --- |
| `navigation` | Load a remote URL in the viewer |
| `internal-view` | Load an app-owned internal view |
| `script-injection` | Execute JavaScript in a remote document |
| `cookies` | Transfer authentication cookies |
| `network-interception` | Transform request headers |
| `external-browser` | Start a separate login browser |

Permissions are currently documentation metadata and are not enforced. Plugin authors should still declare every capability they use so the future consent model has accurate data.

## Authoring principles

- Depend on `@kawaikara/site-api`, not `src/Main` or Electron internals.
- Keep site selectors, OAuth domains, and compatibility user agents in the descriptor that owns them.
- Treat every descriptor instance as single-use, even though hooks may fire more than once.
- Dispose every resource started during `load()`.
- Expect remote DOM, redirects, and player structure to change.
- Make injection idempotent and keep sensitive values out of logs.
