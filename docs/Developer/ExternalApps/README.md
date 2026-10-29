# External app developer guide

[한국어](../i18n/ko/ExternalApps/README.md) · [Developer documentation](../README.md)

This guide documents the current `dev` implementation. Distribution schema and
connection protocol versions remain **1**; an app's product version and adapter
revision are independent values.

## 1. Understand the three contracts

| Contract | Owner and purpose | Current support |
| --- | --- | --- |
| `kawaikara.manifest.json` | External app publisher: name, icon, installation and advisory connection metadata | Public HTTPS lookup, preview and verified artifact download |
| Provider `descriptors.externalApps` / `externalAppManifests` | Provider author: which app may be called and where its installation information comes from | Provider-scoped routing and installation panel |
| `ExternalAppIntegration` / `ExternalAppDescriptor` | Provider Bundle: app actions, permissions, launch URL and event codec | Generic host discovery, authenticated callbacks and permission enforcement |

**Publishing a distribution manifest does not make an arbitrary app connectable.**
A new app needs an integration shipped by its consuming Provider Bundle through
`ProviderConstructor.externalAppIntegrations`. No application-specific change to
Kawaikara's dependency injection, IPC or renderer is required. Downloaded distribution
manifests cannot supply executable JavaScript or grant permissions. Generic installed
rendezvous and Native Messaging remain separate proposed capabilities.

The downloader's packaged `kawaikara-companion.json` is a separate concrete
integration document; it is not the public distribution manifest format.

## 2. Choose a stable identity

Use a publisher-controlled identifier such as `org.example.editor`. Keep it stable
across releases and match it in the manifest, Provider declaration and adapter.
The runtime accepts lowercase IDs matching `^[a-z0-9]+(?:[.-][a-z0-9-]+)+$`, up to
160 characters. Names and icons are presentation, not authentication.

The reference app is `kawai-downloader`, ID `day.faby.kawai-downloader`. Its launch
scheme is `kawai-downloader`, not its reverse-domain ID. Do not copy that identity
for another product. Launch schemes are adapter-specific; the distribution
manifest only describes them and cannot execute them.

## 3. Publish a distribution manifest

Use the [JSON Schema](../../../resources/schemas/external-app-distribution.schema.json)
and [public types](../../../src/Common/ExternalAppDistribution.ts). This example
shows macOS and Windows artifacts plus an instructions-only Linux target:

```json
{
  "schemaVersion": 1,
  "id": "org.example.editor",
  "name": "Example Editor",
  "icon": "./icon.png",
  "homepage": "https://example.org/editor/",
  "guideUrl": "https://example.org/editor/install/",
  "connection": {
    "protocolVersion": 1,
    "transport": "loopback",
    "launchScheme": "example-editor"
  },
  "targets": [
    {
      "os": "darwin",
      "arch": "arm64",
      "version": "0.1.0",
      "artifact": {
        "url": "./ExampleEditor-arm64.dmg",
        "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "format": "dmg"
      }
    },
    {
      "os": "win32",
      "arch": "x64",
      "version": "0.1.0",
      "artifact": {
        "url": "./ExampleEditor-x64.exe",
        "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "format": "exe"
      }
    },
    {
      "os": "linux",
      "arch": "x64",
      "guideUrl": "https://example.org/editor/install/linux/"
    }
  ]
}
```

Replace both all-zero checksums with the SHA-256 of the actual final files before
publishing. For example, use `shasum -a 256 file.dmg` on macOS or
`Get-FileHash .\ExampleEditor-x64.exe -Algorithm SHA256` in PowerShell.
The example URLs are placeholders, not hosted downloads.

- Required fields: `schemaVersion`, `id`, `name`, `targets`. Keep schema version 1.
- OS values: `darwin`, `win32`, `linux`. Architecture values: `arm64`, `x64`,
  `ia32`, `arm`, `universal`. Exact runtime architecture wins over `universal`;
  the first matching target in that group wins. No cross-OS fallback occurs.
