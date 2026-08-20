# Bundle, Provider, and Plugin

Kawaikara has one installable extension unit: the **Bundle**. A Bundle contains
one or more **Providers** and may also contain **Plugins**. Bundle kinds are not
split by contribution type.

```text
Bundle (manifest.json)
├── Providers/                       # one or more
│   └── Example/
│       ├── manifest.json
│       ├── Provider.js               # compiled from Provider.ts
│       └── Plugins/                 # zero or more, Provider-scoped
│           └── Helper/
│               ├── manifest.json
│               └── Plugin.js         # compiled from Plugin.ts
└── Plugins/                         # zero or more, Bundle-level
    └── GlobalHelper/
        ├── manifest.json
        └── Plugin.js                 # compiled from Plugin.ts
```

## Ownership

- A Bundle owns distribution metadata, locale support, and shared browser
  profiles.
- Every Provider owns a directory and `manifest.json`. It loads one remote
  service or one app-owned view and becomes a Menu destination.
- A Plugin inside a Provider directory is always scoped to that Provider.
- A Plugin under the Bundle root is global when `providerIds` is omitted. It can
  target specific Providers by declaring `providerIds` in its manifest.
- A Bundle with zero Providers is invalid, even if it contains Plugins.

This physical ownership is also the runtime ownership model. Plugins activate
before their matching Provider loads and deactivate in reverse order before the
Provider is unloaded.

## Runtime definitions

The TypeScript API mirrors the directory model:

```ts
import {
  defineBundle,
  definePlugin,
  defineProvider,
} from '@kawaikara/site-api';

const helper = definePlugin({
  manifest: helperManifest,
  plugin: ExampleHelperPlugin,
});

const example = defineProvider({
  manifest: providerManifest,
  provider: ExampleProvider,
  plugins: [helper],
});

export const bundle = defineBundle({
  id: 'example.streaming',
  name: 'Example Streaming',
  version: '1.0.0',
  apiVersion: 1,
  providers: [example],
  plugins: [],
});
```

Decorators attach behavior metadata to constructors; they do not register
classes globally. `PluginHost` receives one explicit `BundleDefinition`, and
`SiteManager` stages and validates all contributions before committing them.

## Provider

```ts
import { AbstractProvider, provider } from '@kawaikara/site-api';

@provider({
  menu: { category: 'OTT', order: 10 },
  permissions: ['navigation'],
  pictureInPicture: { enabled: true },
})
export default class ExampleProvider extends AbstractProvider {
  async load(): Promise<void> {
    await this.context.viewer.loadURL('https://example.com/');
  }

  allowPictureInPicture(url: string): boolean {
    return new URL(url).pathname.startsWith('/watch/');
  }
}
```

The Provider manifest owns `id`, `name`, `description`, and `version`. The
decorator owns runtime capabilities. The top-level Bundle permission list must
cover every permission declared by every Provider in the Bundle.

## Plugin scope

```ts
import { AbstractPlugin, plugin } from '@kawaikara/site-api';

@plugin({ id: 'example.helper' })
export default class ExampleHelperPlugin extends AbstractPlugin {
  activate(): void {
    this.subscriptions.add(
      this.context.provider.viewer.onDomReady(() => {
        void this.context.provider.viewer.executeJavaScript(
          "document.documentElement.dataset.example = 'true'",
        );
      }),
    );
  }
}
```

For a Bundle-level Plugin, `providerIds` in `manifest.json` selects its target
Providers. Omitting it activates one Plugin instance for every Provider. A
Provider-owned Plugin needs no scope declaration because its directory already
defines the owner.

## Validation

The loader validates these rules before registration:

1. Bundle, Provider, and Plugin manifests use schema version 1 and the supported
   Site API version.
2. Bundle IDs, Provider IDs, Plugin IDs, and browser-profile IDs are unique.
3. The Bundle declares at least one Provider directory.
4. Every compiled JavaScript entry stays inside its owner.
5. Manifest identity is canonical; an optional legacy decorator ID must match.
6. Top-level Bundle permissions cover every Provider decorator requirement.
7. A Provider default browser profile exists in its Bundle.
8. Provider-owned Plugin scope cannot exclude its owner.

Registration is atomic. A failed Bundle does not leave a partial Provider or
Plugin registration behind.

## Version and permission boundaries

The Bundle version is the release and update version. Provider and Plugin
versions remain in their child manifests for compatibility diagnostics, data
migrations, and support logs, but Kawaikara does not update a child separately
from its Bundle.

Permissions belong only to the top-level Bundle manifest because the user
installs and trusts one archive. Child permission arrays are accepted only as a
legacy compatibility field and must be a subset of the Bundle permissions.

## Code ownership and attachment

Site-specific injection belongs beside its Provider, normally under
`Providers/<name>/Inject/`. Kawaikara core owns only reusable primitives such as
script serialization, lifecycle hooks, safe action URLs, and generic PiP
layout. This keeps remote-DOM hacks updateable with the Bundle that understands
that site.

Provider-owned Plugins attach to exactly that Provider. A Bundle-level Plugin
can attach to several Providers with `providerIds`, or all Providers when the
field is omitted. Version 1 intentionally does not allow third-party Plugins to
attach directly to the App: App attachment would expose a different privileged
context and therefore needs a separate permission model and API version.

`kawaikara.video` is a Provider that selects the app-owned `video-library`
internal panel. The renderer and playback backend remain App code; the Provider
does not ship an arbitrary renderer. A future PluginView API should be a
separate sandboxed contribution rather than overloading Provider Plugins.

## External installation

Preferences > Bundles accepts `.kawai` archives (ZIP containers) with `manifest.json` at the archive
root or inside one enclosing directory. Kawaikara validates compressed size,
expanded size, entry count, path traversal, symbolic links, every nested
manifest, compiled entry paths, IDs, SemVer, and API versions. A valid Bundle is
moved to `KawaiData/Bundles/<bundle-id>` and becomes active after restart.

Before moving the Bundle, Kawaikara shows every requested Provider permission
and requires an explicit `Allow and install` choice. Denying the request cancels
installation and deletes the temporary extracted directory.

The current loader is a trusted-code model. Provider and Plugin TypeScript is
compiled to JavaScript before packaging; those modules execute in Main and can
access Node.js during module initialization. Archive
validation prevents unsafe extraction but is not a sandbox or publisher
signature. Install only Bundles from trusted sources.

See [Packaging](../Plugins/Packaging.md) for the complete archive format.
