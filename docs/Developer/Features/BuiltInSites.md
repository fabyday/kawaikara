# Built-in Integrations

## Bundle organization

All official Providers are exported by `kawaikara.builtin-sites`. Each integration owns a directory under `packages/builtin-sites/src/Providers` with `Provider.ts` and `manifest.json`, making selectors, compatibility hooks, permissions, and metadata independently maintainable while preserving one Bundle installation unit.

The built-in Bundle currently contributes 18 Providers:

| Category | Sites |
| --- | --- |
| OTT | Netflix, Laftel, Disney+, Prime Video, Wavve, Watcha, Coupang Play, TVING, Apple TV+, Crunchyroll |
| Streaming | CHZZK, Twitch |
| Video | local/HLS Video, YouTube |
| Music | Apple Music, Spotify, YouTube Music |
| Books | RIDI |

All built-in Providers advertise Korean, English, and Japanese locale support through their containing Bundle and Provider defaults. The Bundle-level `ProviderIdentityPlugin` exposes the active Provider ID as `data-kawaikara-provider` after each document becomes ready.

## Shared Google profile

YouTube and YouTube Music default to the Bundle-provided persistent `google` browser profile. They share Google authentication while keeping separate live `WebContentsView` instances. Users can override either assignment from Preferences.

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

- Opens Apple Account windows as real Session-sharing popups.
- Uses a browser-style user agent and client hints for Apple requests while
  active, including the popup's first request, and restores the default on
  unload.
- Remains isolated and DRM-marked.

### Apple Music

- Shares the Apple Account popup behavior and browser-identity header handling
  with Apple TV+.

### RIDI

- Preserves the legacy browser behavior for `window.open` and `target=_blank`
  as a Session-sharing popup. This supports RIDI's Apple, Google, Kakao, and
  Naver SNS login flows without replacing the main viewer document.
- Applies a browser-style user agent and client hints before the popup's first
  cross-origin OAuth request.

### YouTube

- Defaults to the shared Google profile.
- Restricts PiP to watch, Shorts, and live routes so home-page preview videos are ignored.
- Injects Shorts auto-next behavior based on actual completion or a genuine loop wrap.
- Invalidates Shorts progress samples during PiP transitions so toggling PiP never skips an unfinished Short.
- Keeps the outer document scroll position stable after the native Shorts
  navigation button advances the internal carousel. This prevents the player
  from accumulating a small downward offset after automatic navigation.
- Exposes Provider-scoped auto-advance preferences plus previous, next, and
  toggle shortcuts. The toggle displays a short status overlay in both the
  normal viewer and unified PiP.
- Receives the restricted viewer-preload context-menu entry for external downloader handoff.

### CHZZK

- Restricts PiP to actual live, video, or clip detail pages, avoiding autoplay previews on the home page.
- Leaves CHZZK's native 360p, 480p, and 720p rows and their current-quality
  labels under CHZZK's control.
- Relabels only the native 1080p row as `1080p Kawaikara`. Selecting it enables
  the Provider request bypass and routes the internal 480p playlist request to
  the 1080p media route; selecting any native row disables the bypass again.
- Defaults live playback to the Kawaikara 1080p route and logs request-routing
  and decoded-resolution verification through the page and Provider consoles.
- Tracks Clip detail routes independently from live playback, advances only a
  visible active Clip after real completion, and shares the short-form previous,
  next, toggle, status-overlay, and PiP-global shortcut behavior with YouTube.

## Injection source layout

New page-world behavior is implemented as TypeScript under a Provider-local
`Inject/` directory and split by behavior, for example
`YouTube/Inject/Shorts.ts`, `Chzzk/Inject/Clips.ts`, and CHZZK's existing
ad/quality `Inject/PlaybackCompatibility.ts`. A typed, self-contained
entry point is serialized only at the `executeJavaScript` boundary. This keeps
DOM autocomplete and compile-time checking without exposing application IPC to
the remote page.

Application-owned page scripts follow the same pattern under `src/Main/Inject`.
Small scripts for media cleanup and renderer-frame synchronization no longer
live as untyped template strings in their managers.

### Crunchyroll

- Uses a bundled icon fallback so a missing or blocked favicon does not render as a broken image.

### Internal Video

- Loads the application-owned Video renderer for local library browsing,
  remembered folders and videos, file-drop redirection, HLS playback, and
  downloader UI.
- Declares the `video-library` Menu panel contribution for recent-folder and
  recent-video shortcuts.

## Common URL Provider behavior

Most remote integrations extend the internal `UrlProvider` helper. It registers both DOM-ready and did-finish-load hooks before navigation, tolerates only Electron's expected `ERR_ABORTED` SPA handoff, and runs `afterLoad()` once more when the final load resolves.

This helper is intentionally not exported as Provider API. It can evolve with bundled integrations without creating a third-party compatibility promise.

## Maintenance checklist

- Keep one Provider per directory with `Provider.ts` and `manifest.json`, and export it from `Providers/Index.ts`.
- Put new default shortcuts and icons in Provider metadata.
- Mark DRM integrations accurately.
- Use a Bundle profile only when shared authentication is intentional and tested.
- Scope user-agent/header workarounds to exact domains and restore them on unload.
- Guard PiP routes when a home page contains preview video elements.
- Keep login injection idempotent across SPA reloads.
- Test isolated playback after visiting every site known to affect DRM state.
- Prefer a bundled icon asset when a favicon host is unstable or blocks Electron.
