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
- Standard editable-field shortcuts such as `Command/Control+C`, `V`, `X`,
  `A`, and undo/redo are dispatched directly to the focused `WebContents`.
  This preserves native text editing even though the application menu is
  intentionally removed.
- Menu entry slides only the shared left rail. The full-window shade and an
  optional Site panel fade in without horizontal translation, so the Site panel
  never appears as a dark rectangle sweeping across the viewer.

Editable-focus reporting understands normal inputs, textareas, selects, `contenteditable`, deep active elements inside shadow roots, and common ARIA text roles. Modifier-based application/site shortcuts remain available while typing; only plain Menu `Tab` is suppressed.

## Menu behavior

The menu groups Providers by category and displays the current Provider, icon, localized category label, and configured shortcut target. User order is applied on top of Provider defaults. The opaque shared rail stays on the left. The transparent right-side parent contains a shared address bar and the selected Provider's PluginView contributions. One panel fills the area without a selector; multiple panels use a browser-like title strip. Stable owner id plus panel id controls selection, so duplicate visible titles are safe. The built-in Video panel is an app-owned internal view; Bundle HTML panels run in sandboxed frames.

The address help renders only the current platform binding: `Cmd+L` on macOS
and `Ctrl+L` on Windows or Linux. That binding focuses the address bar. Each Provider declares the
HTTPS hosts it accepts through `metadata.address.hosts`. Resolution prefers the
most specific matching host. Inputs without a scheme are normalized to HTTPS,
and registered hosts are exposed through a KawaiiUI-styled combobox rather than
the platform-native datalist. Its larger rows show the Provider icon, title,
and host and support pointer, Up/Down, and Enter navigation. The unfocused field
elides `https://`, a trivial `www.`, and a root slash; focusing it reveals the
complete editable URL. The same path accepts validated
`kawaikara://open?url=...` deep links. Unsupported input stays in place and
receives an inline error, red border, and shake feedback. Go is followed by a
copy button that writes the complete editable address to the system clipboard.

Provider favicons are preloaded into retained, decoded image elements owned by
the overlay renderer. The visible Menu can therefore unmount after its close
animation without flashing empty icons when Tab opens it again.

The rail header and footer remain fixed. Only the bounded site list scrolls, and
its rounded scrollbar appears briefly on Menu entry and during scrolling before
auto-hiding.

The built-in Video Provider contributes `video-library`. Its panel separates
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
- A process-wide GPU acceleration switch below Viewer behavior. It is off by
  default for capture compatibility and maps to
  `app.disableHardwareAcceleration()`. Changing it opens a restart warning;
  applying saves all pending settings and relaunches the application. Native
  libmpv hardware decoding remains enabled independently.
- Data management at the bottom separates a cache-only restart from a full
  application reset. Cache reset preserves sign-ins, preferences, user Bundles,
  and local history. Application reset removes both app-owned data roots after
  confirmation and starts with defaults.

The separate Video tab contains keyboard seek distance, control layout, and a
validated floating-point overlay hide delay in seconds.

The Bundles tab lists built-in and user-installed Bundles with their versions,
Provider and Plugin counts, declared permissions,
and activation status. `Add .kawai Bundle` opens a native file picker, validates
and installs the archive, and marks it as restart-required. A failed Bundle is
reported without blocking the rest of the application. Bundle detail renders
only Providers that contribute settings; it does not add an empty-settings
message or section for other Providers.

The global app locale is authoritative. Saving preferences clears legacy per-plugin and per-site locale overrides. Site and plugin locale metadata remains useful for resolving the closest supported locale.

### Browser Profiles

- Create and remove persistent user profiles.
- Inspect plugin-contributed profiles.
- Use plugin-contributed profiles that may be persistent or in-memory.
- Assign each site to isolated, user, or plugin shared state.
- Warn when a DRM-marked site is assigned to shared state.
- Clear cookies, storage, authentication state, and caches for a user or
  Bundle-contributed profile independently of deleting its definition.
- Clear the dedicated Session directly from a site row only when that site is
  assigned to isolated state. Shared assignments use their profile-level action.

Changing the active site's profile assignment recreates its `WebContentsView`
against the new Electron Session. Clearing a Session used by the active site
temporarily unloads that site, clears the partition, and then loads it again so
the signed-out state is visible immediately.

### Shortcuts

The page separates:

1. Menu-category jump shortcuts.
2. Application shortcuts.
3. Site navigation shortcuts.

The recorder converts physical input to Electron accelerators, displays platform-specific modifier labels, permits Delete/Backspace to disable a shortcut, and can reset a value to its Provider or app default. Duplicate accelerators are highlighted and an overwrite dialog can clear the conflicting assignments.

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

Provider defaults live in each class's `@provider` metadata.

### App Info

The App Info view puts its compact external-link icons above the Kawaikara card. The card keeps the identity and automatic-update switch on one row, then shows full-width Channel and Version rows so prerelease version names are not truncated. It also includes the Site API version, Electron/Chrome versions, platform, architecture, and installed plugin summaries.

It also provides:

- Website, GitHub, Discord, and developer YouTube links with icons.
- Developer YouTube live/offline state, refreshed once per minute with shorter offline caching.
- Manual update check beside the version.
- Automatic updates, disabled by default.
- A fixed release-channel label matching the installed build.
- A Diagnostic logs action that opens the local rotating log directory.

Stable, Staging, and Nightly builds are each locked to their own release repository and updater metadata channel. Staging is the beta-equivalent distribution, so no separate Beta channel is exposed.

Manual update checks add a modal layer above the existing Menu and Preferences
surfaces, keeping the selected Preferences tab mounted and visible through the
translucent backdrop. Dismissing the panel therefore returns to the exact App
Info state that launched it. The status panel links to a separate, larger Update
Notes view so a long version changelog has its own scrollable surface.

Automatic startup checks are silent while checking, when current, and when the
check itself fails. After an update is found, the same status panel appears as a
standalone overlay, starts the download, and relaunches the application when the
package is ready. On sufficiently tall windows the wide Kawaikara banner is
shown at its full aspect ratio; compact-height layouts crop to the character's
face rather than leaving partially visible title text.

## Persistence and validation

Preferences are stored at `UserRoot/KawaiData/preferences.json`. Electron's own profiles, sessions, and caches use `UserRoot/Electron`; Kawaikara-owned configuration, video history, and diagnostic logs use `UserRoot/KawaiData`. A first run with this layout copies known legacy preference and video-library files when their new destinations do not exist. Main validates every field when loading and updating; invalid fields fall back to defaults or are omitted. Read methods return cloned arrays and objects so renderer drafts cannot mutate manager state accidentally.

Cache and application resets write a marker beneath the channel-specific user
root and relaunch. The next process consumes that marker before Chromium,
logging, or preferences open files. Cache mode removes only known Electron cache
directories; application mode removes the exact `Electron` and `KawaiData`
children, never their parent or another channel's root.

The renderer keeps saved and draft states separately. A save bar appears only when their serialized values differ. Saving updates active window behavior, PiP configuration, global shortcut state, update configuration, locale/title, and the current browser profile when necessary.

## Storybook

Menu, Preference, and the supporting controls have stories under `stories/View` and `stories/Component`. `stories/Mocks/KawaikaraMock.ts` supplies browser-safe implementations of the preload APIs.

```bash
pnpm storybook
```

Storybook runs on port `6006` and applies KawaiUI plus the application renderer styles.
