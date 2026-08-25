# Built-in Integrations

## Bundle organization

All official Providers are exported by `kawaikara.builtin-sites`. Each integration owns a directory under `packages/builtin-sites/src/Providers` with `Provider.ts` and `manifest.json`, making selectors, compatibility hooks, permissions, and metadata independently maintainable while preserving one Bundle installation unit.

The built-in Bundle and its child Provider/Plugin manifests start at version
`1.0.0`. Their release version is independent from the Kawaikara application
version, so an app channel build never rewrites Bundle metadata.

The built-in Bundle currently contributes 18 Providers:

| Category | Sites |
| --- | --- |
| OTT | Netflix, Laftel, Disney+, Prime Video, Wavve, Watcha, Coupang Play, TVING, Apple TV+, Crunchyroll |
| Streaming | CHZZK, Twitch |
| Video | local/HLS Video, YouTube |
| Music | Apple Music, Spotify, YouTube Music |
| Books | RIDI |

All built-in Providers advertise Korean, English, and Japanese locale support through their containing Bundle and Provider defaults. The Bundle-level `ProviderIdentityPlugin` exposes the active Provider ID as `data-kawaikara-provider` after each document becomes ready.

## Shared account profiles

YouTube and YouTube Music default to the Bundle-provided persistent `google` Electron browser profile. They share Google authentication while keeping separate live `WebContentsView` instances. Users can override either assignment from Preferences.

Apple TV+ and Apple Music likewise default to the persistent `apple` profile.
Their Apple Account cookies, cache, and related Session data therefore stay in
one Electron partition while each Provider retains its own viewer.

YouTube authentication, account addition, and account switching stay inside the
shared Electron Session. The Providers deliberately retain Electron/Chromium's
native user agent and UA Client Hints. Standalone `BrowserWindow` and
Kawaikara-equivalent `WebContentsView` validation showed that partially changing
the identity to Chrome triggers Google's insecure-browser rejection, while the
native identity signs in successfully.

Other sites default to site-specific persistent isolation. Services marked as DRM integrations surface a warning if the user assigns them to shared state.

## Current compatibility behavior

### Netflix

- Intercepts login controls with an idempotent injected hook and localized
  accessible-text fallback matching.
- Blocks embedded `/login` navigation.
- Launches external browser login and waits for `/browse`.
- Clears stale Netflix cache, storage, service workers, and cookies in the
  isolated Session before importing the completed external login, then restores
  `/browse`. This avoids merging incompatible Windows device/session state.
- Refreshes interception explicitly after external-login completion or
  cancellation so a replacement document always receives the hook.

### Coupang Play

- Uses the main branch's `/home` or `/profile` completion contract, including
  `/profiles...` variants, and then restores the original viewer URL.
- Checks committed navigation, document requests, load events, and the current
  page URL so a SPA redirect hand-off cannot leave the external-login wait
  pending.
- Intercepts embedded login and completes it in the external browser.
- Replaces the isolated Session's stale cookie jar with the completed external
  cookie jar, clears stale viewer cache/storage, and verifies the import without
  logging cookie values.
- Uses the main branch's Windows Chrome identity and HTTPS domain-scoped cookie
  conversion on both Coupang Play and Coupang API requests for Akamai
  compatibility.
- Returns to the original root document and waits for the external browser and
  temporary profile cleanup before the viewer resumes.
- Preserves Video.js and Shaka subtitle overlays in unified PiP.
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
- Defaults to the shared Apple profile and remains DRM-marked.
- Keeps display language and Apple storefront separate. Apple's own explicit
  region selection (`/kr`, `/jp`, and so on) is stored in the persistent Apple
  profile and reused at the next launch. Before the user selects a storefront,
  the `geo` cookie corrects the root load without converting the app language
  into a catalog country.

### Apple Music

- Shares the Apple Account popup behavior and browser-identity header handling
  with Apple TV+.
- Defaults to the same persistent Apple profile as Apple TV+.

### RIDI

- Preserves the legacy browser behavior for `window.open` and `target=_blank`
  as a Session-sharing popup. This supports RIDI's Apple, Google, Kakao, and
  Naver SNS login flows without replacing the main viewer document.
- Applies a browser-style user agent and client hints before the popup's first
  cross-origin OAuth request.

### YouTube

- Defaults to the shared Google profile.
- Repairs only the incomplete regional Google authentication state left by the
  retired external-login flow. Complete single- and multi-account Sessions are
  preserved.
- Keeps sign-in, add-account, and account switching inside the viewer so Google
  updates the shared Session directly without a cookie-transfer round trip.
- Preserves the native Electron user agent and UA Client Hints. No global
  `webContents.setUserAgent()` call or Google request-header rewrite is applied.
- Routes Google Account and YouTube-owned new windows back into the viewer while
  advertising, redirect, and unrelated external destinations open in the
  system browser.
- Preserves YouTube's DOM-rendered caption window above the video in unified
  PiP.
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
- Replaces CHZZK's Quality control with a Kawaikara-owned menu containing
  `1080p Kawaikara`, `720p Kawaikara`, `480p`, and `320p`. CHZZK currently
  exposes 360p as its lowest native track, so the public 320p compatibility
  item safely delegates to that track.
- Selecting `720p Kawaikara` or `1080p Kawaikara` first activates CHZZK's
  internal 480p track and then uses the proven main-branch request bypass to
  replace `480p` in the media URL with the selected target. The native high
  rows are never activated, preventing CHZZK's browser-extension gate.
- A single Kawaikara selection state drives both the Quality summary and the
  checked menu row. Selecting 480p or 320p disables request rewriting before
  activating the corresponding native low-quality track.
- Defaults live playback to the Kawaikara 1080p route and logs request-routing
  and decoded-resolution verification through the page and Provider consoles.
- Suppresses and automatically activates CHZZK's own `watch without
  installation` fallback if a previously remembered native high selection
  produces the Chrome/Edge extension gate before the custom menu is mounted.
- Tracks Clip detail routes independently from live playback, advances only a
  visible active Clip after real completion, and shares the short-form previous,
  next, toggle, status-overlay, and PiP-global shortcut behavior with YouTube.

## OTT Picture in Picture

Netflix, Laftel, Disney+, Prime Video, Wavve, Watcha, Coupang Play, TVING,
Apple TV+, and Crunchyroll explicitly expose the unified PiP capability. The
same playback document and DRM Session move into Kawaikara's PiP window, so the
media pipeline is not reloaded or cloned.

Their Providers share standard Video.js, Shaka, WebVTT, subtitle-container, and
caption-container handling. Service-specific DOM caption layers are added where
the player exposes a stable selector. PiP always supplies Kawaikara's Return and
Play/Pause overlay; page-owned PiP controls remain suppressed so only one window
lifecycle controls playback.

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
- Put new permissions, default shortcuts, settings, addresses, profile defaults,
  and other static contributions in the Provider manifest.
- Mark DRM integrations accurately.
- Use a Bundle profile only when shared authentication is intentional and tested.
- Scope user-agent/header workarounds to exact domains and restore them on unload.
- Guard PiP routes when a home page contains preview video elements.
- Keep login injection idempotent across SPA reloads.
- Test isolated playback after visiting every site known to affect DRM state.
- Prefer a bundled icon asset when a favicon host is unstable or blocks Electron.
