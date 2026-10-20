# Kawaikara Developer Documentation

This documentation describes the active `dev` branch and the version 3.0 implementation. These documents are intended for contributors working on the application, built-in Providers, or installable Bundles.

The documentation distinguishes shipped behavior from incomplete design work. A capability described as **planned** is not available to users yet.

## Architecture

- [Architecture overview](./Architecture/1.Overview.md): repository ownership, dependency direction, composition, and IPC contracts
- [Logging and diagnostics](./Architecture/2.Logging.md): file rotation, scopes, crash capture, renderer logging, and redaction
- [Runtime and lifecycle](./Architecture/3.Runtime.md): windows, sessions, site loading, shortcuts, navigation, and cleanup
- [Window ownership and application coordination](./Architecture/10.WindowOwnership.md): implemented ownership of native windows, presentation, feature lifecycles, and event connections
- [Security boundaries](./Architecture/4.Security.md): renderer isolation, remote pages, cookies, plugins, and permissions
- [Bundle, Provider, and Plugin](./Architecture/5.Bundle.md): extension units, lifecycle, validation, compatibility, and current limits
- [Platform and native integration](./Architecture/7.Platform.md): parallel Electron/Platform dependencies, native implementation boundaries, and call-flow diagrams
- [External apps: discovery and communication](./Architecture/8.ExternalApps.md): proposed NativeApp/WebExtension protocol, installer and portable discovery, and bidirectional sessions
- [Branches and release channels](./1.BranchesAndChannels.md): `main` versus `dev`, Stable/Staging/Nightly, and the difference between a documentation preview and a published build
- [Provider-owned WebExtension features](./Architecture/9.ProviderWebExtension.md): implemented declarations, permissions, browser bridge and synchronization

## Plugin development

- [Plugin system overview](./Plugins/1.Overview.md): the current Bundle model, browser profiles, locales, and implementation status
- [Provider development guide](./Plugins/2.Provider.md): metadata, loading, injection, login handling, PiP guards, and request hooks
- [Bundle development host](./Plugins/3.Development.md): in-app builds, hot reload, local projects, and VS Code attach debugging
- [Bundle packaging and distribution](./Plugins/4.Packaging.md): `.kawai` installation, validation, and the trust boundary

## Implemented features

- [Built-in integrations](./Features/1.BuiltInSites.md): bundled sites and the site-specific compatibility behavior currently implemented
- [Overlay and preferences](./Features/2.OverlayAndPreferences.md): full-window preferences, menu ordering, profiles, locales, shortcuts, and app information
- [Unified Picture in Picture](./Features/3.PictureInPicture.md): dedicated frameless PiP, video selection, placement, focus restoration, and shortcut scope
- [Video view and external downloader](./Features/4.VideoAndDownloads.md): file drops, local/HLS playback, and YT Section Downloader integration
- [Local update testing](./Features/5.UpdateTesting.md): isolated Nightly packages, macOS installation/relaunch tests, Windows NSIS, and failure recovery

## Build and UI development

- [Build and release guide](../build/1.BuildAndRelease.md): prerequisites, development commands, Storybook, Widevine, packaging, and release channels
- Run `pnpm storybook` to open the component and view stories on port `6006`.

## Source reference

Functional and architectural explanations stay in this `docs/Developer`
tree. Classes, interfaces, types, functions, methods, and declared values use
TSDoc beside their source declarations so editors can show the same reference
through autocomplete.

- Follow [source comment contracts](./Documentation/2.SourceComments.md) for parameter, return, failure and lifecycle documentation.
- Run `pnpm docs:source:check` to reject undocumented declarations.
- Run `pnpm docs:source` to generate the application and package HTML reference in
  `docs/Reference`.

## Source map

- Application code: [`src`](../../src)
- Stable site contract: [`packages/site-api`](../../packages/site-api)
- Bundled integrations: [`packages/builtin-sites`](../../packages/builtin-sites)
- KawaiUI stories and mocks: [`stories`](../../stories)

## Status vocabulary

| Status | Meaning |
| --- | --- |
| Implemented | Executable in the current `dev` branch codebase |
| Limited | Implemented with an intentionally restricted scope |
| Planned | Designed or documented, but no production runtime exists yet |

### Source-reference validation

`docs:source` runs the declaration-comment check before TypeDoc. Both checks must
pass; missing documentation is not suppressed globally. JSON locale catalogs are
external data rather than declarations: `typedoc.json` marks them external and
explicitly permits the two JSON-backed message aliases (`__object.downloader`
and `__object.update`) that the missing-exports plugin references. Runtime `.mts`
upscaling browser modules belong to `tsconfig.video-effects.json` and are checked
by `pnpm typecheck:video-effects`; they are excluded from the main-program source
reference. Generated `docs/Reference/` HTML is ignored by Git.
