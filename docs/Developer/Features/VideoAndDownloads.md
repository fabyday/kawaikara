# Video View and External Downloader

## Internal Video site

`kawaikara.video` is a normal descriptor in the bundled plugin, but it loads the app-owned `video` internal view instead of a remote URL.

The Video renderer supports:

- A local file chosen through the file picker.
- A validated dropped local video path delivered by Main.
- An HLS URL.
- Native HLS when the runtime supports `application/vnd.apple.mpegurl`.
- `hls.js` fallback when native HLS is unavailable.
- Native video controls and autoplay fallback to manual user play.
- The YT Section Downloader status/install/open panel.

Object URLs and HLS instances are destroyed when the source changes or the view unmounts.

## Drag-and-drop redirection

The overlay preload and viewer preload install the same capture-phase file drop handler. It prevents the remote page from navigating to the file and sends filesystem paths to Main.

Main accepts the first candidate that:

- Is an absolute path.
- Exists and is a regular file.
- Uses a supported video extension.

Supported extensions currently include common containers such as MP4, MKV, MOV, WebM, AVI, MPEG, TS/MTS/M2TS, M4V, FLV, OGV, WMV, and 3GP.

After validation, Main queues a `file:` request, hides the overlay, and loads `kawaikara.video`. The Video renderer receives the queued request after its internal document loads. Dropping a new file while already on Video repeats the same routing rather than asking the current page to interpret the file.

## YouTube entry point

The restricted viewer preload adds `Download with Kawaikara` to the YouTube player context menu. It is installed only on `youtube.com` and `m.youtube.com` and forwards the current HTTPS YouTube URL to Main.

If YT Section Downloader is already installed, Kawaikara opens the external app immediately through `yt-downloader://open?url=...`. If it is missing, Kawaikara queues a YouTube request, switches to the Video view, and opens the downloader panel with the URL filled in.

Accepted source hosts are limited to YouTube, mobile YouTube, YouTube Music, and `youtu.be`, over HTTPS.

## Installation detection

Kawaikara recognizes the helper through platform-specific mechanisms:

| Platform | Detection |
| --- | --- |
| macOS | `YT Section Downloader.app` in `~/Applications` or `/Applications`, optional configured path, then Spotlight bundle-ID lookup |
| Windows | Optional configured path, known per-user/system paths, then registered `yt-downloader` protocol |
| Linux | Default handler for `x-scheme-handler/yt-downloader` |

The macOS bundle identifier must be `com.ytdownloader.app`. This allows Kawaikara to recognize the helper whether it was installed from a DMG, ZIP, or another process, as long as the final application identity is correct.

## Automatic installation

Automatic installation is implemented for macOS and Windows. Other platforms can open the release page.

The workflow always asks for user confirmation first and reads a release manifest from the official GitHub release location. It validates the manifest version, target platform/architecture, artifact kind, HTTPS URL, repository release path, and SHA-256.

### macOS

1. Download a DMG or ZIP into a temporary directory with mode `0600`.
2. Verify SHA-256.
3. Remove `com.apple.quarantine` from the verified archive.
4. Mount the DMG read-only without browsing, or extract the ZIP with `ditto`.
5. Require exactly one top-level `.app` bundle.
6. Verify the bundle identifier and read its version.
7. Copy to a staging app below `~/Applications`.
8. Verify identity again and recursively remove quarantine from the staged bundle.
9. Move an existing target app to Trash, then rename the staged app into place.
10. Re-verify the installed bundle, detach the DMG, and remove temporary files.

The installer does not request administrator privileges and never writes to `/Applications` automatically.

### Windows

Kawaikara downloads and verifies the official `.exe` in the user's Downloads directory, then opens it. The user completes the normal installer and can retry the downloader action afterward.

## Deep-link launch

After installation:

- macOS uses `/usr/bin/open -a <verified app path> <deep link>`.
- Windows starts the known executable with the deep link, or relies on the registered protocol when only protocol detection is available.
- Linux delegates the protocol URL to the operating system.

The external downloader owns its download UI and worker. Kawaikara does not embed yt-dlp or download media itself.

## User and legal boundary

The Video view reminds users to download only content they own or are authorized to save. Integration with an external helper does not bypass a service's terms, copyright restrictions, or DRM.