- A target can contain `version`, `guideUrl`, `artifact` and `connection`.
  A target connection replaces the whole common declaration. A target guide
  overrides the common installation guide. Missing matching targets mean unsupported.
- `artifact` requires `url`, `sha256` and `format`. Supported formats are `dmg`,
  `pkg`, `zip`, `exe`, `msi`, `appimage`, `deb`, `rpm`, `tar.gz`.
- Connection metadata uses `transport: "loopback"` and positive integer
  `protocolVersion`; the current reference protocol is 1. It does not negotiate
  compatibility or change the registered adapter by itself.

Any publicly accessible HTTPS host is suitable; GitHub is optional. Use stable,
version-pinned artifact/icon URLs. Relative URLs resolve against the original
manifest URL, even if fetching redirects to a CDN. Avoid a moving `latest` base
with relative assets unless its relative URLs really resolve to those assets.
Credentials, private network destinations and nonstandard public ports are rejected;
redirects are checked too. Fetches do not use the user's browser cookies.

| Resource | Limit / behavior |
| --- | --- |
| Manifest | 256 KiB; at most 64 targets |
| Icon | PNG/JPEG/WebP, at most 512 KiB and 2048×2048; normalized to PNG |
| Artifact | At most 2 GiB; SHA-256 verified before handoff |
| Preview | Source-scoped cache, up to 32 records; offline previews marked cached; action token expires after 20 minutes |

Publish a new icon URL when the artwork changes. Distribution icons and icons
received through an authenticated app connection use separate paths/caches.
A downloaded icon must never establish trust in the app.

macOS DMG/PKG and Windows EXE/MSI offer **Install**, with user confirmation,
verified download and native installer UI. Kawaikara does not elevate itself,
remove quarantine or automatically register the app. ZIP and Linux formats offer
verified download and instructions, without automatic extraction/execution.
A checksum verifies bytes; it does not authenticate the publisher. Sign packages
using the target OS's normal distribution process.

## 4. Declare the app in a Provider

Merge this fragment into the Provider's existing manifest:

```json
{
  "descriptors": {
    "externalApps": ["org.example.editor"],
    "externalAppManifests": {
      "org.example.editor": "https://example.org/editor/kawaikara.manifest.json"
    }
  }
}
```

The map key must also appear in `externalApps`. Use public HTTPS here even during
local testing; the native-process override below supplies the test source.
The host resolves the Provider's declared app ID to this URL. An action handler
cannot replace it with an arbitrary installation URL at runtime.

Use the Provider's scoped external-app API for an app-owned action. The registered
adapter defines action names and parameters; there is no universal media-download
command. An `accepted: true` result means the request was handed off, not that a
video finished downloading. The setup panel stays above the requesting Provider;
closing it should return to that site, preserving its context.

## 5. Implement the trusted adapter and permissions

Read the [adapter contract](../../../packages/site-api/src/ExternalApps.ts)
and [reference adapter](../../../packages/builtin-sites/src/Functional/KawaiDownloaderAdapter.ts).
Expose an `ExternalAppIntegration[]` through the Provider constructor's static
`externalAppIntegrations` property and declare each ID in `descriptors.externalApps`.
The integration owns its descriptor, custom `protocol`, `createLaunchUrl(request,
context)` and optional `onEvent(value, requestId)`. `context.getUrl(permissionId)`
checks the current grant; cookies are requested by the external app through the
request-scoped authenticated host endpoint. Never include cookies in a launch URL.
The host verifies that the returned URL uses exactly the declared custom protocol.
Missing/unknown event handlers reject callbacks; terminal events return `true` to
start the fixed callback retirement grace period.

Each Provider keeps its own codec. Multiple Providers may share an app ID only when
the complete descriptor and protocol match. Unloading the Provider removes its
integration and invalidates its resource scope. Change `descriptor.revision` when
adapter behavior changes so existing consent cannot silently authorize new behavior.

