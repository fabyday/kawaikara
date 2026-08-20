# Kawaikara Developer Documentation

This documentation describes the current `dev3` implementation. It is intended for contributors working on the application, built-in Providers, or installable Bundles.

The documentation distinguishes shipped behavior from incomplete design work. A capability described as **planned** is not available to users yet.

## Architecture

- [Architecture overview](./Architecture/Overview.md): repository ownership, dependency direction, composition, and IPC contracts
- [Bundle, Provider, and Plugin](./Architecture/Bundle.md): extension units, lifecycle, validation, compatibility, and current limits
- [Runtime and lifecycle](./Architecture/Runtime.md): windows, sessions, site loading, shortcuts, navigation, and cleanup
- [Logging and diagnostics](./Architecture/Logging.md): file rotation, scopes, crash capture, renderer logging, and redaction
- [Security boundaries](./Architecture/Security.md): renderer isolation, remote pages, cookies, plugins, and permissions

## Plugin development

- [Plugin system overview](./Plugins/Overview.md): the current Bundle model, browser profiles, locales, and implementation status
- [Provider development guide](./Plugins/Provider.md): metadata, loading, injection, login handling, PiP guards, and request hooks
- [Bundle packaging and distribution](./Plugins/Packaging.md): `.kawai` installation, validation, and the trust boundary

## Implemented features

- [Overlay and preferences](./Features/OverlayAndPreferences.md): full-window preferences, menu ordering, profiles, locales, shortcuts, and app information
- [Unified Picture in Picture](./Features/PictureInPicture.md): dedicated frameless PiP, video selection, placement, focus restoration, and shortcut scope
- [Video view and external downloader](./Features/VideoAndDownloads.md): file drops, local/HLS playback, and YT Section Downloader integration
- [Built-in integrations](./Features/BuiltInSites.md): bundled sites and the site-specific compatibility behavior currently implemented

## Build and UI development

- [Build and release guide](../build/1.build.md): prerequisites, development commands, Storybook, Widevine, packaging, and release channels
- Run `pnpm storybook` to open the component and view stories on port `6006`.

## Source map

- Application code: [`src`](../../src)
- Stable site contract: [`packages/site-api`](../../packages/site-api)
- Bundled integrations: [`packages/builtin-sites`](../../packages/builtin-sites)
- KawaiUI stories and mocks: [`stories`](../../stories)

## Status vocabulary

| Status | Meaning |
| --- | --- |
| Implemented | Executable in the current `dev3` codebase |
| Limited | Implemented with an intentionally restricted scope |
| Planned | Designed or documented, but no production runtime exists yet |
