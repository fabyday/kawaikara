# Overlay and Preferences

## Surface model

The overlay is one frameless child window with two top-level routes:

```text
Overlay BrowserWindow
├── Menu route       -> full area with a 410 px shared rail, address bar, and Site panel
└── Preference route -> full viewer content area
```

Preferences uses the whole overlay while leaving the current Menu panel visible
as a fixed, non-interactive underlay. Returning to Menu reuses that same panel
without replaying its entry animation.

Clicking the backdrop outside the Preferences surface lowers the overlay back
to Menu. Moving focus to another application does not close either layer.

## Keyboard behavior

- `Tab` toggles Menu from normal viewer content unless an editable element owns focus.
- `Tab` closes Menu without moving focus. Inside Preferences it is consumed so
  focus cannot move into either Preferences or the fixed Menu underlay.
- `Escape` or a non-editing `Backspace` in Preferences means Back to Menu.
- The Menu route can close on `Escape` and on outside click; both behaviors are preferences and default to enabled.
- Category jump shortcuts are active only while Menu is visible.
- Menu entry slides only the shared left rail. The full-window shade and an
  optional Site panel fade in without horizontal translation, so the Site panel
  never appears as a dark rectangle sweeping across the viewer.

Editable-focus reporting understands normal inputs, textareas, selects, `contenteditable`, deep active elements inside shadow roots, and common ARIA text roles. Modifier-based application/site shortcuts remain available while typing; only plain Menu `Tab` is suppressed.

## Menu behavior

The menu groups sites by descriptor category and displays the current descriptor, icon, localized category label, and configured shortcut target. User order is applied on top of descriptor defaults. The opaque shared rail stays on the left. The transparent right-side parent contains a shared address bar and an optional panel declared by `metadata.menu.panel`; a plugin-provided panel is responsible for its own background. The bundled Video panel uses an opaque surface.

`Control+L`/`Command+L` focuses the address bar. Each descriptor declares the
HTTPS hosts it accepts through `metadata.address.hosts`. Resolution prefers the
most specific matching host, and the same path accepts validated
`kawaikara://open?url=...` deep links. Unsupported input stays in place and
receives an inline error, red border, and shake feedback.

The rail header and footer remain fixed. Only the bounded site list scrolls, and
its rounded scrollbar appears briefly on Menu entry and during scrolling before
auto-hiding.

The bundled Video descriptor contributes `video-library`. Its panel separates
recent folders from recent videos. Folder cards expose pin/unpin and remove
actions through a renderer-owned context menu; video cards open directly.

The centered order editor has two modes:

- Categories only, useful when the complete site list is long.
- Sites within each category.

Both modes use `@dnd-kit` pointer and keyboard sensors. Every row also retains explicit up/down buttons as an accessible alternative. The editor changes the draft preference state and applies it after Save.

Category shortcuts default to `1`, `2`, `3`, and so on in current category order. When pressed from Menu they scroll and highlight the corresponding group instead of opening a site.

## Preference tabs

### General

- Global application language: system, Korean, English, or Japanese.
- Default startup site.
- Menu category and site order editor.
- Separate landscape and portrait PiP size presets/custom sizes, followed by
  PiP position and display selection.
- File logging level: Error, Warn, Info, Verbose, Debug, or disabled.
- Viewer behavior at the bottom: always on top, startup Menu, `Escape`, and
  outside-click dismissal.

The separate Video tab contains keyboard seek distance, control layout, and a
validated floating-point overlay hide delay in seconds.

The global app locale is authoritative. Saving preferences clears legacy per-plugin and per-site locale overrides. Site and plugin locale metadata remains useful for resolving the closest supported locale.

### Browser Profiles

- Create and remove persistent user profiles.
- Inspect plugin-contributed profiles.
- Use plugin-contributed profiles that may be persistent or in-memory.
- Assign each site to isolated, user, or plugin shared state.
- Warn when a DRM-marked site is assigned to shared state.

Changing the active site's profile assignment recreates its `WebContentsView` against the new Electron Session.

### Shortcuts

The page separates:

1. Menu-category jump shortcuts.
2. Application shortcuts.
3. Site navigation shortcuts.

The recorder converts physical input to Electron accelerators, displays platform-specific modifier labels, permits Delete/Backspace to disable a shortcut, and can reset a value to its descriptor or app default. Duplicate accelerators are highlighted and an overwrite dialog can clear the conflicting assignments.

Preferences leaves the opaque Menu rail visible, uses an opaque settings panel,
a fixed vertical section list, and an independently scrolling
content panel. The content scrollbar sits at the outer edge and is transparent
until scrolling, then fades again after activity stops. The Developer section
can open Chrome DevTools for the active SiteView with left, right, bottom,
undocked, or fully detached placement.

Current application defaults are:

| Action | Default |
| --- | --- |
| Open or close Menu | `Tab` |
| Toggle application fullscreen | `Alt+Enter` |
| Open Preferences | `CommandOrControl+,` |
| Toggle always on top | `CommandOrControl+Shift+L` |
| Toggle PiP | `CommandOrControl+Shift+P` |
| Reload current site | `CommandOrControl+R` |
| Back / Forward | `Alt+Left` / `Alt+Right` |

Site defaults live in each descriptor's `@site` metadata.

### App Info

The App Info view puts its compact external-link icons above the Kawaikara card. The card keeps the identity and automatic-update switch on one row, then shows full-width Channel and Version rows so prerelease version names are not truncated. It also includes the Site API version, Electron/Chrome versions, platform, architecture, and installed plugin summaries.

It also provides:

- Website, GitHub, Discord, and developer YouTube links with icons.
- Developer YouTube live/offline state, refreshed once per minute with shorter offline caching.
- Manual update check beside the version.
- Automatic updates, disabled by default.
- Release-channel selection for builds that allow it.
- A Diagnostic logs action that opens the local rotating log directory.

Nightly builds lock the update channel to Nightly. Stable and Staging builds may select Stable, Staging, or Nightly through the preference value.

## Persistence and validation

Preferences are stored at `UserRoot/KawaiData/preferences.json`. Electron's own profiles, sessions, and caches use `UserRoot/Electron`; Kawaikara-owned configuration, video history, and diagnostic logs use `UserRoot/KawaiData`. A first run with this layout copies known legacy preference and video-library files when their new destinations do not exist. Main validates every field when loading and updating; invalid fields fall back to defaults or are omitted. Read methods return cloned arrays and objects so renderer drafts cannot mutate manager state accidentally.

The renderer keeps saved and draft states separately. A save bar appears only when their serialized values differ. Saving updates active window behavior, PiP configuration, global shortcut state, update configuration, locale/title, and the current browser profile when necessary.

## Storybook

Menu, Preference, and the supporting controls have stories under `stories/View` and `stories/Component`. `stories/Mocks/KawaikaraMock.ts` supplies browser-safe implementations of the preload APIs.

```bash
pnpm storybook
```

Storybook runs on port `6006` and applies KawaiUI plus the application renderer styles.