- `descriptor` declares schema 1, ID, display name, revision, permissions and actions.
- Generic native discovery and action dispatch are implemented by the host.
- `createLaunchUrl(request, context)` validates app-specific action parameters.
- `context.getUrl(permissionId)` enforces current grants. The receiving app uses
  the authenticated host endpoint for cookies; Providers do not receive cookie values.

The current resource permission kinds are `resource.url` and `cookies.read`,
scoped to exact HTTPS origins. Kawaikara selects the invocation URL and Provider
profile. An app cannot supply an arbitrary cookie URL or partition.

Registration requires user consent. Declined permissions can leave actions
unavailable; an optional cookie permission must not become a requirement for a
public URL action. The reference `open` action requires `source` URL permission
and optionally uses `session` cookies. Provider/app enablement and cookie
ask/allow/deny preferences can be changed later in settings. Handle rejection,
cancellation, timeout and revocation as ordinary outcomes.

Changes to the descriptor's revision/actions/permission scopes can require renewed
consent. Never put cookies, pairing credentials or tokens in logs, deep links,
manifest files, discovery records or Renderer messages. Use authenticated,
request-scoped transport. Revocation prevents further resource access, but cannot
recall bytes already delivered to the external app.

The reference development pairing persists private binding state and revocation
records. Disconnecting while the peer is offline must stay disconnected when it
restarts, even if the disconnecting process has exited. Automatic discovery must
not silently recreate an explicitly revoked binding. This development discovery
currently recognizes the supported reference app; it is not a generic third-party
registration API. Consult the [architecture implementation notes](../Architecture/8.ExternalApps.md)
for current internals; later proposed protocols there are not a stable SDK.

## 6. Test locally

Serve a chosen artifact and generated manifest from the Kawaikara checkout:

```sh
# Kawaikara checkout, terminal 1
pnpm external-app:serve --artifact /absolute/path/ExampleEditor-arm64.dmg --icon /absolute/path/icon.png --id org.example.editor --name 'Example Editor' --os darwin --arch arm64 --port 8765

# Kawaikara checkout, terminal 2 (macOS/Linux shell)
KAWAIKARA_EXTERNAL_APP_TEST_MANIFEST='org.example.editor=http://127.0.0.1:8765/kawaikara.manifest.json' KAWAIKARA_EXTERNAL_APP_MODE=installed pnpm dev
```

The server only exposes the selected artifact, optional icon and manifest. It
binds to `127.0.0.1`; Ctrl+C stops it. Restart it after rebuilding the artifact so
the checksum matches. Trigger the consuming Provider action in the test process;
its declared app ID selects the overridden local manifest. Settings no longer
provides a standalone manifest installation form. Actual connection and Provider
handoff require the integrated adapter.

The override is `app.id=URL`, supplied before starting Kawaikara. Only the explicitly
configured HTTP loopback origin is allowed (literal `127.0.0.1`, port 1024–65535).
It does not relax checks for other hosts, grant permissions or disable checksums.
Quit an already running Kawaikara instance before changing environment variables.

For the reference downloader:

```sh
# Downloader checkout: build an installer and serve it (or use pnpm dev:server
# if the matching artifact already exists).
pnpm dev:server:build

# Kawaikara checkout, another terminal: installed transport + port 8765 fixture.
pnpm dev:external:install-test
```

`pnpm dev:server --artifact /absolute/path/app.dmg --os darwin --arch arm64`
selects an existing downloader artifact. `--port` changes the server port; change
the Kawaikara override as well. `pnpm dev:server` is a distribution HTTP server;
`pnpm start` in the downloader checkout starts the development application.

| Kawaikara | External app | Test setup |
| --- | --- | --- |
| Packaged | Packaged | Installed transport; optionally launch the actual host executable with the local manifest override |
| Development | Packaged | `pnpm dev:external:installed`, or `pnpm dev:external:install-test` for the fixture |
| Development | Development | `pnpm dev:external:development` in Kawaikara; select its checkout in the DEV downloader or use `start:connected` below, then approve permissions |
| Packaged | Development transport | Not supported by the current mode policy |

