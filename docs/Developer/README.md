# Kawaikara Developer Documentation

This documentation describes the current `dev3` implementation. It is intended for contributors working on the application, built-in site integrations, or the future external plugin system.

The documentation distinguishes shipped behavior from incomplete design work. A capability described as **planned** is not available to users yet.

## Architecture

- [Architecture overview](./Architecture/Overview.md): repository ownership, dependency direction, composition, and IPC contracts
- [Runtime and lifecycle](./Architecture/Runtime.md): windows, sessions, site loading, shortcuts, navigation, and cleanup
- [Security boundaries](./Architecture/Security.md): renderer isolation, remote pages, cookies, plugins, and permissions

## Plugin development

- [Plugin system overview](./Plugins/Overview.md): the current plugin model, browser profiles, locales, and implementation status
- [SiteDescriptor development guide](./Plugins/SiteDescriptor.md): metadata, loading, injection, login handling, PiP guards, and request hooks
- [Plugin packaging and distribution](./Plugins/Packaging.md): workspace packages today and the external-loader roadmap

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

