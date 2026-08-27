# Kawaikara Developer Documentation

This documentation describes the active `dev` branch and the version 3.0 implementation. These documents are intended for contributors working on the application, built-in Providers, or installable Bundles.

The documentation distinguishes shipped behavior from incomplete design work. A capability described as **planned** is not available to users yet.

## Architecture

- [Architecture overview](./Architecture/1.Overview.md): repository ownership, dependency direction, composition, and IPC contracts
- [Logging and diagnostics](./Architecture/2.Logging.md): file rotation, scopes, crash capture, renderer logging, and redaction
- [Runtime and lifecycle](./Architecture/3.Runtime.md): windows, sessions, site loading, shortcuts, navigation, and cleanup
- [Security boundaries](./Architecture/4.Security.md): renderer isolation, remote pages, cookies, plugins, and permissions
- [Bundle, Provider, and Plugin](./Architecture/5.Bundle.md): extension units, lifecycle, validation, compatibility, and current limits
- [Branches and release channels](./1.BranchesAndChannels.md): `main` versus `dev`, Stable/Staging/Nightly, and the difference between a documentation preview and a published build

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

## Build and UI development

- [Build and release guide](../build/1.BuildAndRelease.md): prerequisites, development commands, Storybook, Widevine, packaging, and release channels
- Run `pnpm storybook` to open the component and view stories on port `6006`.

## Source reference

Functional and architectural explanations stay in this `docs/Developer`
tree. Classes, interfaces, types, functions, methods, and declared values use
TSDoc beside their source declarations so editors can show the same reference
through autocomplete.

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