For a packaged macOS host, set `KAWAIKARA_EXTERNAL_APP_TEST_MANIFEST` and launch
`/Applications/Kawaikara.app/Contents/MacOS/Kawaikara` directly; adjust the path
for the installed channel. A test manifest changes distribution metadata, not the
transport. Packaged hosts always use installed mode; development mode never
silently falls back to launching an installed app.

## Manual connection and discovery

Settings → External apps → **Connect manually** opens a native file picker.
Select a macOS `.app`, Windows `.exe`, or Linux executable. Kawaikara starts that
selection without shell arguments; launch success is not connection success.
The compatible app must request authenticated connection and pass normal consent.
Development sessions also expose **Running apps** to select an existing peer.

Current development discovery already uses private per-user records under
`<Kawaikara checkout>/tmp/development-connections`. Files advertise peers; loopback carries
actual authenticated communication. Automatic connection does not install apps.
A general shared-file discovery contract for arbitrary third-party installed apps
is still not implemented. Do not write into another app's data directory or treat
a discovered file as proof of identity. Durable revocations remain separate from
transient presence records.

## 7. Release and verification checklist

1. Build each supported OS/architecture, sign as appropriate, then compute checksums
   from the exact uploaded bytes. Unsupported platforms should have instructions
   or no matching target, never another platform's binary.
2. Upload artifacts and icon, then publish the manifest pointing to those files.
   Test every public URL without authentication. GitHub Draft assets are not a
   public distribution source; use the local fixture before publishing.
3. Test clean install, already installed, stopped/running peer, denied cookies,
   request cancellation, offline startup and disconnect/restart on both sides.
4. Test wrong ID, wrong checksum, unreachable icon/manifest, unsupported target and
   expired preview. The UI must remain usable and offer an honest failure state.
5. Keep app ID stable. Update product version and artifact hashes; do not bump
   schema/protocol version merely for an unreleased app build.

The reference downloader release tooling generates its manifest and icon assets.
Its workflow uploads and verifies the new assets before replacing a same-version
Draft; it never publishes simply because a local build completed. Other publishers
can use any CI/hosting service that produces the same data contract.


## Build boundary for external-app testing

The build-time `__KAWAIKARA_EXTERNAL_APP_TESTING__` literal is false for Stable
and true for Staging/Nightly. Stable omits the development transport factory,
its discovery/state paths and the `KAWAIKARA_EXTERNAL_APP_TEST_MANIFEST` loader.
Runtime environment variables cannot enable those branches in a Stable binary.
Use a Staging/Nightly host for the local-fixture instructions above, including
packaged-host testing. Packaged hosts still use installed transport.

The per-user namespaces are separate:

- Installed protocol namespace: `<OS user-data root>/Kawaikara/connections/v1` (reserved; generic
  installed-app shared-file discovery is not yet wired up).
- Development/test discovery: `<Kawaikara checkout>/tmp/development-connections` (selected explicitly by the development downloader).

The path resolver creates no directories. The transport owns presence records;
permissions and binding state remain in the selected host profile. No existing
connection records are migrated, deleted or shared between installed and test modes.


### Repository-local development connections (Windows, macOS and Linux)

Development discovery now lives in
`<Kawaikara checkout>/tmp/development-connections`. It is resolved
from the host build root and omitted entirely from Stable. Separate checkouts have
separate discovery roots. Old home-directory records are neither migrated nor
removed; fresh approval may be needed in the new namespace.

Run `pnpm dev:external:development` in Kawaikara, then in the downloader:

```sh
pnpm start:connected --kawaikara "/absolute/path/to/kawaikara-checkout"
```

This replaces the plain `pnpm start` pairing instructions above. The same command
works in PowerShell with a Windows checkout path. The script validates the host
package and passes an absolute connection directory to the child process without
shell interpolation. Plain downloader `pnpm start` starts only the app when no
connection directory is configured. For isolated fixtures, set the same absolute
`KAWAIKARA_EXTERNAL_APP_CONNECTION_DIRECTORY` on both processes before startup.

