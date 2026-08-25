# Logging and Diagnostics

Kawaikara initializes one `electron-log` pipeline at the beginning of the Main
process. Existing `console.debug/info/warn/error` calls are routed through that
pipeline, so managers and bundled plugins are persisted without each subsystem
configuring its own file transport. `LoggingManager` owns initialization,
runtime level changes, renderer attachment, diagnostic-directory access, and
session shutdown. It is registered in the application manager container and
injected into consumers that need a scoped logger or renderer capture. New code
can use `logging.createLogger(scope)` from
`src/Main/Manager/LoggingManager.ts` when a stable subsystem label is useful.

## Output and retention

The active file is `UserRoot/KawaiData/logs/kawaikara.log`. Electron's own
`userData` and `sessionData` paths point to `UserRoot/Electron`, keeping runtime
caches separate from Kawaikara-owned settings, library state, and diagnostics.
It rotates at 5 MiB using `electron-log`'s archived predecessor file. Development
builds record `debug` and above; packaged builds record `info` and above. A
runtime `KAWAIKARA_LOG_LEVEL` value can select `error`, `warn`, `info`,
`verbose`, `debug`, or `silly`.

Each process launch records a random session ID, app/runtime versions, release
channel, platform, architecture, renderer mode, startup completion, and clean
shutdown. Preferences > App Info > Diagnostic logs opens the containing folder.

## Captured failures

- Unhandled Main-process errors and promise rejections.
- Electron child/renderer process termination, preload failures, and navigation
  load failures.
- Console output and unresponsive/responsive transitions from app-owned Viewer,
  Overlay, Video, and PiP surfaces.
- Existing manager, site, updater, native Video, and HLS error messages.

Remote sites do not receive a logging bridge. Their JavaScript console chatter
is not copied into the file, although Electron-level load and process failures
remain visible.

## Privacy boundary

Before transport, the logger recursively redacts common authorization, cookie,
password, API-key, credential, and token fields. HTTP(S) URL credentials,
queries, and fragments are removed. Logs remain local and are never uploaded by
the application. Contributors should still avoid logging media contents, cookie
jars, request bodies, or account data.
