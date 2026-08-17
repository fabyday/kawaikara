# Built-in Integrations

## Plugin organization

All official descriptors are exported by `kawaikara.builtin-sites`. Each integration lives in one file under `packages/builtin-sites/src/Sites`, making selectors, compatibility hooks, and metadata independently maintainable while preserving one plugin installation unit.

The bundled plugin currently contributes 18 sites:

| Category | Sites |
| --- | --- |
| OTT | Netflix, Laftel, Disney+, Prime Video, Wavve, Watcha, Coupang Play, TVING, Apple TV+, Crunchyroll |
| Streaming | CHZZK, Twitch |
| Video | local/HLS Video, YouTube |
| Music | Apple Music, Spotify, YouTube Music |
| Books | RIDI |

All built-in descriptors advertise Korean, English, and Japanese locale support through the containing plugin and site defaults.

## Shared Google profile

YouTube and YouTube Music default to the plugin-provided persistent `google` browser profile. They share Google authentication while keeping separate live `WebContentsView` instances. Users can override either assignment from Preferences.

Other sites default to site-specific persistent isolation. Services marked as DRM integrations surface a warning if the user assigns them to shared state.

## Current compatibility behavior

### Netflix

- Intercepts login controls with an idempotent injected hook and localized
  accessible-text fallback matching.
- Blocks embedded `/login` navigation.
- Launches external browser login and waits for `/browse`.
- Copies cookies into the isolated Netflix Session and restores the viewer.
- Refreshes interception explicitly after external-login completion or
  cancellation so a replacement document always receives the hook.

### Coupang Play

- Intercepts embedded login and completes it in the external browser.
- Removes Electron product tokens from the viewer user agent.
- Applies a Chrome-compatible user agent and `Sec-CH-UA` header only to Coupang Play domains.
- Blocks direct embedded `/login` navigation.

### Laftel

- Keeps normal new windows in the viewer.
- Allows `appleid.apple.com` as a real Session-sharing popup so Sign in with Apple can use opener/web-message semantics instead of rendering a black or detached login window.
- Uses a bundled icon fallback instead of relying on an unreliable favicon URL.

### Apple TV+

- Uses a browser-style user agent while active and restores the default on unload.
- Remains isolated and DRM-marked.

### YouTube

- Defaults to the shared Google profile.
- Restricts PiP to watch, Shorts, and live routes so home-page preview videos are ignored.
- Injects Shorts auto-next behavior based on actual completion or a genuine loop wrap.
- Invalidates Shorts progress samples during PiP transitions so toggling PiP never skips an unfinished Short.
- Receives the restricted viewer-preload context-menu entry for external downloader handoff.

### CHZZK

- Restricts PiP to actual live, video, or clip detail pages, avoiding autoplay previews on the home page.

### Crunchyroll

- Uses a bundled icon fallback so a missing or blocked favicon does not render as a broken image.

### Internal Video

- Loads the application-owned Video renderer for local library browsing,
  remembered folders and videos, file-drop redirection, HLS playback, and
  downloader UI.
- Declares the `video-library` Menu panel contribution for recent-folder and
  recent-video shortcuts.

## Common URL descriptor behavior

Most remote integrations extend the internal `UrlSiteDescriptor` helper. It registers both DOM-ready and did-finish-load hooks before navigation, tolerates only Electron's expected `ERR_ABORTED` SPA handoff, and runs `afterLoad()` once more when the final load resolves.

This helper is intentionally not exported as Site API. It can evolve with bundled integrations without creating a third-party compatibility promise.

## Maintenance checklist

- Keep one descriptor per file and export it from `Sites/Index.ts`.
- Put new default shortcuts and icons in descriptor metadata.
- Mark DRM integrations accurately.
- Use a plugin profile only when shared authentication is intentional and tested.
- Scope user-agent/header workarounds to exact domains and restore them on unload.
- Guard PiP routes when a home page contains preview video elements.
- Keep login injection idempotent across SPA reloads.
- Test isolated playback after visiting every site known to affect DRM state.
- Prefer a bundled icon asset when a favicon host is unstable or blocks Electron.