Reserved installed-app discovery roots (generic installed discovery is not wired yet):

- Windows: `%LOCALAPPDATA%\Kawaikara\connections\v1`, falling back to
  `%USERPROFILE%\AppData\Local` when LOCALAPPDATA is absent or relative.
- macOS: `~/Library/Application Support/Kawaikara/connections/v1`.
- Linux: `$XDG_STATE_HOME/kawaikara/connections/v1`, falling back to
  `~/.local/state/kawaikara/connections/v1` when XDG_STATE_HOME is absent or relative.


`dev:external:local` (alias: `dev:external:install-test`) tests distribution:
fetch the local manifest on port 8765, download/install its artifact and use installed
transport. This is separate from `dev:external:development`, which pairs running
development apps. Distribution controls remain available independently of the
connection transport when the Provider declares a manifest.

### Isolated installation tests

The checkout now keeps three independent roots:

```text
tmp/
  kawaikara Dev/                 # existing host settings, logs and permissions
  development-connections/     # development rendezvous and revocations
  ExternalAppTest/
    day.faby.kawai-downloader/
      cache/                    # test manifest/icon cache
      downloads/                # verified artifacts and temporary extraction
      installed/                # isolated application copy
```

Run the downloader distribution server (`pnpm dev:server` in its repository),
then `pnpm dev:external:install-test` in Kawaikara. This sets
`KAWAIKARA_EXTERNAL_APP_INSTALL_TEST=1` as well as the local manifest override.
Only `installed/` is searched: Spotlight, Applications, environment-selected app
paths and registered protocols cannot make the test appear installed.
`dev:external:installed` retains normal OS discovery.

macOS DMG/ZIP copies are supported without removing quarantine. Native Windows
EXE/MSI and Linux system installers cannot be safely redirected by this generic
flow, so isolated automatic installation rejects them rather than launching a real
system installer. Download-only artifacts remain confined to `downloads/`.

Quit the companion before removing its test `installed/` directory and refresh
the setup panel to repeat installation. Remove the product's entire test directory
only when its download/metadata caches should also be reset. Host grants remain
independent; revoke the registration separately to test first-time consent.
Close any normally installed downloader before testing launch: packaged downloader
instances still share their ordinary user-data/single-instance namespace.
Existing `kawaikara Dev/development-connections` files are left untouched but are no
longer read. Restart both development peers with `start:connected` to use the new
root. Stable builds exclude the installation-test module, paths and environment switch.

## Selecting the reference downloader's DEV host

The installed `kawaikara://` handler cannot identify a source checkout; it may
open Nightly instead. In the unpackaged downloader (`pnpm start`), choose
**Select Kawaikara DEV folder** and select the Kawaikara root containing
`package.json`. Alternatively, from the downloader checkout run:

```sh
pnpm start:connected --kawaikara "/absolute/path/to/kawaikara-checkout"
```

Both processes must be running. Discovery uses that checkout's
`tmp/development-connections`; unavailable DEV targets never fall back to the
installed handler. The downloader remembers the choice privately and keeps
credentials separate for each directory. Switching targets revokes the old
pairing. **Use installed Kawaikara** is an explicit separate choice. The folder
picker and development controls are hidden in packaged downloader preferences.
For a packaged downloader against a DEV host, set the explicit
`KAWAIKARA_EXTERNAL_APP_CONNECTION_DIRECTORY` override when launching it. This
does not enable development transport in a Stable or packaged Kawaikara host.

Persistent regression tests cover the registry, grants, callbacks and offline
revocation. For an optional real-client integration check from the Kawaikara
checkout (macOS/Linux shell):

```sh
KAWAI_DOWNLOADER_SOURCE=/absolute/path/to/downloader node --test tests/Integration/development-connection.test.cjs
```

The fixture uses isolated temporary profiles and both projects' actual connection
code; it does not approve permissions in a user's running app. `pnpm test:connection`
in the downloader checks target selection and persistence. These reusable tests
remain in source control; one-off PiP investigation probes do not.
