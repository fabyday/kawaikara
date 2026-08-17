# Kawaikara dev3

Kawaikara is a compact Electron viewer for streaming, video, music, and reading services. `dev3` rebuilds the application around isolated site sessions, explicit site plugins, an app-owned overlay, and a unified video-focused Picture in Picture window.

## Implemented features

### Site viewer

- One active site at a time in a sandboxed `WebContentsView`.
- Site-specific persistent Sessions by default.
- Optional user and plugin profiles for intentional login sharing.
- Site shortcuts, category ordering, and custom menu ordering.
- App-level fullscreen separated from a web player's in-window fullscreen.
- Site-specific navigation, popup, login, request-header, user-agent, and injection policies.

### Built-in services

Kawaikara currently includes Netflix, Laftel, Disney+, Prime Video, Wavve, Watcha, Coupang Play, TVING, Apple TV+, Crunchyroll, CHZZK, Twitch, YouTube, Apple Music, Spotify, YouTube Music, RIDI, and the internal Video view.

Important compatibility work includes external-browser login with cookie transfer for Netflix and Coupang Play, Sign in with Apple popup handling for Laftel, a shared Google profile for YouTube/YouTube Music, browser-style identity handling for Apple TV+ and Coupang Play, and PiP route guards that ignore home-page preview videos.

### Overlay and preferences

- `Tab` opens the compact site menu when the viewer is not editing text.
- Preferences replaces the menu and uses the complete overlay area.
- General, Browser Profiles, Shortcuts, and App Info tabs.
- Drag-and-drop menu ordering with keyboard and arrow-button alternatives.
- Configurable app/site/category shortcuts with conflict detection.
- Korean, English, Japanese, and system locale modes.
- Stable, Staging, and Nightly update channels.
- Manual update checks and opt-in automatic updates.
- Website, GitHub, Discord, and developer YouTube links, including live status.

### Unified Picture in Picture

- A frameless, always-on-top PiP window using the existing site view.
- Video-only rendering with page UI and native controls hidden.
- Landscape and portrait size settings.
- Display, corner, and remembered-position settings.
- Drag anywhere, hover to reveal Return to Kawaikara, or press `Escape` to restore.
- Main-window focus, Dock visibility, and task-switcher presence restored on exit.
- A global PiP accelerator only while PiP is active.
- YouTube Shorts support with completion-based auto-next behavior.

### Local video and downloads

- Drop a supported video file anywhere in Kawaikara to open the Video view.
- Frame stepping, configurable seek shortcuts, and a hover title/duration overlay.
- HLS playback support remains available internally while its source controls are hidden.
- YouTube player context-menu handoff to the external YT Section Downloader app.
- Helper detection on macOS, Windows, and Linux.
- Confirmed, integrity-checked helper installation on macOS and Windows.

### Application integration

- `kawaikara://` deep links for supported HTTPS service URLs.
- Discord Rich Presence when a Discord application ID is included in the build.
- Widevine-ready Castlabs Electron packaging for DRM playback.
- Component and view development through KawaiUI Storybook.

## Current limitations

- External third-party plugins cannot yet be installed without rebuilding Kawaikara.
- Plugin permissions are descriptive and are not enforced at runtime.
- Plugin code is not sandboxed from the Main process.
- Plugin-provided renderer UI is not supported; descriptors can use only app-owned internal views.
- Site compatibility still depends on remote DOM and authentication behavior and requires regression testing.

## Development documentation

See the [developer documentation](../Developer/README.md) for architecture, lifecycle, security, plugin development, implemented feature details, and the [build/release guide](../build/1.build.md).

Start Storybook with:

```bash
pnpm storybook
```
