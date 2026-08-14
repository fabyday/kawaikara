# Overlay and Preferences

## Surface model

The overlay is one frameless child window with two top-level routes:

```text
Overlay BrowserWindow
├── Menu route       -> compact 380 px panel
└── Preference route -> full viewer content area
```

Preferences replaces the menu route and uses the whole overlay. It is not rendered inside the compact menu panel. Returning to Menu preserves the already-open menu state and skips its entry animation.

## Keyboard behavior

- `Tab` toggles Menu from normal viewer content unless an editable element owns focus.
- `Tab` inside Preferences moves focus and never closes the overlay.
- `Escape` or a non-editing `Backspace` in Preferences means Back to Menu.
- The Menu route can close on `Escape` and on outside click; both behaviors are preferences and default to enabled.
- Category jump shortcuts are active only while Menu is visible.

Editable-focus reporting understands normal inputs, textareas, selects, `contenteditable`, deep active elements inside shadow roots, and common ARIA text roles. Modifier-based application/site shortcuts remain available while typing; only plain Menu `Tab` is suppressed.

## Menu behavior

The menu groups sites by descriptor category and displays the current descriptor, icon, localized category label, and configured shortcut target. User order is applied on top of descriptor defaults.

The centered order editor has two modes:

- Categories only, useful when the complete site list is long.
- Sites within each category.

Both modes use `@dnd-kit` pointer and keyboard sensors. Every row also retains explicit up/down buttons as an accessible alternative. The editor changes the draft preference state and applies it after Save.

Category shortcuts default to `1`, `2`, `3`, and so on in current category order. When pressed from Menu they scroll and highlight the corresponding group instead of opening a site.

## Preference tabs

### General

- Always on top.
- Open Menu at startup.
- Close Menu on `Escape`.
- Close Menu on outside click.
- Default startup site.
- Menu category and site order editor.
- Separate landscape and portrait PiP size presets/custom sizes.
- PiP position and display selection.
- Global application language: system, Korean, English, or Japanese.

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

The App Info card shows the Kawaikara icon and identity, release channel and version in a two-column layout, Site API version, Electron/Chrome versions, platform, architecture, and installed plugin summaries.

It also provides:

- Website, GitHub, Discord, and developer YouTube links with icons.
- Developer YouTube live/offline state, refreshed once per minute with shorter offline caching.
- Manual update check beside the version.
- Automatic updates, disabled by default.
- Release-channel selection for builds that allow it.

Nightly builds lock the update channel to Nightly. Stable and Staging builds may select Stable, Staging, or Nightly through the preference value.

## Persistence and validation

Preferences are stored as JSON below Electron's `userData` path. Main validates every field when loading and updating; invalid fields fall back to defaults or are omitted. Read methods return cloned arrays and objects so renderer drafts cannot mutate manager state accidentally.

The renderer keeps saved and draft states separately. A save bar appears only when their serialized values differ. Saving updates active window behavior, PiP configuration, global shortcut state, update configuration, locale/title, and the current browser profile when necessary.

## Storybook

Menu, Preference, and the supporting controls have stories under `stories/View` and `stories/Component`. `stories/Mocks/KawaikaraMock.ts` supplies browser-safe implementations of the preload APIs.

```bash
pnpm storybook
```

Storybook runs on port `6006` and applies KawaiUI plus the application renderer styles.
