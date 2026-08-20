# Bundle Packaging and Distribution

## Required directory model

Every installable archive is one Bundle. It must have a root `manifest.json`
and at least one Provider directory. Every Provider and Plugin owns its own
directory and manifest.

```text
example-bundle/
├── manifest.json
├── Providers/
│   └── ExampleVideo/
│       ├── manifest.json
│       ├── Provider.js
│       ├── assets/
│       └── Plugins/
│           └── PlayerHelper/
│               ├── manifest.json
│               └── Plugin.js
└── Plugins/
    └── GlobalHelper/
        ├── manifest.json
        └── Plugin.js
```

The `.kawai` file is a ZIP container and may contain this layout at its root or inside exactly one enclosing
directory.

## Bundle manifest

```json
{
  "schemaVersion": 1,
  "id": "example.streaming",
  "name": "Example Streaming",
  "description": "Example Providers for Kawaikara",
  "version": "1.0.0",
  "apiVersion": 1,
  "permissions": ["navigation", "script-injection"],
  "providers": ["Providers/ExampleVideo"],
  "plugins": ["Plugins/GlobalHelper"],
  "locale": {
    "supportedLocales": ["en-US", "ko-KR"],
    "defaultLocale": "en-US"
  },
  "browserProfiles": [
    {
      "id": "account",
      "name": "Example account",
      "persistent": true
    }
  ]
}
```

`providers` is required and cannot be empty. `plugins` is optional. All paths
are relative directories beneath the Bundle root.

## Provider manifest

```json
{
  "schemaVersion": 1,
  "id": "example.video",
  "name": "Example Video",
  "version": "1.0.0",
  "apiVersion": 1,
  "main": "Provider.js",
  "plugins": ["Plugins/PlayerHelper"]
}
```

Write Provider source in TypeScript. `main` points to the compiled `.js` file
and exports one Provider constructor as the module value, `default`, `provider`,
or the only function export. The Provider manifest owns its ID, name, and
description; the decorator owns behavior contributions. Bundle-level
`permissions` is the single user-consent boundary.

Provider-owned Plugin directories are relative to the Provider directory. Their
runtime scope is always that Provider.

## Plugin manifest

```json
{
  "schemaVersion": 1,
  "id": "example.global-helper",
  "name": "Example Global Helper",
  "version": "1.0.0",
  "apiVersion": 1,
  "main": "Plugin.js",
  "providerIds": ["example.video"]
}
```

Plugin source is TypeScript and `main` points to its compiled JavaScript entry.
For a Bundle-level Plugin, omit `providerIds` to target every Provider or
list Provider IDs to restrict activation. A Provider-owned Plugin does not need
`providerIds`; its containing Provider is the scope.

## Building a Bundle

Provider and Plugin entries should bundle their runtime dependencies. The `.kawai` container
installer does not run a package manager. Import the public Site API only for
Kawaikara capabilities; do not import app Main modules or Electron internals.

The official `packages/builtin-sites` package follows exactly this layout under
`src/Providers` and `src/Plugins`. Its TypeScript composition root uses
`defineProvider`, `definePlugin`, and `defineBundle` to represent the same
filesystem ownership at build time.

## Loader pipeline

1. Extract into a random staging directory.
2. Reject traversal paths, symbolic links, oversized archives, excessive entry
   counts, and files outside the staging root.
3. Validate the Bundle manifest and every declared Provider/Plugin manifest.
4. Verify IDs, SemVer, API versions, relative directories, entry files,
   permissions, and duplicate contributions.
5. Show a trusted-code warning and require explicit user confirmation.
6. Atomically move the directory to `KawaiData/Bundles/<bundle-id>`.
7. Load compiled JavaScript entries and register the Bundle on the next app start.

One malformed installed Bundle is marked failed in Preferences without stopping
other Bundles or application startup.

## Limits and trust boundary

- Maximum `.kawai` file size: 32 MB.
- Maximum expanded size: 96 MB.
- Maximum entries: 1,024.
- Symbolic links and paths escaping their owner are rejected.
- IDs use letters, numbers, `.`, `_`, and `-` and are limited to 128 characters.
- Versions follow SemVer and `apiVersion` must match the current Site API.

The loader executes trusted compiled JavaScript in Main. Path and manifest validation is
not a JavaScript sandbox. A Bundle can access Node.js during module
initialization, so users must install only archives from trusted publishers.

## Distribution checklist

- Bundle `providers` contains at least one directory.
- Every Provider and Plugin has TypeScript source, its own `manifest.json`, and
  a compiled JavaScript entry.
- Manifest IDs match `@provider` and `@plugin` metadata.
- The top-level Bundle manifest declares every required permission.
- Provider-owned Plugins are stored below their owning Provider.
- Bundle-level Plugin `providerIds` accurately expresses global or targeted
  scope.
- No credentials, tokens, private URLs, or development artifacts are included.
- All listeners, timers, browser state, and injections are cleaned up.
